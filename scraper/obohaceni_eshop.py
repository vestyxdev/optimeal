"""Obohacení eshopových potravin o nutriční hodnoty přímo ze zdroje.

OFF name-search pro privátní značky nefunguje (nejsou v korpusu,
EAN eshopy neposkytují) – oba eshopy ale nutriční tabulku mají:

  Rohlík.cz: GET https://www.rohlik.cz/{productId} – stránka nese
      embedded JSON "nutritionalValues" s hodnotami za 100 g
      (energyKCal / protein / carbohydrates / fats / …).
  Košík.cz:  GET /api/front/product/{id} – product.nutritionalValues
      .values (řádky podle názvu) + parameterGroups["Alergeny"].

ProductId drží foods.externi_id (migrace 0044; scraper ho plní
z Nabidka.extra, backfill z URL obrázku u Rohlíku).

Spouští se po asortimentním scrapu (nové potraviny dostanou makra hned)
i samostatně:  python -m scraper.obohaceni_eshop --limit 3000 [--dry]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import time

import requests

log = logging.getLogger("scraper.obohaceni_eshop")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

ROHLIK_URL = "https://www.rohlik.cz"
KOSIK_API = "https://www.kosik.cz/api/front"
PAUZA = 0.45

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
}

# Košík uvádí alergeny česky v parameterGroups – mapování na naše kódy
ALERGEN_MAPA = {
    "lepek": "lepek", "korýši": "korisi", "vejce": "vejce", "ryby": "ryby",
    "arašídy": "arasidy", "sója": "soja", "soja": "soja", "mléko": "mleko",
    "mleko": "mleko", "ořechy": "orisky", "skořápkové plody": "orisky",
    "celer": "skorocel", "hořčice": "horcice", "sezam": "sezam",
    "oxid siřičitý": "sulfit", "siřičitany": "sulfit", "lupina": "lupina",
    "měkkýši": "vodnany",
}

# Názvy řádků košíkové nutriční tabulky → foods sloupce
KOSIK_RADKY = {
    "tuky": "tuky", "sacharidy": "sacharidy", "bílkoviny": "bilkoviny",
    "bilkoviny": "bilkoviny",
}


def _get(session: requests.Session, url: str, pokusy: int = 3) -> requests.Response | None:
    for i in range(pokusy):
        try:
            r = session.get(url, timeout=30)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 + 3 * i)
                continue
            return r
        except requests.RequestException as e:
            log.warning("GET %s selhal (%d. pokus): %s", url, i + 1, e)
            time.sleep(2 + 3 * i)
    return None


def _extrahuj_pole_json(text: str, klic: str) -> list | None:
    """Vytáhne JSON pole začínající za '"klic":' – bracket matching
    se stringy, ne regex (uvozovky/hranaté závorky v datech by rozbily
    non-greedy parsování)."""
    i = text.find(f'"{klic}"')
    if i < 0:
        return None
    j = text.find("[", i)
    if j < 0:
        return None
    hloubka, ve_stringu, escape = 0, False, False
    for k in range(j, len(text)):
        znak = text[k]
        if ve_stringu:
            if escape:
                escape = False
            elif znak == "\\":
                escape = True
            elif znak == '"':
                ve_stringu = False
            continue
        if znak == '"':
            ve_stringu = True
        elif znak == "[":
            hloubka += 1
        elif znak == "]":
            hloubka -= 1
            if hloubka == 0:
                try:
                    return json.loads(text[j : k + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _cislo(v) -> float | None:
    try:
        c = float(v)
        return c if c >= 0 else None
    except (TypeError, ValueError):
        return None


def makra_z_rohliku(html: str) -> dict | None:
    """nutritionalValues[0].values → {kalorie, bilkoviny, sacharidy, tuky}
    za 100 g. None když pole chybí nebo je prázdné."""
    pole = _extrahuj_pole_json(html, "nutritionalValues")
    if not pole:
        return None
    values = pole[0].get("values") or {}
    kcal = _cislo((values.get("energyKCal") or {}).get("amount"))
    b = _cislo((values.get("protein") or {}).get("amount"))
    s = _cislo((values.get("carbohydrates") or {}).get("amount"))
    t = _cislo((values.get("fats") or {}).get("amount"))
    if kcal is None and b is None and s is None and t is None:
        return None
    # sanity: za 100 g je kcal ≤ ~900, makra ≤ 100 – mimo to = parse chyba
    if (kcal or 0) > 900 or max(b or 0, s or 0, t or 0) > 100:
        return None
    return {
        "kalorie": round(kcal or 0),
        "bilkoviny": b or 0,
        "sacharidy": s or 0,
        "tuky": t or 0,
    }


def makra_z_kosiku(produkt: dict) -> tuple[dict | None, list[str]]:
    """product.detail.nutritionalValues.values → makra; parameterGroups
    [Alergeny] → seznam kódů. Řádky se řídí českým title + unit."""
    detail = produkt.get("detail") or produkt
    nv = (detail.get("nutritionalValues") or {}).get("values") or []
    kcal = None
    makra: dict = {}
    for radek in nv:
        title = (radek.get("title") or "").strip().lower()
        unit = (radek.get("unit") or "").strip().lower()
        hodnota = _cislo(radek.get("value"))
        if hodnota is None:
            continue
        if title.startswith("energetická") and unit in ("kcal", "kcal."):
            kcal = hodnota
        elif title in KOSIK_RADKY:
            makra[KOSIK_RADKY[title]] = hodnota

    alergeny: list[str] = []
    for skupina in detail.get("parameterGroups") or []:
        if (skupina.get("title") or "").strip().lower() != "alergeny":
            continue
        for item in skupina.get("items") or []:
            if (item.get("value") or "").strip().lower() not in ("ano", "yes"):
                continue
            kod = ALERGEN_MAPA.get((item.get("title") or "").strip().lower())
            if kod and kod not in alergeny:
                alergeny.append(kod)

    if kcal is None and not makra:
        return None, alergeny
    if (kcal or 0) > 900 or max(makra.values(), default=0) > 100:
        return None, alergeny
    return {
        "kalorie": round(kcal or 0),
        "bilkoviny": makra.get("bilkoviny", 0),
        "sacharidy": makra.get("sacharidy", 0),
        "tuky": makra.get("tuky", 0),
    }, alergeny


def _kandidati(hlavicky: dict, url: str, limit: int) -> list[dict]:
    """Potraviny z eshopů bez makr, které mají externi_id."""
    kandidati: list[dict] = []
    offset = 0
    while len(kandidati) < limit:
        r = requests.get(
            f"{url}/rest/v1/foods",
            headers=hlavicky,
            params={
                "select": "id,nazev,externi_id,zdroj",
                "kalorie": "eq.0",
                "externi_id": "not.is.null",
                "zdroj": "like.eshop:*",
                "order": "vytvoreno.desc",
                "offset": offset,
                "limit": min(1000, limit - len(kandidati)),
            },
            timeout=30,
        )
        r.raise_for_status()
        davka = r.json()
        kandidati.extend(davka)
        if len(davka) < 1000:
            break
        offset += 1000
    return kandidati


def _patch(hlavicky: dict, url: str, food_id: str, payload: dict) -> bool:
    r = requests.patch(
        f"{url}/rest/v1/foods",
        headers={**hlavicky, "Prefer": "return=minimal"},
        params={"id": f"eq.{food_id}"},
        json=payload,
        timeout=30,
    )
    if not r.ok:
        log.warning("PATCH %s → %d %s", food_id, r.status_code, r.text[:200])
    return r.ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--dry", action="store_true",
                    help="jen vypsat naměřené hodnoty, nezapisovat")
    args = ap.parse_args()

    url = os.environ["SUPABASE_URL"].strip().rstrip("/")
    klic = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    hlavicky = {"apikey": klic, "Authorization": f"Bearer {klic}",
                "Content-Type": "application/json"}

    kandidati = _kandidati(hlavicky, url, args.limit)
    log.info("K obohacení: %d eshopových potravin bez makr", len(kandidati))

    session = requests.Session()
    session.headers.update(UA)

    stat = {"rohlik": 0, "kosik": 0, "bez_dat": 0, "chyby": 0, "alergeny": 0}
    for i, f in enumerate(kandidati):
        eid = str(f.get("externi_id") or "").strip()
        zdroj = (f.get("zdroj") or "").lower()
        if not eid:
            stat["chyby"] += 1
            continue
        if "rohl" in zdroj:
            r = _get(session, f"{ROHLIK_URL}/{eid}")
            if r is None or not r.ok:
                stat["chyby"] += 1
                time.sleep(PAUZA)
                continue
            makra = makra_z_rohliku(r.text)
            alergeny: list[str] = []
            stat_key = "rohlik"
        elif "košík" in zdroj or "kosik" in zdroj:
            r = _get(session, f"{KOSIK_API}/product/{eid}")
            if r is None or not r.ok:
                stat["chyby"] += 1
                time.sleep(PAUZA)
                continue
            try:
                produkt = r.json().get("product") or {}
            except json.JSONDecodeError:
                stat["chyby"] += 1
                time.sleep(PAUZA)
                continue
            makra, alergeny = makra_z_kosiku(produkt)
            stat_key = "kosik"
        else:
            stat["chyby"] += 1
            continue

        if makra is None:
            stat["bez_dat"] += 1
        else:
            if args.dry:
                log.info("[dry] %s ← %s: %s", f["nazev"][:50], eid, makra)
                stat[stat_key] += 1
            else:
                payload = dict(makra)
                if alergeny:
                    payload["alergeny"] = alergeny
                if _patch(hlavicky, url, f["id"], payload):
                    stat[stat_key] += 1
                    if alergeny:
                        stat["alergeny"] += 1
                else:
                    stat["chyby"] += 1
        if (i + 1) % 50 == 0:
            log.info("…%d/%d (rohlík %d, košík %d, bez dat %d, chyby %d)",
                     i + 1, len(kandidati), stat["rohlik"], stat["kosik"],
                     stat["bez_dat"], stat["chyby"])
        time.sleep(PAUZA)

    log.info("Hotovo: rohlík %d, košík %d, alergeny %d, bez dat %d, chyby %d",
             stat["rohlik"], stat["kosik"], stat["alergeny"],
             stat["bez_dat"], stat["chyby"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
