"""Tesco – itesco.cz grocery API (pohání Tesco nákup online).

Endpoint /groceries/cs-CZ/products vrací results s promotions.
Některé verze API si žádají app-key – bez něj dostaneme 403,
zalogujeme a jdeme dál.
"""

from __future__ import annotations

import logging
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka
from .schwarz import _cislo

log = logging.getLogger("scraper.tesco")

API = "https://nakup.itesco.cz/groceries/cs-CZ/products"
DOTAZY = ["akce", "sleva"]  # promo výrazy – promotions pole si vezmeme z výsledků
MAX_OFFSET = 300


def _cena(item: dict) -> tuple[Optional[float], Optional[float]]:
    price = item.get("price") or {}
    if isinstance(price, dict):
        return (
            _cislo(price.get("price") or price.get("value") or price.get("afterPromotion")),
            _cislo(price.get("regular") or price.get("was") or price.get("beforePromotion")),
        )
    return _cislo(item.get("price")), _cislo(item.get("priceBefore"))


def _je_sleva(item: dict) -> bool:
    promos = item.get("promotions")
    if isinstance(promos, list) and promos:
        return True
    return False


class TescoScraper(BaseScraper):
    obchod = "Tesco"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        self.session.headers.update({"Accept": "application/json"})
        videni: set[str] = set()
        for dotaz in DOTAZY:
            offset = 0
            while offset < MAX_OFFSET:
                data = self._get_json(
                    API,
                    params={"query": dotaz, "offset": offset, "limit": 50},
                )
                if not data:
                    break
                results = (
                    (data.get("products") or {}).get("results")
                    or data.get("results") or []
                )
                if not results:
                    break
                for p in results:
                    if not isinstance(p, dict):
                        continue
                    if not _je_sleva(p):
                        continue
                    cena, puvodni = _cena(p)
                    if not cena:
                        continue
                    nazev = (p.get("name") or p.get("title") or "").strip()
                    pid = str(p.get("id") or nazev)
                    if pid in videni:
                        continue
                    videni.add(pid)
                    img = p.get("defaultImageUrl") or p.get("image")
                    n = self._nabidka(
                        f"{nazev} {p.get('unitOfSale') or ''}".strip(),
                        cena, puvodni,
                        ean=str(p.get("tpnb") or p.get("ean") or "") or None,
                        obrazek=img if isinstance(img, str) else None,
                    )
                    if n:
                        self.nalezeno += 1
                        yield n
                offset += len(results) if results else 50
