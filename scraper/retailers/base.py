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

POKUSY = 4   # 3 s + 9 s + 27 s ≈ 40 s okno – krátkodobý IP rate-limit
             # kupi.cz tak stihne pominout; delší blok přežije jen nová IP
             # (druhý cron běh workflowu)
PAUZA = 2.0  # základní pauza mezi požadavky (s jitterem) – kupi.cz
             # začne po rychlé sérii vracet 403; ~2 s + jitter drží tempo


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
    je_sleva: bool = True  # letákové nabídky = True; asortimentní cena = False
    kategorie: str = "ostatni"  # pro nové potraviny z asortimentu
    znacka: Optional[str] = None
    extra: dict = field(default_factory=dict)


# „185 g" / „1,5 l" / „33 cl" / „25 dkg" – číslo + hmotnostní/objemová
# jednotka. ml/cl/l a dkg počítáme přibližně jako gramy (konvence baleni_g).
# „ks"/„%"/„°" úmyslně chybí – kusy bez gramáže a % tuku/alkoholu se
# na Kč/100 g převést nedají.
RE_MNOZSTVI = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|dkg|g|l|cl|ml)\b")

_NASOBKY_G = {"kg": 1000, "dkg": 10, "g": 1, "l": 1000, "cl": 10, "ml": 1}

# Multiplikátor před jednotkovou frází: „2 x" / „6×" / „3+1" / „3+1 zdarma" /
# „2 ks po" / „4 kusy po"
RE_MUL_PREFIX = re.compile(
    r"(?:(\d+)\s*[x×]|(\d+)\s*\+\s*(\d+)(?:\s*(?:zdarma|zadarmo|gratis))?|"
    r"(\d+)\s*(?:ks|kus[ůy]?)\s*po)\s*$",
)
# Multiplikátor za frází: „x 2" / „× 6" / „3+1 zdarma" / „+ 1 zdarma".
# Samotné „+ N" bez slova zdarma je bonusová gramáž („500 g + 200 g"),
# ne počet kusů – proto „zdarma/gratis" vyžadujeme.
RE_MUL_SUFFIX = re.compile(
    r"\s*(?:[x×]\s*(\d+)|(\d+)\s*\+\s*(\d+)(?:\s*(?:zdarma|zadarmo|gratis))?|"
    r"\+\s*(\d+)\s*(?:zdarma|zadarmo|gratis|free))",
)


def _multiplikator(pred: str, za: str) -> int:
    """Násobek balení okolo jednotkové fráze („4 x 250 g" → 4)."""
    m = RE_MUL_PREFIX.search(pred)
    if m:
        if m.group(1):
            return int(m.group(1))
        if m.group(2) and m.group(3):  # „3+1 zdarma" = 4 kusy
            return int(m.group(2)) + int(m.group(3))
        if m.group(4):
            return int(m.group(4))
    m = RE_MUL_SUFFIX.match(za)
    if m:
        if m.group(1):
            return int(m.group(1))
        if m.group(2) and m.group(3):  # „x g 3+1" = 4 kusy
            return int(m.group(2)) + int(m.group(3))
        if m.group(4):  # „+ 1 zdarma" = zakoupený kus + 1 navíc
            return 1 + int(m.group(4))
    return 1


def gramaje_z_nazvu(nazev: str) -> Optional[float]:
    """Vytáhne hmotnost/obsah v g z letákového názvu.

    Zvládá: „500 g", „1 kg", „1,5 l", „250 ml", „2 x 250 g", „6x300ml",
    „4x100g", „2×250 g", „3+1 zdarma 500 ml", „2 ks po 250 g",
    „185 g / 130 g", „cca 1 kg", „od 400 g", „25 dkg".

    Vícenásobné výskyty („20 g bílkovin" vs. „45 g" tyčinka,
    „185 g / 130 g" pevný podíl): vítězí NEJVĚTŠÍ kandidát – celkový
    obsah balení bývá vždy větší než nutriční/počtové údaje.
    Procenta („3,5 %", „40 % vol") a kusy („10 ks") se ignorují.
    """
    if not nazev:
        return None
    n = nazev.lower().replace(",", ".")

    nejlepsi: Optional[float] = None
    for m in RE_MNOZSTVI.finditer(n):
        hodnota = float(m.group(1))
        if hodnota <= 0:
            continue
        g = hodnota * _NASOBKY_G[m.group(2)]
        g *= _multiplikator(n[: m.start()], n[m.end() :])
        # <2 g … 30 kg – velké pytle (25 kg mouka v Metru) projdou,
        # cisterna 50 l už ne
        if 2 <= g <= 30000 and (nejlepsi is None or g > nejlepsi):
            nejlepsi = g
    return nejlepsi


# Typografické uvozovky/pomlčky → ASCII; vícenásobné mezery → jedna.
# Diakritiku neschazujeme – katalog ji drží v UTF-8.
def cist_nazev(nazev: str) -> str:
    """Sjednotí letákový název: whitespace, uvozovky, pomlčky."""
    n = re.sub(r"[\u2018\u2019\u201a\u2032]", "'", nazev)
    n = re.sub(r"[\u201c\u201d\u201e\u2033]", '"', n)
    n = re.sub(r"[\u2013\u2014\u2212]", "-", n)
    return re.sub(r"\s+", " ", n).strip()


