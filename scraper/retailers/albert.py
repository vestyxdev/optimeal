"""Albert – albert.cz e-shop API (Ahold Delhaize).

Produktový endpoint vrací items s cena/discount informací.
Ahold API si občas žádá hlavičky verzí – když odmítne, jen zalogujeme
a běžíme dál (ostatní řetězce se scrapují dál).
"""

from __future__ import annotations

import logging
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka
from .schwarz import _cislo

log = logging.getLogger("scraper.albert")

# Veřejné endpointy, které Albert/Ahold web používá (zkusíme v pořadí)
ENDPOINTY = [
    "https://www.albert.cz/api/v1/products/search",
    "https://www.albert.cz/api/v1/products",
]
MAX_STRANEK = 20


def _cena(item: dict) -> tuple[Optional[float], Optional[float]]:
    price = item.get("price") or {}
    if isinstance(price, dict):
        return (
            _cislo(price.get("now") or price.get("current") or price.get("value") or price.get("sale")),
            _cislo(price.get("was") or price.get("original") or price.get("regular")),
        )
    return _cislo(item.get("price")), _cislo(item.get("priceBefore"))


class AlbertScraper(BaseScraper):
    obchod = "Albert"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        self.session.headers.update({"Accept": "application/json"})
        for endpoint in ENDPOINTY:
            nasel = False
            for stranka in range(MAX_STRANEK):
                data = self._get_json(
                    endpoint,
                    params={"keyword": "", "page": stranka, "size": 100, "sort": "discount"},
                )
                if not data:
                    break
                nasel = True
                items = (
                    data.get("products") or data.get("items") or data.get("results")
                    or (data.get("data") or {}).get("products") or []
                )
                if not items:
                    break
                for p in items:
                    if not isinstance(p, dict):
                        continue
                    cena, puvodni = _cena(p)
                    if not cena or not (puvodni and puvodni > cena):
                        continue
                    nazev = (p.get("name") or p.get("title") or "").strip()
                    img = p.get("image") or p.get("imageUrl") or {}
                    obrazek = img if isinstance(img, str) else img.get("url")
                    n = self._nabidka(
                        f"{nazev} {p.get('unitSize') or p.get('quantity') or ''}".strip(),
                        cena, puvodni,
                        ean=p.get("ean") or p.get("gtin") or p.get("id"),
                        obrazek=obrazek if isinstance(obrazek, str) else None,
                    )
                    if n:
                        self.nalezeno += 1
                        yield n
            if nasel:
                return
