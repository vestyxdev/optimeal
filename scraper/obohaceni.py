"""Obohacení katalogu z Open Food Facts (cz.openfoodfacts.org).

python -m scraper.obohaceni [--limit N] [--vse]

Cíl: foods s kalorie=0 nebo schvaleno=false – eshopové potraviny se
zakládají schválené s nulovými makry, takže sem padají přes kalorie=0.
Postup pro každou potravinu:

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
# OFF dokumentované limity: ~100 req/min product API, ~10 req/min
# search.pl. Položka bez EANu jede search → tempo musí být ~6,5 s,
# jinak chytáme 503 (dřív PAUZA=1,1 → ~55 req/min = permanentní blok)
PAUZA = 6.5

ALERGENY_MAPA = {
    "en:gluten": "lepek", "en:milk": "mleko", "en:eggs": "vejce",
    "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
    "en:nuts": "orisky", "en:celery": "zeler", "en:mustard": "horcice",
    "en:sesame-seeds": "sezam", "en:sulphur-dioxide-and-sulphites": "sirocitany",
    "en:lupin": "vlci-bob", "en:molluscs": "mekkysi",
    "en:crustaceans": "korysi",
}


STATS = {"chyby": 0}


def _off_get(url: str, params: dict) -> dict | None:
    """GET na OFF s retry při 429/5xx – OFF z datacenter IP throttluje
    agresivně; bez retry se položka spálí jako „bez shody", i když
    šlo jen o přetížení API."""
    for pokus in range(4):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=20)
        except requests.RequestException as e:
            if pokus == 3:
                log.warning("OFF %s selhal: %s", url.split("/")[-1][:40],
                            e.__class__.__name__)
                STATS["chyby"] += 1
                return None
            time.sleep(2**pokus)
            continue
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(min(5 * (2**pokus), 60))
            continue
        if not r.ok:
            STATS["chyby"] += 1
            return None
        try:
            return r.json()
        except ValueError:
            STATS["chyby"] += 1
            return None
    STATS["chyby"] += 1
    return None


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
    d = _off_get(f"{OFF}/api/v2/product/{ean}.json",
                 {"fields": "code,product_name,nutriments,image_url,allergens_tags"})
    if d and d.get("status") == 1:
        return d["product"]
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
    d = _off_get(f"{OFF}/cgi/search.pl", {
        "search_terms": nazev, "search_simple": 1, "action": "process",
        "json": 1, "page_size": 5, "cc": "cz",
        "fields": "code,product_name,nutriments,image_url,allergens_tags",
    })
    if not d:
        return None
    nej, nej_skore = None, 0.6
    for p in (d.get("products") or []):
        jmeno = p.get("product_name") or ""
        if not jmeno or not _nutri(p):
            continue
        skore = _prekryv(nazev, jmeno)
        if skore >= nej_skore:
            nej, nej_skore = p, skore
    return nej


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

    # cílové potraviny: cokoliv bez maker (kalorie=0) nebo neschválené –
    # eshopové řádky se zakládají schválené, takže filtr kalorie=0
    params: dict = {
        "select": "id,nazev,ean,obrazek,alergeny,kalorie,zdroj",
        "limit": args.limit,
        "order": "vytvoreno.asc",
        "or": "(schvaleno.eq.false,kalorie.eq.0)",
    }
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
        if not pr.ok and '"code":"23505"' in pr.text and "ean" in patch:
            # OFF EAN už nese jiná potravina → opakovat bez EANu,
            # ať se makra aspoň zapíší (jinak přijdeme i o ně)
            patch.pop("ean", None)
            pr = requests.patch(
                f"{url}/rest/v1/foods", headers=h,
                params={"id": f"eq.{food['id']}"}, json=patch, timeout=30,
            )
        if pr.ok:
            doplneno += 1
            schvaleno += 1 if patch.get("schvaleno") else 0
        else:
            log.warning("PATCH %s selhal: %s", food["id"], pr.text[:120])

    log.info("Hotovo: doplněno %d, schváleno %d z %d (OFF chyb: %d)",
             doplneno, schvaleno, len(foods), STATS["chyby"])
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(name)s: %(message)s")
    sys.exit(main())
