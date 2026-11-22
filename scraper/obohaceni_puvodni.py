"""Doplňování původních (přeškrtnutých) cen z detailů kupi.cz.

Letákové nabídky bez uváděné % slevy nemají puvodni_cena – kupi.cz
ale na detailu produktu /sleva/<slug> uvádí „běžně stojí X Kč"
(jejich průměrnou běžnou cenu za STEJNÉ balení). Je to reálný
zdrojový údaj – ne odhad – takže ho lze použít jako přeškrtnutou
cenu i pro obchody, které % slevy v letáku neukazují.

Tok:
  price_observations (je_sleva, puvodni_cena IS NULL, kupi_slug,
  baleni_g) → seskupit podle slugu → GET detail → „běžně stojí"
  → puvodni_cena_za_100g = bezna * 100 / baleni_g → PATCH obs.

Spouští se po PriceScraper matici (job „puvodni") i samostatně:
  python -m scraper.obohaceni_puvodni --limit 300 [--dry]
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import time

import requests

from .proxy import aplikuj_proxy

log = logging.getLogger("scraper.obohaceni_puvodni")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

KUPI = "https://www.kupi.cz"
PAUZA = 1.2

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7",
}

# „… polotučné 1 l</strong> běžně stojí <strong class="nowrap">20,23&nbsp;Kč</strong>"
RE_BEZNA = re.compile(
    r"běžně\s+stojí[^<]{0,80}?<[^>]*>\s*([\d\s\xa0]+[,\.]?\d*)\s*(?:&nbsp;|\s|&\w+;)*Kč",
    re.IGNORECASE,
)
# Stejné meze jako view aktualni_ceny: původní musí znamenat aspoň
# ~1 % slevu a nesmí přesáhnout 2,5× akční (nad ~60 % pack-mismatch
# artefakt – „běžně stojí" na detailu patří často většímu balení).
MAX_NASOBEK = 2.5


def _get(session: requests.Session, url: str, pokusy: int = 3,
         headers: dict | None = None) -> requests.Response | None:
    for i in range(pokusy):
        try:
            r = session.get(url, timeout=30, headers=headers)
            if r.status_code in (403, 429, 500, 502, 503, 504):
                time.sleep(3 + 4 * i)
                continue
            return r
        except requests.RequestException as e:
            log.warning("GET %s selhal (%d. pokus): %s", url, i + 1, e)
            time.sleep(3 + 4 * i)
    return None


def bezna_z_detailu(html: str) -> float | None:
    """Z detailu produktu vytáhne „běžně stojí X Kč" (cenu za balení)."""
    m = RE_BEZNA.search(html)
    if not m:
        return None
    try:
        cena = float(m.group(1).replace("\xa0", "").replace(" ", "").replace(",", "."))
        return cena if cena > 0 else None
    except ValueError:
        return None


def _kandidati(hlavicky: dict, url: str, limit: int) -> list[dict]:
    """Aktivní letákové nabídky bez puvodni_cena, se slugem i balením."""
    out: list[dict] = []
    offset = 0
    while len(out) < limit:
        r = requests.get(
            f"{url}/rest/v1/price_observations",
            headers=hlavicky,
            params={
                "select": "id,food_id,cena,baleni_g,kupi_slug",
                "je_sleva": "eq.true",
                "puvodni_cena": "is.null",
                "kupi_slug": "not.is.null",
                "baleni_g": "not.is.null",
                "or": "(platnost_do.is.null,platnost_do.gte.now())",
                "offset": offset,
                "limit": min(1000, limit - len(out)),
            },
            timeout=30,
        )
        r.raise_for_status()
        davka = r.json()
        out.extend(davka)
        if len(davka) < 1000:
            break
        offset += 1000
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=400,
                    help="max unikátních produktových stránek na běh")
    ap.add_argument("--dry", action="store_true",
                    help="jen vypsat naměřené hodnoty, nezapisovat")
    args = ap.parse_args()

    url = os.environ["SUPABASE_URL"].strip().rstrip("/")
    klic = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    hlavicky = {"apikey": klic, "Authorization": f"Bearer {klic}",
                "Content-Type": "application/json"}

    kandidati = _kandidati(hlavicky, url, args.limit * 4)
    if not kandidati:
        log.info("Žádné nabídky k dohledání")
        return 0

    # slug → obs řádky; každý produkt stáhneme jednou
    podle_slugu: dict[str, list[dict]] = {}
    for o in kandidati:
        podle_slugu.setdefault(o["kupi_slug"], []).append(o)
    slugy = list(podle_slugu)[: args.limit]
    log.info("K dohledání: %d nabídek / %d unikátních produktů",
             len(kandidati), len(slugy))

    session = requests.Session()
    session.headers.update(UA)
    aplikuj_proxy(session, "obohaceni_puvodni")
    # ohřátí session – stejná taktika jako kupi scraper (403 na studený request)
    _get(session, f"{KUPI}/", ) or _get(session, f"{KUPI}/")

    stat = {"cen": 0, "patch": 0, "bez_dat": 0, "nesmysl": 0, "chyby": 0}
    for i, slug in enumerate(slugy):
        r = _get(session, f"{KUPI}/sleva/{slug}",
                 headers={"Referer": f"{KUPI}/"})
        if r is None or not r.ok:
            stat["chyby"] += 1
            time.sleep(PAUZA)
            continue
        bezna = bezna_z_detailu(r.text)
        if bezna is None:
            stat["bez_dat"] += 1
            time.sleep(PAUZA)
            continue
        for o in podle_slugu[slug]:
            baleni = float(o["baleni_g"] or 0)
            if baleni <= 0:
                stat["nesmysl"] += 1
                continue
            p100 = round(bezna * 100 / baleni, 2)
            cena = float(o["cena"])
            if not (cena * 1.01 <= p100 <= cena * MAX_NASOBEK):
                stat["nesmysl"] += 1
                continue
            if args.dry:
                log.info("[dry] %s ← %s: %s Kč → %.2f/100 g",
                         slug, o["id"], bezna, p100)
                stat["cen"] += 1
            else:
                pr = requests.patch(
                    f"{url}/rest/v1/price_observations",
                    headers={**hlavicky, "Prefer": "return=minimal"},
                    params={"id": f"eq.{o['id']}"},
                    json={"puvodni_cena": p100, "puvodni_zdroj": "kupi"},
                    timeout=30,
                )
                if pr.ok:
                    stat["cen"] += 1
                    stat["patch"] += 1
                else:
                    stat["chyby"] += 1
                    log.warning("PATCH %s → %d %s", o["id"], pr.status_code,
                                pr.text[:200])
        if (i + 1) % 40 == 0:
            log.info("…%d/%d slugů (cen %d, bez dat %d, nesmysl %d, chyby %d)",
                     i + 1, len(slugy), stat["cen"], stat["bez_dat"],
                     stat["nesmysl"], stat["chyby"])
        time.sleep(PAUZA)

    log.info("Hotovo: doplněno %d původních cen (patch %d), bez dat %d, "
             "nesmysl %d, chyby %d",
             stat["cen"], stat["patch"], stat["bez_dat"],
             stat["nesmysl"], stat["chyby"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
