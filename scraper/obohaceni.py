"""Obohacení katalogu z Open Food Facts (cz.openfoodfacts.org).

python -m scraper.obohaceni [--limit N] [--vse]

Cíl: foods zdroj='eshop:*' se schvaleno=false (založené asortimentním
scraperem bez maker) a foods s kalorie=0. Postup pro každou potravinu:

1. EAN → GET /api/v2/product/{ean}.json (nejspolehlivější shoda)
2. jinak → GET /cgi/search.pl?search_terms=<název>&country=česko
   a vezmeme prvního kandidáta s vyplněnými nutriments.

Z OFF doplníme: kalorie, bilkoviny, sacharidy, tuky (per 100 g),
ean, obrazek, případně alergeny (allergens_tags → české klíče).
Když makra dopadnou (>0 kcal), přepneme schvaleno=true.

Tempo ~1 req/s – OFF prosí o slušné zacházení.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
import unicodedata

import requests

log = logging.getLogger("scraper.obohaceni")

OFF = "https://cz.openfoodfacts.org"
UA = {"User-Agent": "OptiMeal/2.0 (katalog enrichment; https://github.com/vestyxdev/optimeal)"}
PAUZA = 1.1

ALERGENY_MAPA = {
    "en:gluten": "lepek", "en:milk": "mleko", "en:eggs": "vejce",
    "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
    "en:nuts": "orisky", "en:celery": "zeler", "en:mustard": "horcice",
    "en:sesame-seeds": "sezam", "en:sulphur-dioxide-and-sulphites": "sirocitany",
    "en:lupin": "vlci-bob", "en:molluscs": "mekkysi",
    "en:crustaceans": "korysi",
}


def _nutri(produkt: dict) -> dict | None:
    n = produkt.get("nutriments") or {}
    kcal = n.get("energy-kcal_100g") or n.get("energy-kcal_value") or 0
    b = n.get("proteins_100g") or 0
    s = n.get("carbohydrates_100g") or 0
    t = n.get("fat_100g") or 0
    if not kcal:
        return None
    return {"kalorie": round(float(kcal), 1), "bilkoviny": round(float(b), 1),
            "sacharidy": round(float(s), 1), "tuky": round(float(t), 1)}


def _bez_diakritiky(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").lower()


def off_ean(ean: str) -> dict | None:
    try:
        r = requests.get(f"{OFF}/api/v2/product/{ean}.json",
                         params={"fields": "code,product_name,nutriments,image_url,allergens_tags"},
                         headers=UA, timeout=20)
        if r.ok and r.json().get("status") == 1:
            return r.json()["product"]
    except requests.RequestException as e:
        log.warning("OFF ean %s selhal: %s", ean, e.__class__.__name__)
    return None


def _prekryv(cil: str, jmeno: str) -> float:
    """Podíl tokenů názvu pokrytých v OFF jménu (0–1)."""
    ct = {t for t in _bez_diakritiky(cil).split() if len(t) > 1}
    if not ct:
        return 0.0
    jt = set(_bez_diakritiky(jmeno).split())
    return len(ct & jt) / len(ct)


def off_hledat(nazev: str) -> dict | None:
    """Jmenové hledání – bere jen kandidáty s ≥60% překryvem tokenů,
    jinak by slabá shoda automaticky schválila špatná makra."""
    try:
        r = requests.get(f"{OFF}/cgi/search.pl", params={
            "search_terms": nazev, "search_simple": 1, "action": "process",
            "json": 1, "page_size": 5, "cc": "cz",
            "fields": "code,product_name,nutriments,image_url,allergens_tags",
        }, headers=UA, timeout=20)
        if not r.ok:
            return None
        nej, nej_skore = None, 0.6
        for p in (r.json().get("products") or []):
            jmeno = p.get("product_name") or ""
            if not jmeno or not _nutri(p):
                continue
            skore = _prekryv(nazev, jmeno)
            if skore >= nej_skore:
                nej, nej_skore = p, skore
        return nej
    except requests.RequestException as e:
        log.warning("OFF hledání '%s' selhalo: %s", nazev[:40], e.__class__.__name__)
    return None


def patch_z_off(food: dict, produkt: dict) -> dict:
    """Sestaví PATCH pro foods z OFF produktu (jen prázdná pole)."""
    patch: dict = {}
    nutri = _nutri(produkt)
    if nutri and (not food.get("kalorie") or float(food.get("kalorie") or 0) <= 0):
        patch.update(nutri)
        patch["schvaleno"] = True
    if produkt.get("code") and not food.get("ean"):
        patch["ean"] = produkt["code"]
    if produkt.get("image_url") and not food.get("obrazek"):
        patch["obrazek"] = produkt["image_url"]
    tags = produkt.get("allergens_tags") or []
    nove = sorted({ALERGENY_MAPA[t] for t in tags if t in ALERGENY_MAPA})
    if nove and not food.get("alergeny"):
        patch["alergeny"] = nove
    return patch


def main() -> int:
    parser = argparse.ArgumentParser(prog="optimeal-obohaceni")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--vse", action="store_true",
                        help="i schválené potraviny s kalorie=0")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    url = os.environ["SUPABASE_URL"].strip().rstrip("/")
    klic = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": klic, "Authorization": f"Bearer {klic}",
         "Content-Type": "application/json"}

    # cílové potraviny: neschválené z eshopů + schválené s kalorie=0
    params: dict = {
        "select": "id,nazev,ean,obrazek,alergeny,kalorie,zdroj",
        "limit": args.limit,
        "order": "vytvoreno.asc",
    }
    if args.vse:
        params["or"] = "(schvaleno.eq.false,kalorie.eq.0)"
    else:
        params["schvaleno"] = "eq.false"
    r = requests.get(f"{url}/rest/v1/foods", headers=h, params=params, timeout=30)
    r.raise_for_status()
    foods = r.json()
    log.info("K obohacení: %d potravin", len(foods))

    doplneno = schvaleno = 0
    for food in foods:
        produkt = off_ean(food["ean"]) if food.get("ean") else None
        if not produkt:
            time.sleep(PAUZA)
            produkt = off_hledat(food["nazev"])
        time.sleep(PAUZA)
        if not produkt:
            continue
        patch = patch_z_off(food, produkt)
        if not patch:
            continue
        if args.dry_run:
            log.info("DRY %s ← %s", food["nazev"][:50], list(patch))
            doplneno += 1
            continue
        pr = requests.patch(
            f"{url}/rest/v1/foods", headers=h,
            params={"id": f"eq.{food['id']}"}, json=patch, timeout=30,
        )
        if pr.ok:
            doplneno += 1
            schvaleno += 1 if patch.get("schvaleno") else 0
        else:
            log.warning("PATCH %s selhal: %s", food["id"], pr.text[:120])

    log.info("Hotovo: doplněno %d, schváleno %d z %d", doplneno, schvaleno, len(foods))
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(name)s: %(message)s")
    sys.exit(main())
