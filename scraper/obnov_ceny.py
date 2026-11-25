"""Přepočet referenční bezna_cena z mediánu reálných pozorování.

Volá DB funkci `obnov_referencni_ceny()` (migrace 0064) přes PostgREST RPC.
Spouštět po scrapech – každá vlna pozorování tak zlepší referenční ceny
u položek bez živé ceny.

    python -m scraper.obnov_ceny
"""

from __future__ import annotations

import logging
import os
import sys

from .db import _req

log = logging.getLogger("obnov_ceny")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def obnov_referencni_ceny() -> int:
    """Zavolá RPC a vrátí počet zkorigovaných řádků."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
    r = _req(
        "post",
        f"{SUPABASE_URL}/rest/v1/rpc/obnov_referencni_ceny",
        headers={
            "apikey": SUPABASE_KEY,
            "authorization": f"Bearer {SUPABASE_KEY}",
            "content-type": "application/json",
        },
        json={},
        timeout=120,
    )
    r.raise_for_status()
    return int(r.json())


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    n = obnov_referencni_ceny()
    log.info("Referenční ceny zkorigovány u %d potravin.", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
