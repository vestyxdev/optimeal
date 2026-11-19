"""AsortimentScraper – plný katalog českých eshopů (Rohlík.cz, Košík.cz).

python -m scraper.asortiment [--dry-run] [--obchod rohlik|kosik]
                             [--max-kategorii N]

- Projede eshopy; selhání jednoho neshodí druhý.
- Ceny se upsertují do price_observations (zdroj='asortiment:<obchod>'),
  je_sleva=false pro běžné ceny / true u eshopových akcí.
- Nespárované produkty se zakládají jako foods se schvaleno=true (zdroj
  je ověřený eshop); makra jim doplní obohaceni.py (filtr kalorie=0).
- Stale purge smaže asortimentní pozorování neobnovená v tomto běhu
  (jen u eshopů, které skutečně doběhly) + expirovaná pozorování.
- Exit 0 i při částečném selhání; při TOTÁLNÍM selhání → 1.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

from .retailers import ASORTIMENT_SCRAPERY

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("scraper.asortiment")


def main() -> int:
    parser = argparse.ArgumentParser(prog="optimeal-asortiment")
    parser.add_argument("--dry-run", action="store_true", help="bez zápisu do DB")
    parser.add_argument("--obchod", help="jen jeden eshop (Rohlík.cz / Košík.cz)")
    parser.add_argument("--max-kategorii", type=int, default=None,
                        help="testovací strop – max N leaf kategorií na eshop")
    parser.add_argument("--obnov-strom", action="store_true",
                        help="ignorovat cache stromu kategorií (BFS znovu)")
    parser.add_argument("--bez-novych", action="store_true",
                        help="nezakládat nové potraviny u nespárovaných")
    args = parser.parse_args()

    start = datetime.now(timezone.utc)
    scrapery = [
        s for s in ASORTIMENT_SCRAPERY
        if not args.obchod or s.obchod.lower() == args.obchod.lower()
    ]
    if args.obchod and not scrapery:
        log.error("Neznámý eshop: %s (máme: %s)", args.obchod,
                  ", ".join(s.obchod for s in ASORTIMENT_SCRAPERY))
        return 2

    vsechny = []
    vysledky: dict[str, str] = {}
    uspesne_zdroje: list[str] = []
    nizke_pokryti = False
    for cls in scrapery:
        s = cls(max_kategorii=args.max_kategorii, obnov_strom=args.obnov_strom)
        try:
            nabidky = list(s.stahni_slevy())
            vsechny.extend(nabidky)
            selh = getattr(s, "leaf_selhalo", 0)
            celk = getattr(s, "leaf_celkem", 0)
            pokryti = f" – {celk - selh}/{celk} leaf OK" if celk else ""
            vysledky[s.obchod] = f"{len(nabidky)} produktů{pokryti}"
            log.info("%s: %d produktů%s", s.obchod, len(nabidky), pokryti)
            if s.fetched:
                uspesne_zdroje.append(f"asortiment:{s.obchod.lower()}")
            # >50 % leaf requestů padlo → skoro jistě IP blokace
            # (datacenter); data zapíšeme, ale job musí zrudnout,
            # ať retry workflow chytí čerstvou IP
            if celk >= 10 and selh > celk * 0.5:
                nizke_pokryti = True
                log.error(
                    "%s: podezřele nízké pokrytí – %d/%d leaf selhalo",
                    s.obchod, selh, celk,
                )
        except Exception as e:  # noqa: BLE001
            vysledky[s.obchod] = f"CHYBA: {e.__class__.__name__}"
            log.exception("%s: scraper selhal – pokračuji dalším", s.obchod)

    log.info("Celkem %d nabídek | %s", len(vsechny), vysledky)

    if args.dry_run:
        for n in vsechny[:20]:
            print(
                f"  {n.obchod:<10} {n.nazev[:45]:<45} {n.cena_za_100g:>7} Kč/100g"
                + (f" (sleva z {n.puvodni_cena_za_100g})" if n.je_sleva else " (běžná)")
            )
        print("DRY-RUN: nic se nezapsalo.")
        return 0

    from .db import SupabaseWriter

    writer = SupabaseWriter()
    stat = writer.zapis_asortiment(vsechny, start, vytvarej=not args.bez_novych)
    log.info(
        "Zapsáno %d pozorování (spárováno %d, nových potravin %d, přeskočeno %d)",
        stat["vlozeno"], stat["sparovano"], stat["nove_potraviny"], stat["preskoceno"],
    )
    # purge jen zdrojů, které fakt doběhly A měly rozumné pokrytí –
    # půlka spadlých leafů = data jsou neúplná, purge by smazal
    # platné ceny kategorií, které se tentokrát nenačetly
    writer.purge_scrapera(start, uspesne_zdroje if not nizke_pokryti else [])
    writer.purge_expirovanych()

    souhrn = os.environ.get("GITHUB_STEP_SUMMARY")
    if souhrn:
        radky = ["## AsortimentScraper", "", "| Eshop | Výsledek |", "|---|---|"]
        radky += [f"| {o} | {v} |" for o, v in vysledky.items()]
        radky += [
            "",
            f"**Zapsáno:** {stat['vlozeno']} pozorování "
            f"(spárováno {stat['sparovano']}, nových potravin {stat['nove_potraviny']}, "
            f"přeskočeno {stat['preskoceno']})",
        ]
        if nizke_pokryti:
            radky += ["", "⚠️ **Nízké pokrytí kategorií** – pravděpodobně IP blokace z datacentra; doporučeno přehrát job pro čerstvou IP."]
        try:
            with open(souhrn, "a", encoding="utf-8") as f:
                f.write("\n".join(radky) + "\n")
        except OSError as e:
            log.warning("GITHUB_STEP_SUMMARY zápis selhal: %s", e)

    return 0 if (vsechny and not nizke_pokryti) else 1


if __name__ == "__main__":
    sys.exit(main())
