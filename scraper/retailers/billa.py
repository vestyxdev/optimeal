"""Billa – veřejné shop API shopapi.billa.cz (pohání jejich e-shop).

Endpoint products vrací JSON s price.normal / price.discount,
articleId (EAN), images a quantity. Procházíme zlevněné položky
po stránkách.
"""

from __future__ import annotations

import logging
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka
from .schwarz import _cislo

log = logging.getLogger("scraper.billa")

API = "https://shopapi.billa.cz/api/products"
MAX_STRANEK = 25


def _cena(polozka: dict) -> tuple[Optional[float], Optional[float]]:
    """(aktualni, puvodni) – bere discount bloky i flat klíče."""
    price = polozka.get("price") or {}
    if isinstance(price, dict):
        normal = price.get("normal") or {}
        disc = price.get("discount") or {}
        aktualni = _cislo(disc.get("value")) or _cislo(price.get("value")) or _cislo(normal.get("value"))
        puvodni = _cislo(normal.get("value")) if disc else _cislo(
            price.get("crossedPrice") or price.get("regular")
        )
        return aktualni, puvodni
    return _cislo(polozka.get("price")), _cislo(polozka.get("regularPrice"))


def _gramy(polozka: dict) -> Optional[float]:
    for k in ("quantity", "grammage", "packageSize", "weight"):
        g = _cislo(polozka.get(k))
        if g and 2 <= g <= 20000:
            return g
    return None


class BillaScraper(BaseScraper):
    obchod = "Billa"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        self.session.headers.update({"Accept": "application/json"})
        for stranka in range(MAX_STRANEK):
            data = self._get_json(
                API,
                params={
                    "page": stranka,
                    "pageSize": 100,
                    "category": "B",  # Akce
                    "searchTerm": "",
                },
            )
            if not data:
                break
            polozky = data.get("results") or data.get("products") or []
            if not polozky:
                break
            for p in polozky:
                if not isinstance(p, dict):
                    continue
                cena, puvodni = _cena(p)
                if not cena or not (puvodni and puvodni > cena):
                    continue  # jen skutečné slevy
                nazev = (p.get("name") or "").strip()
                imgs = p.get("images") or []
                obrazek = imgs[0] if imgs and isinstance(imgs[0], str) else None
                n = self._nabidka(
                    nazev, cena, puvodni,
                    gramy=_gramy(p),
                    ean=p.get("articleId") or p.get("ean") or p.get("sku"),
                    obrazek=obrazek,
                )
                if n:
                    self.nalezeno += 1
                    yield n
