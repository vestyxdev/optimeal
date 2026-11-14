"""Open Prices (Open Food Facts) – české ceny přes veřejné API.

https://prices.openfoodfacts.org/api/docs
Reálné uživateli nahrané ceny s dokladem; čteme jen stránky a filtrujeme
na ČR (osm_address_country_code == 'CZ').
"""

from __future__ import annotations

import logging
import time
from typing import Iterator

import requests

from .normalizace import cena_za_100g, mnozstvi_v_gramech, obchod_z_location

API = "https://prices.openfoodfacts.org/api/v1/prices"
HLAVICKA = {"User-Agent": "OptiMeal/2.0 (https://github.com/vestyxdev/optimeal)"}

log = logging.getLogger("scraper.open_prices")


POKUSY = 3  # transientní chyby (5xx, timeout) zkusíme znovu s backoffem


def _stahni_stranku(stranka: int) -> dict | None:
    """Stáhne jednu stránku API s retry; po vyčerpání pokusů vrátí None.

    Nepropaguje výjimku – jedna vadná stránka nesmí shodit celý ingest.
    """
    for pokus in range(1, POKUSY + 1):
        try:
            odpoved = requests.get(
                API,
                params={"size": 100, "page": stranka},
                headers=HLAVICKA,
                timeout=30,
            )
            odpoved.raise_for_status()
            return odpoved.json()
        except requests.RequestException as e:
            cekani = 2**pokus
            log.warning(
                "Stránka %d: pokus %d/%d selhal (%s), čekám %d s",
                stranka, pokus, POKUSY, e.__class__.__name__, cekani,
            )
            time.sleep(cekani)
    log.error("Stránka %d se nepodařila stáhnout – přeskakuji", stranka)
    return None


def stahni_ceny_cz(max_stranek: int = 10, kurz_eur: float = 25.5) -> Iterator[dict]:
    """Iteruje normalizované záznamy pro české obchody.

    Každá položka: {ean, nazev_produktu, obchod, cena_za_100g, je_sleva, datum}
    """
    for stranka in range(1, max_stranek + 1):
        data = _stahni_stranku(stranka)
        if data is None:
            continue
        polozky = data.get("items") or []
        if not polozky:
            break

        for item in polozky:
            lokace = item.get("location") or {}
            if lokace.get("osm_address_country_code") != "CZ":
                continue
            produkt = item.get("product") or {}
            ean = item.get("product_code") or produkt.get("code")
            gramy = mnozstvi_v_gramech(produkt)
            cena100 = cena_za_100g(
                item.get("price"),
                item.get("price_per"),
                gramy,
                item.get("currency") or "CZK",
                kurz_eur,
            )
            if cena100 is None:
                continue
            obchod = obchod_z_location(lokace)
            if not obchod:
                continue
            yield {
                "ean": ean,
                "nazev_produktu": item.get("product_name") or produkt.get("product_name") or "",
                "obchod": obchod,
                "cena_za_100g": cena100,
                "je_sleva": bool(item.get("price_is_discounted")),
                "datum": item.get("date"),
            }
        # slušné tempo vůči API
        time.sleep(0.5)


def kurz_eur_cnb() -> float:
    """Aktuální kurz EUR/CZK z ČNB denního kurzovního lístku."""
    try:
        r = requests.get(
            "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/denni-kurz.txt",
            timeout=15,
        )
        for radek in r.text.splitlines():
            if radek.startswith("EMU"):
                return float(radek.split("|")[-1].replace(",", "."))
    except Exception as e:  # noqa: BLE001 – kurz je best-effort
        log.warning("Kurz ČNB se nepodařilo načíst, použiji výchozí: %s", e)
    return 25.5
