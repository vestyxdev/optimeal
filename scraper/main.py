"""Vstupní bod scraperu: python -m scraper [--dry-run] [--stranky N]"""

from __future__ import annotations

import argparse
import logging
import sys

from .open_prices import kurz_eur_cnb, stahni_ceny_cz

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("scraper")


def main() -> int:
    parser = argparse.ArgumentParser(prog="optimeal-scraper")
    parser.add_argument("--dry-run", action="store_true", help="bez zápisu do DB")
    parser.add_argument("--stranky", type=int, default=10, help="max stránek Open Prices (100/strana)")
    args = parser.parse_args()

    kurz = kurz_eur_cnb()
    log.info("Kurz EUR/CZK: %.2f", kurz)

    zaznamy = list(stahni_ceny_cz(max_stranek=args.stranky, kurz_eur=kurz))
    log.info("Staženo %d použitelných záznamů pro ČR", len(zaznamy))

    if args.dry_run:
        for z in zaznamy[:15]:
            print(f"  {z['obchod']:<12} {z['nazev_produktu'] or z['ean']:<35} {z['cena_za_100g']} Kč/100g")
        print("DRY-RUN: nic se nezapsalo.")
        return 0

    from .db import SupabaseWriter

    stat = SupabaseWriter().zapis_ceny(zaznamy)
    log.info("Zapsáno %d pozorování (spárováno %d, přeskočeno %d)",
             stat.get("vlozeno", 0), stat["sparovano"], stat["preskoceno"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
