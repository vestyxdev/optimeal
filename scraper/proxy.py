"""Volitelná proxy pro outbound HTTP z scraperů.

Kupi.cz a další weby občas blokují GitHub datacenter IP – rezidenční
proxy to obchází, ale nemáme ji zadarmo. Zapnutí = jedna env proměnná
`PROXY_URL` (např. `http://user:pass@host:port`), nulová změna kódu.

- Při nevyplněné proměnné se nic neděje (přímé spojení jako doteď).
- `requests` sám čte `HTTP(S)_PROXY`; naše PROXY_URL se mapuje
  explicitně na `session.proxies`, aby nezávisela na názvu proměnné
  a nešla omylem i na Supabase PostgREST – proxy chceme jen na
  veřejné weby, proto se aplikuje per-session zde, ne globálně.
"""

from __future__ import annotations

import logging
import os

import requests

log = logging.getLogger("scraper.proxy")

_oznameno = False


def aplikuj_proxy(session: requests.Session, ucel: str = "") -> bool:
    """Nastaví session.proxies z env PROXY_URL. Vrací True když aktivní."""
    global _oznameno
    url = (os.environ.get("PROXY_URL") or "").strip()
    if not url:
        return False
    if not url.startswith(("http://", "https://", "socks5://", "socks5h://")):
        log.warning("PROXY_URL vypadá neplatně (%s…) – ignoruji", url[:12])
        return False
    session.proxies.update({"http": url, "https": url})
    if not _oznameno:
        # host bez hesla – secrets nesmí do logu
        host = url.split("@")[-1]
        log.info("Outbound proxy aktivní%s – přes %s", f" ({ucel})" if ucel else "", host)
        _oznameno = True
    return True
