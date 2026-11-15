"""Schwarz Group letáky – Kaufland i Lidl sdílí endpoints.leaflets.schwarz.

Veřejný JSON endpoint používaný jejich letákovými weby:
  1) seznam letáků pro region → flyer_identifier
  2) detail letáku → nabídky (title, price, priceWas, quantity, images)

Struktura payloadu se občas mění – parsování je defenzivní:
hledáme nabídky v několika známých klíčích a cenu umíme vytáhnout
z objektu i z plaintext "24,90".
"""

from __future__ import annotations

import logging
import re
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka

log = logging.getLogger("scraper.schwarz")

API = "https://endpoints.leaflets.schwarz/v4"


def _cislo(v) -> Optional[float]:
    """'24,90' / {'value': 24.9} / {'current': '24.90'} → float."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        for k in ("value", "current", "price", "amount"):
            if v.get(k) is not None:
                return _cislo(v[k])
        return None
    if isinstance(v, str):
        m = re.search(r"(\d+(?:[.,]\d+)?)", v.replace(" ", ""))
        return float(m.group(1).replace(",", ".")) if m else None
    return None


def _obrazek(offer: dict) -> Optional[str]:
    for k in ("image", "imageUrl", "image_url"):
        v = offer.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    imgs = offer.get("images") or offer.get("media")
    if isinstance(imgs, list) and imgs:
        prvni = imgs[0]
        if isinstance(prvni, str) and prvni.startswith("http"):
            return prvni
        if isinstance(prvni, dict):
            for k in ("url", "src", "medium", "small"):
                if isinstance(prvni.get(k), str) and prvni[k].startswith("http"):
                    return prvni[k]
    return None


def _nabidky(payload) -> Iterator[dict]:
    """Vytáhne seznam nabídek z payloadu v jakékoli známé podobě."""
    if isinstance(payload, dict):
        for klic in ("offers", "items", "results", "products", "flyer_items"):
            seznam = payload.get(klic)
            if isinstance(seznam, list):
                for it in seznam:
                    yield it
                return
        for klic in ("flyer", "data", "payload"):
            if isinstance(payload.get(klic), dict):
                yield from _nabidky(payload[klic])
                return
    elif isinstance(payload, list):
        for it in payload:
            yield it


def _nazev(offer: dict) -> str:
    for k in ("title", "name", "product_name", "description"):
        v = offer.get(k)
        if isinstance(v, str) and len(v.strip()) > 2:
            return v
    return ""


def _popis(offer: dict) -> str:
    """Sub-title / description – často obsahuje „500 g" i když title ne."""
    casti = []
    for k in ("subtitle", "description", "quantity", "contents", "size"):
        v = offer.get(k)
        if isinstance(v, str):
            casti.append(v)
    return " ".join(casti)


def _platnost(flyer: dict, offer: dict) -> Optional[str]:
    for zdroj in (offer, flyer):
        for k in ("end_date", "endDate", "valid_to", "validTo", "expires"):
            v = zdroj.get(k)
            if isinstance(v, str) and re.match(r"\d{4}-\d{2}-\d{2}", v):
                return v[:10]
    return None


class SchwarzLetakScraper(BaseScraper):
    """Společný základ pro Kaufland a Lidl – liší se retailer_name."""

    retailer_name = "kaufland"

    def _flyer_ids(self) -> list[str]:
        """Seznam aktivních letáků pro ČR – zkusí několik známých tvarů."""
        pokusy = [
            f"{API}/flyer.json?region_id=0&retailer_name={self.retailer_name}",
            f"{API}/flyers?country_code=CZ&retailer_name={self.retailer_name}",
            f"{API}/flyers?retailer_name={self.retailer_name}",
        ]
        for url in pokusy:
            data = self._get_json(url)
            if not data:
                continue
            ids = []
            for polozka in _nabidky(data):
                if isinstance(polozka, dict):
                    for k in ("flyer_identifier", "id", "identifier"):
                        v = polozka.get(k)
                        if v and str(v).isdigit():
                            ids.append(str(v))
                            break
            if ids:
                return ids[:3]  # aktuální + případně leták na další týden
        log.warning("%s: žádný leták nenalezen přes Schwarz API", self.obchod)
        return []

    def _nabidky_letaku(self, flyer_id: str) -> Iterator[Nabidka]:
        url = f"{API}/flyer?flyer_identifier={flyer_id}&region_id=0"
        data = self._get_json(url)
        if not data:
            return
        flyer = data.get("flyer") if isinstance(data, dict) else None
        hlavicka = flyer if isinstance(flyer, dict) else (data if isinstance(data, dict) else {})
        for offer in _nabidky(data):
            if not isinstance(offer, dict):
                continue
            nazev = _nazev(offer)
            if not nazev:
                continue
            cena = _cislo(
                offer.get("price") or offer.get("current_price")
                or offer.get("offer_price") or offer.get("priceNow")
            )
            puvodni = _cislo(
                offer.get("priceWas") or offer.get("price_was")
                or offer.get("original_price") or offer.get("base_price")
                or offer.get("priceBefore")
            )
            plny = f"{nazev} {_popis(offer)}".strip()
            n = self._nabidka(
                plny, cena, puvodni,
                ean=offer.get("ean") or offer.get("product_id"),
                obrazek=_obrazek(offer),
                platnost_do=_platnost(hlavicka, offer),
            )
            if n:
                self.nalezeno += 1
                yield n

    def stahni_slevy(self) -> Iterator[Nabidka]:
        for fid in self._flyer_ids():
            yield from self._nabidky_letaku(fid)


class KauflandScraper(SchwarzLetakScraper):
    obchod = "Kaufland"
    retailer_name = "kaufland"


class LidlScraper(SchwarzLetakScraper):
    obchod = "Lidl"
    retailer_name = "lidl"
