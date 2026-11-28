"""OpenFoodFacts baseline import českého trhu → foods.

Stáhne produkty prodávané v ČR (countries tag `en:czechia`, preferuje EAN-13
s prefixem 859) a idempotentně je zapíše do `foods`:

- shoda dle EAN → PATCH makro/značky/vlákniny/balení (zdrojem pravdy je OFF)
- nové produkty → INSERT; kolize názvu se přeskočí (nechceme duplicity)
- výživové sanity: P+C+F > 105 g/100 g nebo chybějící kcal → přeskočit + log

Spuštění:
    python -m scraper.off_import [--limit N] [--dry-run] [--stranek K]

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (service role bypassuje RLS).
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
import os
import time
import unicodedata

import requests

from .db import _req

log = logging.getLogger("off_import")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl"
OFF_FIELDS = (
    "code,product_name,product_name_cs,brands,nutriments,quantity,"
    "image_small_url,allergens_tags,traces_tags,countries_tags"
)
PAGE_SIZE = 200

# OFF allergens_tags → foods.alergeny (EU-14 klíče jako v katalogu)
ALERGEN_MAP = {
    "en:gluten": "lepek", "en:crustaceans": "korisi", "en:eggs": "vejce",
    "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
    "en:milk": "mleko", "en:nuts": "orisky", "en:celery": "skorocel",
    "en:mustard": "horcice", "en:sesame-seeds": "sezam",
    "en:sulphur-dioxide-and-sulphites": "sulfit", "en:lupin": "lupina",
    "en:molluscs": "vodnany",
}

# referenční katalogové ceny Kč/100 g (fallback bezna_cena – NENÍ živá cena;
# stejná konvence jako migrace 0040, UI ji ukazuje jako „typická")
CENA_REF = {
    "maso_ryby": 12.0, "mlecne_vyrobky": 8.0, "ovoce_zelenina": 6.0,
    "peckoviny_obily": 6.0, "suchary_testoviny": 6.0, "napoje": 4.0,
    "ostatni": 8.0,
}


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def _cislo(v: object) -> float | None:
    try:
        n = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def _kategorie(nazev: str) -> str:
    n = _norm(nazev)
    if re.search(r"(energy|cola|pepsi|kofola|fanta|sprite|tonic|dzus|juice|nektar|ice tea|"
                 r"mineralka|mattoni|voda|napoj|drink|pivo|radler|beer|cider|kefir|ice coffee)", n):
        return "napoje"
    if re.search(r"(jogurt|tvaroh|syr|sýr|mleko|mléko|smetana|maslo|máslo|skyr|kefir|pudink|"
                 r"mozzarell|eidam|hermelin|balkansky|butter|cheese|yogurt|protein drink)", n):
        return "mlecne_vyrobky"
    if re.search(r"(kureci|kruti|hovezi|veprove|maso|prsa|ryba|losos|tresk|tunak|sardink|"
                 r"salam|sunka|parek|mlete|steak|uzenin|klobasa|krab|chicken|beef|pork|turkey)", n):
        return "maso_ryby"
    if re.search(r"(jablko|banan|pomeranc|hruska|brosk|merunka|svestka|hrusk|jahod|malin|boruvk|"
                 r"meloun|hrozn|kiwi|mango|ananas|avokad|citron|mrkev|brambor|cibul|rajc|paprik|"
                 r"okurk|brokolic|kvetak|spenat|salat|zelenin|ovoce|apple|banana|potato|tomato)", n):
        return "ovoce_zelenina"
    if re.search(r"(chleb|rohlik|houska|zeml|toast|pecivo|mouka|vlocky|musli|granola|bread|"
                 r"kaise|ovesn|pseni|zitn|cereali)", n):
        return "peckoviny_obily"
    if re.search(r"(ryz|testovin|spaghet|nudle|kuskus|bulgur|pohank|quino|cocka|fazole|hrach|"
                 r"cizrn|susenky|susen|piškot|tycink|cornflakes|rice|pasta|lentil)", n):
        return "suchary_testoviny"
    return "ostatni"


def _baleni(quantity: str | None) -> tuple[float, str]:
    """OFF quantity („500 g“, „1 l“, „6 x 33 cl“) → (gramáž/ml, label)."""
    if not quantity:
        return 100.0, "Balení"
    q = quantity.lower().strip()
    m = re.search(r"(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|g|l)\b", q)
    if m:
        kusy, val, unit = int(m.group(1)), float(m.group(2).replace(",", ".")), m.group(3)
        base = val * {"cl": 10, "ml": 1, "g": 1, "l": 1000}[unit]
        return float(kusy * base), "Balení"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b", q)
    if m:
        val, unit = float(m.group(1).replace(",", ".")), m.group(2)
        gramy = val * {"kg": 1000, "g": 1, "l": 1000, "cl": 10, "ml": 1}[unit]
        if gramy < 5:  # „0,5 g“ artefakt – raději fallback
            return 100.0, "Balení"
        label = "Láhev" if unit in ("l", "cl", "ml") else "Balení"
        return gramy, label
    return 100.0, "Balení"


def parsuj_produkt(p: dict) -> dict | None:
    """OFF produkt → foods řádek; None = nepoužitelný (chybí nutriky/název)."""
    nutri = p.get("nutriments") or {}
    kcal = _cislo(nutri.get("energy-kcal_100g"))
    b = _cislo(nutri.get("proteins_100g"))
    c = _cislo(nutri.get("carbohydrates_100g"))
    t = _cislo(nutri.get("fat_100g"))
    if kcal is None or b is None or c is None or t is None:
        return None
    if b + c + t > 105:  # fyzikálně nemožné – stejná brzda jako generátor
        return None
    nazev = (p.get("product_name_cs") or p.get("product_name") or "").strip()
    if len(nazev) < 3:
        return None
    vlaknina = _cislo(nutri.get("fiber_100g"))
    gramy, label = _baleni(p.get("quantity"))
    kat = _kategorie(nazev)
    alergeny = sorted({ALERGEN_MAP[a] for a in (p.get("allergens_tags") or []) if a in ALERGEN_MAP})
    stopy = sorted({ALERGEN_MAP[a] for a in (p.get("traces_tags") or []) if a in ALERGEN_MAP}
                   - set(alergeny))
    ean = (p.get("code") or "").strip() or None
    if ean and not (8 <= len(ean) <= 14 and ean.isdigit()):
        ean = None
    return {
        "nazev": nazev[:200],
        "kategorie": kat,
        "bilkoviny": round(b, 2),
        "sacharidy": round(c, 2),
        "tuky": round(t, 2),
        "kalorie": round(kcal, 2),
        "vlaknina": round(vlaknina, 2) if vlaknina is not None else None,
        "bezna_cena": CENA_REF[kat],
        "baleni_g": gramy,
        "baleni_label": label,
        "ean": ean,
        "znacka": (p.get("brands") or "").split(",")[0].strip()[:100] or None,
        "obrazek": p.get("image_small_url") or None,
        "alergeny": alergeny,
        "alergeny_stopy": stopy,
        "zdroj": "openfoodfacts",
        "schvaleno": True,
    }


def je_cesky(p: dict) -> bool:
    """EAN-13 s prefixem 859 nebo countries tag en:czechia."""
    ean = (p.get("code") or "")
    if ean.startswith("859"):
        return True
    tagy = p.get("countries_tags") or []
    return "en:czech-republic" in tagy or "en:czechia" in tagy


def stahni_stranku(stranka: int) -> list[dict]:
    params = {
        "action": "process",
        "tagtype_0": "countries",
        "tag_contains_0": "contains",
        "tag_0": "czechia",
        "page_size": str(PAGE_SIZE),
        "page": str(stranka),
        "json": "1",
        "fields": OFF_FIELDS,
    }
    r = _req("get", OFF_URL, params=params, timeout=60,
             headers={"User-Agent": "OptiMeal/1.0 (nutrition import; github/vestyxdev)"})
    r.raise_for_status()
    return (r.json() or {}).get("products") or []


def _hlavicky() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "authorization": f"Bearer {SUPABASE_KEY}",
        "content-type": "application/json",
        "prefer": "return=minimal",
    }


def nacti_existujici() -> tuple[dict[str, dict], dict[str, dict]]:
    """(ean → řádek, norm-název → řádek) existujících potravin."""
    url = f"{SUPABASE_URL}/rest/v1/foods"
    headers = {**_hlavicky(), "prefer": "count=none"}
    ean_map: dict[str, dict] = {}
    nazev_map: dict[str, dict] = {}
    offset = 0
    while True:
        params = {
            "select": "id,nazev,ean",
            "limit": "1000",
            "offset": str(offset),
        }
        r = _req("get", url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        for row in rows:
            if row.get("ean"):
                ean_map[row["ean"]] = row
            nazev_map[_norm(row["nazev"])] = row
        if len(rows) < 1000:
            break
        offset += 1000
    return ean_map, nazev_map


def importuj(limit: int | None = None, dry_run: bool = False, stranek: int = 9999,
             tempo: float = 3.0) -> dict:
    """Hlavní běh. Vrací počty pro log/test.

    `tempo` = pauza mezi stránkami v sekundách – OFF agresivně throttluje
    (503), bez ohleduplného tempa sklizeň po pár stránkách umře.
    """
    if not dry_run and (not SUPABASE_URL or not SUPABASE_KEY):
        raise RuntimeError("Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
    ean_map, nazev_map = ({}, {}) if dry_run else nacti_existujici()
    log.info("Existující katalog: %d EAN, %d názvů", len(ean_map), len(nazev_map))

    stav = {"stazeno": 0, "preskoceno_neize": 0, "bez_nutric": 0,
            "aktualizovano": 0, "vlozeno": 0, "kolize_nazvu": 0, "chyb": 0}
    url = f"{SUPABASE_URL}/rest/v1/foods"
    headers = _hlavicky()

    stranka = 1
    hotovo = False
    zasebou_chyb = 0
    while not hotovo and stranka <= stranek:
        try:
            produkty = stahni_stranku(stranka)
            zasebou_chyb = 0
        except Exception as e:  # noqa: BLE001 – síťové chyby logujeme a končíme
            log.error("Stránka %d se nepodařila: %s", stranka, e)
            stav["chyb"] += 1
            zasebou_chyb += 1
            if zasebou_chyb >= 3:
                log.error("Tři stránky po sobě nedostupné – OFF throttluje, končím.")
                break
            time.sleep(30 * zasebou_chyb)  # backoff přes throttling
            continue
        if not produkty:
            break
        for p in produkty:
            if limit is not None and stav["stazeno"] >= limit:
                hotovo = True
                break
            stav["stazeno"] += 1
            if not je_cesky(p):
                stav["preskoceno_neize"] += 1
                continue
            radek = parsuj_produkt(p)
            if radek is None:
                stav["bez_nutric"] += 1
                continue
            if dry_run:
                continue
            ean = radek["ean"]
            try:
                if ean and ean in ean_map:
                    fid = ean_map[ean]["id"]
                    patch = {k: v for k, v in radek.items()
                             if k in ("bilkoviny", "sacharidy", "tuky", "kalorie", "vlaknina",
                                      "znacka", "baleni_g", "baleni_label", "obrazek",
                                      "alergeny", "alergeny_stopy", "kategorie") and v is not None}
                    pr = _req("patch", url, headers=headers,
                              params={"id": f"eq.{fid}"}, json=patch, timeout=30)
                    if pr.status_code < 300:
                        stav["aktualizovano"] += 1
                elif _norm(radek["nazev"]) in nazev_map:
                    stav["kolize_nazvu"] += 1
                else:
                    ir = _req("post", url, headers=headers, json=radek, timeout=30)
                    if ir.status_code < 300:
                        stav["vlozeno"] += 1
                        nazev_map[_norm(radek["nazev"])] = {"id": None, "nazev": radek["nazev"]}
                        if ean:
                            ean_map[ean] = {"id": None, "nazev": radek["nazev"]}
                    elif ir.status_code == 409:
                        stav["kolize_nazvu"] += 1
                    else:
                        log.warning("INSERT %s → %s %s", radek["nazev"], ir.status_code, ir.text[:120])
                        stav["chyb"] += 1
            except requests.RequestException as e:
                log.warning("Síťová chyba u %s: %s", radek["nazev"], e)
                stav["chyb"] += 1
        log.info("Stránka %d hotova: vloženo celkem %d", stranka, stav["vlozeno"])
        # Konec stránkování poznáme z PRÁZDNÉ stránky, ne z len < PAGE_SIZE –
        # OFF server-side cappuje page_size na 100 (my žádáme 200), takže
        # len(produkty) < PAGE_SIZE platí od první stránky a sklizeň by se
        # po ní zastavila (bug 2026-11-28: jen 100 produktů místo ~20k).
        if len(produkty) < 100:
            break
        stranka += 1
        if tempo > 0:
            time.sleep(tempo)
    return stav


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="OFF import českého trhu → foods")
    ap.add_argument("--limit", type=int, default=None, help="max zpracovaných produktů")
    ap.add_argument("--dry-run", action="store_true", help="jen stáhne a parsuje, nic nezapisuje")
    ap.add_argument("--stranek", type=int, default=9999, help="max stránek OFF (200/stránka)")
    ap.add_argument("--tempo", type=float, default=3.0, help="pauza mezi stránkami v s (OFF throttling)")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    stav = importuj(limit=args.limit, dry_run=args.dry_run, stranek=args.stranek, tempo=args.tempo)
    log.info(
        "HOTOVO: staženo %(stazeno)d · aktualizováno %(aktualizovano)d · vloženo %(vlozeno)d · "
        "kolize %(kolize_nazvu)d · bez nutric %(bez_nutric)d · nečeské %(preskoceno_neize)d · chyby %(chyb)d",
        stav,
    )
    return 0 if stav["chyb"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