def ceny_na_100g(cena: float, gramy: Optional[float]) -> Optional[float]:
    """Cena za balení → Kč/100 g; None když hmotnost neznáme."""
    if cena and gramy and cena > 0 and gramy > 0:
        return round(cena * 100 / gramy, 2)
    return None


# Konzervativní filtr nepotravinového zboží – Košík i Rohlík míchají
# drogerii do produktových listů potravinových kategorií; bez filtru by
# se "prací gel" zakládal jako potravina. Jen jednoznačné výrazy.
RE_NEPOTRAVINA = re.compile(
    r"prací (gel|prášek|kapsl|prostřed|tablet|sod[au])|aviváž|"
    r"šampon|šampón|sprchový (gel|krém|olej|balzám)|tělov(ý|é|á|ého) |"
    r"deodorant|antiperspirant|zubní (pasta|kartáč)|"
    r"ústní vod|toaletní papír|papírové kapesn|kuchyňské utěrk|houbičk|"
    r"houba na nádobí|\bsavo\b|domestos|fixinela|čistič|"
    r"(prostředek|gel|tablety?) na nádobí|tekuté mýdlo|mýdlo|"
    r"\bvložky\b|tampon|plenk|\bpleny\b|intimní|bateri|svíčk[aeuy]\b|svíček|"
    r"odpuzovač|repelent|lepidl|wc (gel|kostk|blok|čistič|kachlíčk)|"
    r"leštidl|leštěnk|na skvrn|odmašťovač|myčk|"
    r"pračk[ay]\b|žehl|sklokeram|indukční des|"
    r"(čistič|sprej|prostředek) na (okn|skl|povrch|koupel|podlah|kuchyň|wc|odpad|dřev)|"
    r"osvěžovač|vonn(á|é|ý) (tyčink|svíčk|vosk)|žárovk|"
    r"pytle? na (odpad|smeti)|gumové rukavice|latexové rukavice|"
    r"nitrilov|ubrousk|navlék|mop\b|kbelík|vědro|\blufa\b|"
    r"krmivo pro|granule pro (psy|kočk)|pro psy\b|pro kočky\b|"
    r"kočičí (stelivo|wc|toaleta)|stelivo|hovinko|pamlse?k|"
    r"dentální (pasta|kartáč|voda)|vlhčený toaletní|inkontinenčn",
    re.IGNORECASE)


def je_potravina(nazev: str) -> bool:
    """False pro zjevně nepotravinové položky (drogerie, zverimex)."""
    return not RE_NEPOTRAVINA.search(nazev or "")


class BaseScraper:
    """Společný základ: session, retry, tempo. Potomek = 1 řetězec."""

    obchod: str = "?"
    zdroj: str = "scraper"

    def __init__(self, pauza: float = PAUZA):
        self.pauza = pauza
        self.session = requests.Session()
        self.nalezeno = 0
        self.fetched = False  # aspoň jedna stránka skutečně načtena
        # poslední terminalní selhání byl WAF/rate-limit (403/429) –
        # ceniky.py tím odliší „zdroj nás zablokoval" (infra, neřeší
        # retry kódu) od „parser nic nevytěžil" (chyba, má zůstat červené)
        self.blocked = False
        self._rotuj_ua()

    def _rotuj_ua(self) -> None:
        self.session.headers.update(
            {
                "User-Agent": random.choice(UA_POOL),
                # plná hlavičková sada skutečného prohlížeče – samotný
                # User-Agent má u WAF nízké skóre a často chytá 403
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7",
                # pozor: „br" (brotli) neumí requests dekódovat bez balíčku
                # brotli – server by poslal nečitelnou odpověď
                "Accept-Encoding": "gzip, deflate",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "DNT": "1",
            }
        )

    def _get(self, url: str, **kw) -> Optional[requests.Response]:
        """GET s retry/backoffem; po vyčerpání pokusů None (nebombarduj)."""
        for pokus in range(1, POKUSY + 1):
            try:
                r = self.session.get(url, timeout=30, **kw)
                if r.status_code == 200:
                    self.blocked = False
                    time.sleep(self.pauza + random.uniform(0, 1.2))
                    return r
                if r.status_code in (403, 429, 500, 502, 503, 504) and pokus < POKUSY:
                    # rate-limit / WAF / přechodná chyba serveru –
                    # rotuj UA (u 403/429) a čekej exponenciálně
                    if r.status_code in (403, 429):
                        self._rotuj_ua()
                    cekani = 3**pokus
                    log.warning(
                        "%s: HTTP %d na %s – rotuji UA, čekám %d s (pokus %d/%d)",
                        self.obchod, r.status_code, url, cekani, pokus, POKUSY,
                    )
                    time.sleep(cekani)
                    continue
                log.warning("%s: HTTP %d na %s", self.obchod, r.status_code, url)
                if r.status_code in (403, 429):
                    self.blocked = True
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
            nazev=cist_nazev(nazev)[:200],
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
