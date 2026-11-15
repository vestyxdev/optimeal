"""Globus – globus.cz akční nabídky.

Globus zveřejňuje akce primárně v letácích; zkusíme jejich webový
JSON (pokud ho stránka používá). Když nenajdeme použitelný zdroj,
vrátíme prázdný výsledek – orchestrátor to zaloguje a jede dál.
"""

from __future__ import annotations

import logging
from typing import Iterator

from .base import BaseScraper, Nabidka
from .schwarz import _cislo, _nabidky, _nazev

log = logging.getLogger("scraper.globus")

ENDPOINTY = [
    "https://www.globus.cz/api/akce",
    "https://www.globus.cz/api/offers",
]


class GlobusScraper(BaseScraper):
    obchod = "Globus"

    def stahni_slevy(self) -> Iterator[Nabidka]:
        for endpoint in ENDPOINTY:
            data = self._get_json(endpoint)
            if not data:
                continue
            for offer in _nabidky(data):
                if not isinstance(offer, dict):
                    continue
                nazev = _nazev(offer)
                cena = _cislo(offer.get("price"))
                puvodni = _cislo(offer.get("originalPrice") or offer.get("wasPrice"))
                n = self._nabidka(
                    nazev, cena, puvodni,
                    ean=offer.get("ean"),
                    obrazek=offer.get("image"),
                )
                if n:
                    self.nalezeno += 1
                    yield n
            if self.nalezeno:
                return
        log.info("Globus: veřejný zdroj nabídek nenalezen – přeskočeno")
