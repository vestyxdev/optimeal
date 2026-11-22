"""PriceScraper – orchestrátor letákových/eshopových slev.

python -m scraper.ceniky [--dry-run] [--obchod Kaufland]

- Projede všechny řetězce; selhání jednoho neshodí ostatní.
- Nabídky se upsertují do price_observations (zdroj='scraper:<obchod>').
- Stale purge: na konci smaže scraper-pozorování neobnovená v tomto
  běhu + všechna expirovaná → UI vidí jen aktivní akce.
- Exit 0 i při částečných selháních (denní cron nesmí padat kvůli
  jednomu řetězci); při TOTÁLNÍM selhání (0 nabídek ze všech) → 1,
  aby byl problém vidět v Actions.
- Výjimka: 0 nabídek čistě proto, že všechny zdroje odmítly požadavky
  WAFem (403/429 po všech retrycích) = infrastrukturní blok, ne chyba
  kódu → exit 0 + ::warning:: anotace. Druhý denní cron běh přinese
  jinou IP runneru; červený job by tu byl jen falešný poplach.
"""

from __future__ import annotations

import argparse
import logging
import os
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
    info: dict[str, dict] = {}  # obchod → {scraped, status, blocked, fetched}
    uspesne_zdroje: list[str] = []  # řetězce, co stáhly ≥1 stránku
    zablokovane: list[str] = []     # řetězce, jejichž zdroj vracel jen 403/429
    for cls in scrapery:
        s = cls()
        try:
            nabidky = list(s.stahni_slevy())
            vsechny.extend(nabidky)
            st = {
                "scraped": len(nabidky),
                "blocked": getattr(s, "blocked", False),
                "fetched": s.fetched,
            }
            if not nabidky and st["blocked"]:
                st["status"] = "BLOKOVÁNO (WAF)"
                zablokovane.append(s.obchod)
            elif not nabidky:
                # stažená stránka bez nabídek = pravděpodobně změněná
                # šablona (parser regression) – má zůstat viditelné
                st["status"] = ("0 nabídek (parser?)" if s.fetched
                                else "0 nabídek (nic nestaženo)")
            else:
                st["status"] = "ok"
            info[s.obchod] = st
            log.info("%s: %d nabídek", s.obchod, len(nabidky))
            if s.fetched:
                uspesne_zdroje.append(f"scraper:{s.obchod.lower()}")
        except Exception as e:  # noqa: BLE001 – jeden řetězec nesmí shodit běh
            info[s.obchod] = {
                "scraped": 0, "blocked": False, "fetched": False,
                "status": f"CHYBA: {e.__class__.__name__}",
            }
            log.exception("%s: scraper selhal – pokračuji dalším", s.obchod)

    log.info("Celkem %d nabídek | %s", len(vsechny),
             {o: st["status"] for o, st in info.items()})

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
    # health-check baseline PŘED zápisem/purgí – po ní už počty
    # v tabulce odpovídají tomuto běhu, ne minulému
    for obchod, st in info.items():
        if st.get("status") != "ok":
            continue
        baseline = writer.pocet_zdroje(f"scraper:{obchod.lower()}")
        if baseline and st["scraped"] < baseline * 0.5:
            zprava = (f"{obchod}: scraped {st['scraped']} vs baseline "
                      f"{baseline} (>50 % meziběhový pokles – podezřelý "
                      "výpadek zdroje nebo rozbitý parser)")
            log.warning(zprava)
            print(f"::warning::{zprava}")
            st["status"] = "ok – ⚠ pokles >50 %"

    stat = writer.zapis_nabidky(vsechny, start)
    log.info(
        "Zapsáno %d pozorování (spárováno %d, přeskočeno %d)",
        stat["vlozeno"], stat["sparovano"], stat["preskoceno"],
    )
    writer.purge_scrapera(start, uspesne_zdroje)
    writer.purge_expirovanych()

    # strukturovaný souhrn běhu (audit + watchdogy)
    overene = stat.get("overenych_slev", 0)
    artefakty = len(stat.get("anomalie_ceny", [])) + len(
        stat.get("anomalie_puvodni", [])
    )
    log.info(
        "SOUHRN total_scraped=%d valid_inserted=%d verified_discounts=%d "
        "plain_prices=%d rejected_artifacts=%d duration_sec=%.1f",
        len(vsechny), stat["vlozeno"], overene,
        max(0, stat["vlozeno"] - overene), artefakty,
        (datetime.now(timezone.utc) - start).total_seconds(),
    )

    # Souhrn pro GitHub Actions – matrix job jinak ukáže jen „failure"
    # i když zapsal stovky pozorování. Per-leg tabulka + run totals.
    souhrn = os.environ.get("GITHUB_STEP_SUMMARY")
    if souhrn:
        trvani = (datetime.now(timezone.utc) - start).total_seconds()
        radky = [
            "## PriceScraper", "",
            "| Obchod | Stav | Staženo nabídek |",
            "|---|---|---:|",
        ]
        radky += [f"| {o} | {st['status']} | {st['scraped']} |"
                  for o, st in info.items()]
        radky += [
            "",
            "| Zapsáno | Spárováno | Ověřené slevy | Zahozené artefakty | Trvání |",
            "|---:|---:|---:|---:|---:|",
            f"| {stat['vlozeno']} | {stat['sparovano']} | {overene} "
            f"| {artefakty} | {trvani:.0f} s |",
            "",
            f"**Přeskočeno (nespárováno + anomálie):** {stat['preskoceno']}",
        ]
        if stat.get("nesparovano_nazvy"):
            radky += ["", "**Nespárováno (vzorek):** " + ", ".join(stat["nesparovano_nazvy"])]
        try:
            with open(souhrn, "a", encoding="utf-8") as f:
                f.write("\n".join(radky) + "\n")
        except OSError as e:
            log.warning("GITHUB_STEP_SUMMARY zápis selhal: %s", e)

    # 0 nabídek ze všech řetězců = něco je špatně (síť/parsování) → fail;
    # čistá WAF blokace všech zdrojů ale není chyba kódu → warning, ne fail
    if vsechny:
        return 0
    if zablokovane and len(zablokovane) == len(scrapery):
        print(
            "::warning::PriceScraper: všechny zdroje zablokovány WAFem "
            f"({', '.join(zablokovane)}) – nic se nezapsalo, zkusí "
            "to další cron běh z jiné IP."
        )
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
