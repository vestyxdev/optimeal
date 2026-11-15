"""PriceScraper – orchestrátor letákových/eshopových slev.

python -m scraper.ceniky [--dry-run] [--obchod Kaufland]

- Projede všechny řetězce; selhání jednoho neshodí ostatní.
- Nabídky se upsertují do price_observations (zdroj='scraper:<obchod>').
- Stale purge: na konci smaže scraper-pozorování neobnovená v tomto
  běhu + všechna expirovaná → UI vidí jen aktivní akce.
- Exit 0 i při částečných selháních (denní cron nesmí padat kvůli
  jednomu řetězci); při TOTÁLNÍM selhání (0 nabídek ze všech) → 1,
  aby byl problém vidět v Actions.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone

from .retailers import SCRAPERY

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("scraper.ceniky")


def main() -> int:
    parser = argparse.ArgumentParser(prog="optimeal-pricescraper")
    parser.add_argument("--dry-run", action="store_true", help="bez zápisu do DB")
    parser.add_argument("--obchod", help="jen jeden řetězec (např. Kaufland)")
    args = parser.parse_args()

    start = datetime.now(timezone.utc)
    scrapery = [
        s for s in SCRAPERY
        if not args.obchod or s.obchod.lower() == args.obchod.lower()
    ]
    if args.obchod and not scrapery:
        log.error("Neznámý obchod: %s", args.obchod)
        return 2

    vsechny = []
    vysledky: dict[str, str] = {}
    for cls in scrapery:
        s = cls()
        try:
            nabidky = list(s.stahni_slevy())
            vsechny.extend(nabidky)
            vysledky[s.obchod] = f"{len(nabidky)} nabídek"
            log.info("%s: %d nabídek", s.obchod, len(nabidky))
        except Exception as e:  # noqa: BLE001 – jeden řetězec nesmí shodit běh
            vysledky[s.obchod] = f"CHYBA: {e.__class__.__name__}"
            log.exception("%s: scraper selhal – pokračuji dalším", s.obchod)

    log.info("Celkem %d nabídek | %s", len(vsechny), vysledky)

    if args.dry_run:
        for n in vsechny[:20]:
            print(
                f"  {n.obchod:<10} {n.nazev[:45]:<45} {n.cena_za_100g:>7} Kč/100g"
                + (f" (z {n.puvodni_cena_za_100g})" if n.puvodni_cena_za_100g else "")
            )
        print("DRY-RUN: nic se nezapsalo.")
        return 0

    from .db import SupabaseWriter

    writer = SupabaseWriter()
    stat = writer.zapis_nabidky(vsechny, start)
    log.info(
        "Zapsáno %d pozorování (spárováno %d, přeskočeno %d)",
        stat["vlozeno"], stat["sparovano"], stat["preskoceno"],
    )
    writer.purge_scrapera(start)
    writer.purge_expirovanych()

    # 0 nabídek ze všech řetězců = něco je špatně (síť/WAF změny) → fail
    return 0 if vsechny else 1


if __name__ == "__main__":
    sys.exit(main())
