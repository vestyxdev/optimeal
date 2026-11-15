"""Kupi.cz – agregátor českých letákových slev (jeden zdroj pro všechny řetězce).

Stránky /slevy/<slug> jsou server-renderované a obsahují strukturovaně
to, co potřebujeme: název, jednotku (1 l / 300 g / 4x 0.33 l), akční
cenu, % slevy, jednotkovou cenu (už počítají Kč/100 g!) a platnost.

DOM mapa (listopad 2026):
  .product--wrap[data-product]        – blok produktu
    .product_name strong              – název
    .product_name .nowrap span        – jednotka balení ("1 l")
    .product_image img[data-src]      – fotka (lazy)
    .discount_row                     – jedna cenová nabídka
      strong.discount_price_value     – "9,90 Kč"
      .discount_amount                – "/ 1 l" (za co je cena)
      .discount_percentage            – "–32 %" (volitelné)
      .price_per_unit                 – "66,63 Kč / 100 g"
      .discounts_validity             – "platí do úterý 17. 11."

Stránkování: ?page=N; prázdná stránka = konec.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Iterator, Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, Nabidka, ceny_na_100g, gramaje_z_nazvu

log = logging.getLogger("scraper.kupi")

BASE = "https://www.kupi.cz/slevy"
MAX_STRAN = 12
MIN_NABIDEK_NA_STRANU = 3  # menší počet = pravděpodobně konec výpisu


def _cislo(text: str | None) -> Optional[float]:
    """'9,90 Kč' → 9.9; '–32 %' → 32.0; prázdné → None."""
    if not text:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", text.replace("\xa0", " ").replace(" ", ""))
    return float(m.group(1).replace(",", ".")) if m else None


def gramaje_z_jednotky(jednotka: str) -> Optional[float]:
    """'1 l' → 1000; '300 g' → 300; '4x 0.33 l' → 1320; '16 ks' → None."""
    if not jednotka:
        return None
    return gramaje_z_nazvu(jednotka)


def _c100_z_jednotkove_ceny(text: str | None) -> Optional[float]:
    """'.price_per_unit' → Kč/100 g.

    '66,63 Kč / 100 g' → 66.63; '9,90 Kč / 1 l|1 kg' → 0.99/9.9→ /10;
    ostatní jednotky (ks, balení) → None.
    """
    if not text:
        return None
    t = text.replace("\xa0", " ")
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*Kč\s*/\s*(\d+(?:[.,]\d+)?)?\s*(100\s*g|kg|g|l|cl|ml|ks)", t)
    if not m:
        return None
    cena = float(m.group(1).replace(",", "."))
    mnozstvi = float((m.group(2) or "1").replace(",", "."))
    jednotka = m.group(3).replace(" ", "")
    gramy = {"100g": 100, "kg": 1000, "g": 1, "l": 1000, "cl": 10, "ml": 1}.get(jednotka)
    if gramy is None:
        return None
    celkem = gramy * mnozstvi
    return round(cena * 100 / celkem, 2) if celkem > 0 else None


def platnost_do(text: str | None, dnes: date | None = None) -> Optional[str]:
    """'platí do úterý 17. 11.' → '2026-11-17'; 'dnes končí' → dnes.

    Mesíc v minulosti oproti dnešku = příští rok (přelom prosinec→leden).
    """
    dnes = dnes or date.today()
    if not text:
        return None
    t = text.lower().replace("\xa0", " ")
    if "dnes" in t and "končí" in t:
        return dnes.isoformat()
    m = re.search(r"(\d{1,2})\.\s*(\d{1,2})\s*\.?", t)
    if not m:
        return None
    den, mesic = int(m.group(1)), int(m.group(2))
    rok = dnes.year + (1 if mesic < dnes.month - 1 else 0)
    try:
        return date(rok, mesic, den).isoformat()
    except ValueError:
        return None


class KupiScraper(BaseScraper):
    """Jeden parser pro všechny řetězce – liší se slug a kanonickým názvem."""

    slug = ""
    obchod = "?"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        for strana in range(1, MAX_STRAN + 1):
            params = {"page": strana} if strana > 1 else None
            r = self._get(f"{BASE}/{self.slug}", params=params)
            if r is None:
                break
            nalezeno_na_strane = 0
            soup = BeautifulSoup(r.text, "html.parser")
            wraps = soup.select(".product--wrap")
            radky = soup.select(".discount_row")
            log.info(
                "%s: strana %d – status %d, %d B, %d wraps, %d discount_row, url %s",
                self.obchod, strana, r.status_code, len(r.text),
                len(wraps), len(radky), r.url,
            )
            if not wraps:
                log.warning(
                    "%s: strana %d – 0 .product--wrap; pravděpodobně "
                    "jiná šablona/bot wall. Ukázka: %.300s",
                    self.obchod, strana, r.text.replace("\n", " "),
                )
                break
            for wrap in wraps:
                nazev_el = wrap.select_one(".product_name strong")
                if not nazev_el:
                    continue
                nazev = re.sub(r"\s+", " ", nazev_el.get_text()).strip()
                jednotka_el = wrap.select_one(".product_name .nowrap span")
                jednotka = jednotka_el.get_text(strip=True) if jednotka_el else ""
                img = wrap.select_one(".product_image img[data-src]")
                obrazek = img["data-src"] if img and img.get("data-src") else None

                gramy = gramaje_z_jednotky(jednotka) or gramaje_z_nazvu(nazev)

                for row in wrap.select(".discount_row"):
                    n = self._radek(row, nazev, gramy, obrazek)
                    if n:
                        nalezeno_na_strane += 1
                        self.nalezeno += 1
                        yield n
            if nalezeno_na_strane < MIN_NABIDEK_NA_STRANU:
                break  # konec výpisu (nebo prázdná stránka)

    def _radek(
        self, row, nazev: str, gramy: Optional[float], obrazek: Optional[str]
    ) -> Optional[Nabidka]:
        cena_el = row.select_one(".discount_price_value")
        cena = _cislo(cena_el.get_text() if cena_el else None)
        if not cena:
            return None

        # jednotková cena už je normalizovaná – preferujeme ji před výpočtem
        pu_el = row.select_one(".price_per_unit")
        c100 = _c100_z_jednotkove_ceny(pu_el.get_text() if pu_el else None)
        if c100 is None:
            amount_el = row.select_one(".discount_amount")
            g = gramy or gramaje_z_jednotky(
                amount_el.get_text() if amount_el else ""
            )
            c100 = ceny_na_100g(cena, g)
            if g and not gramy:
                gramy = g
        if c100 is None:
            return None

        pct_el = row.select_one(".discount_percentage")
        pct = _cislo(pct_el.get_text() if pct_el else None)
        p100 = round(c100 / (1 - pct / 100), 2) if pct and 0 < pct < 100 else None

        val_el = row.select_one(".discounts_validity")
        do = platnost_do(val_el.get_text() if val_el else None)

        return Nabidka(
            nazev=nazev[:200],
            obchod=self.obchod,
            cena_za_100g=c100,
            puvodni_cena_za_100g=p100,
            gramy=gramy,
            obrazek=obrazek if isinstance(obrazek, str) and obrazek.startswith("http") else None,
            platnost_do=do,
            sleva_procenta=round(pct) if pct else None,
        )


class KauflandScraper(KupiScraper):
    obchod = "Kaufland"
    slug = "kaufland"


class LidlScraper(KupiScraper):
    obchod = "Lidl"
    slug = "lidl"


class AlbertScraper(KupiScraper):
    obchod = "Albert"
    slug = "albert"


class BillaScraper(KupiScraper):
    obchod = "Billa"
    slug = "billa"


class TescoScraper(KupiScraper):
    obchod = "Tesco"
    slug = "tesco"


class PennyScraper(KupiScraper):
    obchod = "Penny"
    slug = "penny-market"


class GlobusScraper(KupiScraper):
    obchod = "Globus"
    slug = "globus"
