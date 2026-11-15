"""Penny Market – penny.cz akční nabídka (Rewe Group).

Akční stránka obsahuje nabídky buď v JSON blobu na stránce, nebo
přes jejich backend. Zkusíme veřejné varianty; když nic nevyjde,
zalogujeme a jdeme dál.
"""

from __future__ import annotations

import logging
import re
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka
from .schwarz import _cislo, _nabidky, _nazev

log = logging.getLogger("scraper.penny")

ENDPOINTY = [
    "https://www.penny.cz/api/offers",
    "https://www.penny.cz/api/v1/offers",
    "https://www.penny.cz/nabidky/data",
]
STRANKA = "https://www.penny.cz/akcni-nabidka/"


def _json_ze_stranky(html: str) -> Optional[list]:
    """Hledá embedded JSON s nabídkami (__NEXT_DATA__ / window.*)."""
    import json
    for pat in (
        r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        r'window\.(?:offers|data)\s*=\s*(\{.*?\})\s*;',
    ):
        m = re.search(pat, html, re.S)
        if m:
            try:
                return [json.loads(m.group(1))]
            except ValueError:
                continue
    return None


class PennyScraper(BaseScraper):
    obchod = "Penny"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        for endpoint in ENDPOINTY:
            data = self._get_json(endpoint)
            if data:
                yield from self._rozparsovat(data)
                if self.nalezeno:
                    return
        # fallback: HTML stránka s embedded JSON
        r = self._get(STRANKA)
        if r:
            for blob in _json_ze_stranky(r.text) or []:
                yield from self._rozparsovat(blob)
        if not self.nalezeno:
            log.info("Penny: žádný použitelný zdroj nabídek – přeskočeno")

    def _rozparsovat(self, data) -> Iterator[Nabidka]:
        for offer in _nabidky(data):
            if not isinstance(offer, dict):
                continue
            nazev = _nazev(offer)
            if not nazev:
                continue
            cena = _cislo(
                offer.get("price") or offer.get("currentPrice")
                or offer.get("offer_price")
            )
            puvodni = _cislo(
                offer.get("wasPrice") or offer.get("originalPrice")
                or offer.get("regularPrice")
            )
            podtitul = offer.get("subtitle") or offer.get("description") or ""
            n = self._nabidka(
                f"{nazev} {podtitul}".strip(), cena, puvodni,
                ean=offer.get("ean"),
                obrazek=offer.get("image") or offer.get("imageUrl"),
            )
            if n:
                self.nalezeno += 1
                yield n
