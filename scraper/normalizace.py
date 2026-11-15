"""Normalizace cen na Kč/100 g – čistá logika, testovatelná offline.

Open Prices vrací ceny za KILOGRAM nebo za UNIT (kus/balení).
Na Kč/100 g převedeme jen záznamy, kde známe hmotnost/obsah.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

KURZ_EUR_CZK_VYCHOZI = 25.5


def normalizuj_nazev(nazev: str) -> str:
    """Bez diakritiky, malá písmena, jen [a-z0-9 ] a sjednocené mezery.

    Interpunkce → mezera: „Lay's" → „lay s", „Häagen-Dazs" → „haagen dazs" –
    shodné tokeny na obou stranách párování, jen čistší tokenizace.
    """
    bez = "".join(
        c for c in unicodedata.normalize("NFD", nazev) if unicodedata.category(c) != "Mn"
    )
    bez = re.sub(r"[^a-z0-9 ]+", " ", bez.lower())
    return re.sub(r"\s+", " ", bez).strip()


# Jednoduchý český stemmer pro párování letákových názvů – nabídky
# používají skloňované tvary („Citrony", „Banány", „Kuřecí čtvrtky"),
# katalog drží převážně tvary základní. Iterativně stříhá skloňovací
# koncovky; kmen má min. 3 znaky. Nenahrazuje lingvistický stemmer –
# slouží jen k porovnání tokenů v matcheru.
_KONCOVKY = sorted(
    (
        "ici", "ice", "eci", "ech", "ich", "umi", "ami", "imi", "emi",
        "eti", "ata", "etu", "ova", "ove", "ovy", "ovi", "ek", "ik",
        "ec", "ky", "ka", "ko", "ci", "ce", "ku", "ke", "ov", "ou",
        "em", "um", "im", "at", "et", "u", "y", "e", "a", "i", "o",
    ),
    key=len,
    reverse=True,
)


def cesky_stem(token: str) -> str:
    """Zjednodušený kmen (na výstupu normalizuj_nazev).

    „banany"→„banan", „okurky"→„okur", „kuřecí"→„kur", „jablka"→„jabl".
    """
    s = token
    while len(s) > 3:
        for konc in _KONCOVKY:
            if s.endswith(konc) and len(s) - len(konc) >= 3:
                s = s[: -len(konc)]
                break
        else:
            break
    return s


def stem_nazev(nazev: str) -> str:
    """normalizuj_nazev + kmen každého tokenu (pro stem-párování)."""
    return " ".join(cesky_stem(t) for t in normalizuj_nazev(nazev).split())


def mnozstvi_v_gramech(product: dict) -> Optional[float]:
    """Vytáhne hmotnost/obsah produktu v g/ml z Open Prices záznamu."""
    for klic in ("product_quantity", "quantity"):
        hodnota = (product or {}).get(klic)
        try:
            if hodnota and float(hodnota) > 0:
                return float(hodnota)
        except (TypeError, ValueError):
            continue
    return None


def cena_za_100g(
    price: float,
    price_per: Optional[str],
    gramy: Optional[float],
    mena: str = "CZK",
    kurz_eur: float = KURZ_EUR_CZK_VYCHOZI,
) -> Optional[float]:
    """Převede záznam na Kč/100 g; None = nelze spolehlivě převést."""
    if price is None or price <= 0:
        return None
    cena_kc = price * kurz_eur if mena == "EUR" else price
    if mena not in ("CZK", "EUR"):
        return None
    if price_per == "KILOGRAM":
        return round(cena_kc / 10, 2)
    # UNIT / None: potřebujeme obsah v g
    if gramy and gramy > 0:
        return round(cena_kc * 100 / gramy, 2)
    return None


# Mapování řetězců z OSM/Open Prices na české obchody v tabulce retailers
OBCHODY_ALIAS = {
    "kaufland": "Kaufland",
    "lidl": "Lidl",
    "albert": "Albert",
    "billa": "Billa",
    "tesco": "Tesco",
    "penny": "Penny",
    "penny market": "Penny",
    "globus": "Globus",
    "lidl cz": "Lidl",
    "rohlik": "Rohlík.cz",
}


def obchod_z_location(location: dict) -> Optional[str]:
    """OSM název/značka → název obchodu pro tabulku retailers."""
    kandidati = [
        location.get("osm_name") or "",
        location.get("osm_display_name") or "",
        (location.get("osm_tags") or {}).get("brand") or "",
    ]
    spojene = normalizuj_nazev(" ".join(kandidati))
    for klic, kanonicky in OBCHODY_ALIAS.items():
        if klic in spojene:
            return kanonicky
    # neznámý obchod – použij původní osm_name, jinak přeskoč
    nazev = (location.get("osm_name") or "").strip()
    return nazev[:60] if nazev else None
