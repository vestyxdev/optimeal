"""Základní třída scraperů českých supermarketů.

Každý řetězec implementuje `stahni_slevy()` → iterátor `Nabidka`.
Sdílená infrastruktura: requests.Session s rotací User-Agentů,
retry/backoff na 403/429/5xx, slušné tempo a pomocníci na parsování
cen a hmotností z letákových názvů.

Nabídka je normalizovaná: cena_za_100g je jediný povinný údaj
(cokoli bez převoditelné hmotnosti se přeskočí – stejná logika
jako u Open Prices). puvodni_cena_za_100g = přeškrtnutá cena.
"""

from __future__ import annotations

import logging
import random
import re
import time
from dataclasses import dataclass, field
from typing import Iterator, Optional

import requests

log = logging.getLogger("scraper.retailers")

UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]

POKUSY = 3
PAUZA = 0.8  # základní pauza mezi požadavky (s jitterem)


@dataclass
class Nabidka:
    """Jedna letáková/eshopová nabídka, normalizovaná na Kč/100 g."""

    nazev: str
    obchod: str
    cena_za_100g: float
    puvodni_cena_za_100g: Optional[float] = None  # přeškrtnutá cena
    gramy: Optional[float] = None
    ean: Optional[str] = None
    obrazek: Optional[str] = None
    platnost_do: Optional[str] = None  # ISO datum YYYY-MM-DD
    sleva_procenta: Optional[int] = None
    extra: dict = field(default_factory=dict)


def gramaje_z_nazvu(nazev: str) -> Optional[float]:
    """Vytáhne hmotnost/obsah v g z letákového názvu.

    Zvládá: "500 g", "1 kg", "1,5 l", "250 ml", "2 x 250 g", "6x300ml".
    ml/cl/l počítáme přibližně jako gramy (stejná konvence jako baleni_g).
    """
    if not nazev:
        return None
    n = nazev.lower().replace(",", ".")

    m = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b", n)
    if not m:
        return None
    hodnota = float(m.group(1))
    jednotka = m.group(2)
    v_gramech = {
        "kg": hodnota * 1000,
        "g": hodnota,
        "l": hodnota * 1000,
        "cl": hodnota * 10,
        "ml": hodnota,
    }[jednotka]

    # multipack: "2 x 500 g" / "6x300 ml"
    pred = n[: m.start()]
    m_mul = re.search(r"(\d+)\s*[x×]\s*$", pred)
    if m_mul:
        v_gramech *= int(m_mul.group(1))
    # opačné pořadí: "500 g x 2"
    za = n[m.end():]
    m_mul2 = re.match(r"\s*[x×]\s*(\d+)", za)
    if m_mul2:
        v_gramech *= int(m_mul2.group(1))

    return v_gramech if 2 <= v_gramech <= 20000 else None


def ceny_na_100g(cena: float, gramy: Optional[float]) -> Optional[float]:
    """Cena za balení → Kč/100 g; None když hmotnost neznáme."""
    if cena and gramy and cena > 0 and gramy > 0:
        return round(cena * 100 / gramy, 2)
    return None


class BaseScraper:
    """Společný základ: session, retry, tempo. Potomek = 1 řetězec."""

    obchod: str = "?"
    zdroj: str = "scraper"

    def __init__(self, pauza: float = PAUZA):
        self.pauza = pauza
        self.session = requests.Session()
        self.nalezeno = 0
        self._rotuj_ua()

    def _rotuj_ua(self) -> None:
        self.session.headers.update(
            {
                "User-Agent": random.choice(UA_POOL),
                "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
                "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7",
            }
        )

    def _get(self, url: str, **kw) -> Optional[requests.Response]:
        """GET s retry/backoffem; po vyčerpání pokusů None (nebombarduj)."""
        for pokus in range(1, POKUSY + 1):
            try:
                r = self.session.get(url, timeout=30, **kw)
                if r.status_code == 200:
                    time.sleep(self.pauza + random.uniform(0, 0.5))
                    return r
                if r.status_code in (403, 429) and pokus < POKUSY:
                    # rate-limit / WAF – rotuj UA a čekej déle
                    self._rotuj_ua()
                    cekani = 3**pokus
                    log.warning(
                        "%s: HTTP %d na %s – rotuji UA, čekám %d s (pokus %d/%d)",
                        self.obchod, r.status_code, url, cekani, pokus, POKUSY,
                    )
                    time.sleep(cekani)
                    continue
                log.warning("%s: HTTP %d na %s", self.obchod, r.status_code, url)
                return None
            except requests.RequestException as e:
                if pokus == POKUSY:
                    log.error("%s: %s – %s", self.obchod, url, e.__class__.__name__)
                    return None
                time.sleep(2**pokus)
        return None

    def _get_json(self, url: str, **kw) -> Optional[dict]:
        r = self._get(url, **kw)
        if r is None:
            return None
        try:
            return r.json()
        except ValueError:
            log.warning("%s: neočekávaný (ne-JSON) obsah z %s", self.obchod, url)
            return None

    # --- pomocníci pro potomky -------------------------------------

    def _nabidka(
        self,
        nazev: str,
        cena: Optional[float],
        puvodni: Optional[float] = None,
        gramy: Optional[float] = None,
        **kw,
    ) -> Optional[Nabidka]:
        """Sestaví Nabidku; vrátí None když nejde normalizovat na /100 g."""
        if not nazev or not cena or cena <= 0:
            return None
        g = gramy or gramaje_z_nazvu(nazev)
        c100 = ceny_na_100g(cena, g)
        if c100 is None:
            return None
        p100 = ceny_na_100g(puvodni, g) if puvodni else None
        pct = None
        if puvodni and puvodni > cena:
            pct = round((1 - cena / puvodni) * 100)
        return Nabidka(
            nazev=nazev.strip()[:200],
            obchod=self.obchod,
            cena_za_100g=c100,
            puvodni_cena_za_100g=p100,
            gramy=g,
            sleva_procenta=pct,
            **kw,
        )

    def stahni_slevy(self) -> Iterator[Nabidka]:
        """Potomek implementuje – iteruje aktuální slevové nabídky."""
        raise NotImplementedError
