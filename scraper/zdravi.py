"""Zdraví scraping pipeline – kontroly čerstvosti a objemu dat.

Exit 0 = vše v pořádku, exit 1 = aspoň jedna kontrola selhala
(report na stdout jako markdown pro GitHub issue).

Běží v zdravi.yml denně večer – kdyby scraper legy tiše umřely,
bez téhle kontroly by to nikdo nezjistil.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import requests

PRAH_CERSTVOSTI_H = 30  # letáky i asortiment běží denně – 30h = jedna zmeškaná vlna
PRAH_SLEVY = 500        # pod tím je pipeline rozbitá (typicky 1500+)
PRAH_FOODS = 9000       # katastrofální mazání by kleslo pod


def _env() -> tuple[str, str]:
    for f in (".env.local", ".env"):
        try:
            with open(f, encoding="utf-8-sig") as fh:
                for radek in fh:
                    radek = radek.strip()
                    if "=" in radek and not radek.startswith("#"):
                        k, v = radek.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())
        except FileNotFoundError:
            pass
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    klic = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("VITE_SUPABASE_ANON_KEY"))
    if not url or not klic:
        print("chybi SUPABASE_URL / klic", file=sys.stderr)
        sys.exit(2)
    return url.rstrip("/"), klic


def get(url: str, klic: str, path: str, params: dict) -> requests.Response:
    h = {"apikey": klic, "Authorization": f"Bearer {klic}"}
    r = requests.get(f"{url}/rest/v1/{path}", headers=h, params=params, timeout=30)
    r.raise_for_status()
    return r


def count(url: str, klic: str, path: str, query: str = "") -> int:
    h = {"apikey": klic, "Authorization": f"Bearer {klic}", "Prefer": "count=exact"}
    r = requests.get(f"{url}/rest/v1/{path}?select=*&limit=0{query}", headers=h, timeout=30)
    r.raise_for_status()
    m = (r.headers.get("content-range") or "").split("/")
    return int(m[1]) if len(m) == 2 and m[1].isdigit() else 0


def kontroly(url: str, klic: str) -> list[tuple[str, bool, str]]:
    """Vrátí [(nazev, ok, detail)]."""
    vysledky: list[tuple[str, bool, str]] = []
    hranice = (datetime.now(timezone.utc) - timedelta(hours=PRAH_CERSTVOSTI_H)).isoformat()

    # 1) čerstvost letákových cen (scraper:%)
    r = get(url, klic, "price_observations", {
        "select": "pozorovano_at", "zdroj": "like.scraper:*",
        "order": "pozorovano_at.desc", "limit": 1,
    })
    rows = r.json()
    if rows:
        nej = datetime.fromisoformat(rows[0]["pozorovano_at"].replace("Z", "+00:00"))
        stari_h = (datetime.now(timezone.utc) - nej).total_seconds() / 3600
        ok = rows[0]["pozorovano_at"] >= hranice
        vysledky.append(("Letákové ceny čerstvé", ok, f"nejnovější před {stari_h:.1f} h (práh {PRAH_CERSTVOSTI_H} h)"))
    else:
        vysledky.append(("Letákové ceny čerstvé", False, "žádné letákové pozorování vůbec"))

    # 2) čerstvost asortimentu (asortiment:%)
    r = get(url, klic, "price_observations", {
        "select": "pozorovano_at", "zdroj": "like.asortiment:*",
        "order": "pozorovano_at.desc", "limit": 1,
    })
    rows = r.json()
    if rows:
        nej = datetime.fromisoformat(rows[0]["pozorovano_at"].replace("Z", "+00:00"))
        stari_h = (datetime.now(timezone.utc) - nej).total_seconds() / 3600
        ok = rows[0]["pozorovano_at"] >= hranice
        vysledky.append(("Asortiment eshopů čerstvý", ok, f"nejnovější před {stari_h:.1f} h (práh {PRAH_CERSTVOSTI_H} h)"))
    else:
        vysledky.append(("Asortiment eshopů čerstvý", False, "žádné asortimentní pozorování vůbec"))

    # 3) objem aktivních slev
    slevy = count(url, klic, "aktualni_ceny", "&sleva=eq.true")
    vysledky.append(("Objem aktivních slev", slevy >= PRAH_SLEVY, f"{slevy} (práh {PRAH_SLEVY})"))

    # 4) katalog neutichá
    foods = count(url, klic, "foods")
    vysledky.append(("Velikost katalogu", foods >= PRAH_FOODS, f"{foods} (práh {PRAH_FOODS})"))

    # 5) per-retailer čerstvost letáků – stránkovaně přes VŠECHNA pozorování,
    # jinak by řetězec zcela bez řádků vypadal jako čerstvý (sample bias)
    ocekavane = {"scraper:penny", "scraper:tesco", "scraper:kaufland", "scraper:billa",
                 "scraper:globus", "scraper:lidl", "scraper:albert", "scraper:hruška",
                 "scraper:flop top", "scraper:coop", "scraper:cba", "scraper:dm",
                 "scraper:rossmann", "scraper:zeman", "scraper:teta drogerie"}
    nejnov: dict[str, str] = {}
    offset = 0
    while True:
        r = get(url, klic, "price_observations", {
            "select": "zdroj,pozorovano_at", "zdroj": "like.scraper:*",
            "order": "pozorovano_at.desc", "limit": 1000, "offset": offset,
        })
        rows = r.json()
        if not rows:
            break
        for row in rows:
            nejnov.setdefault(row["zdroj"], row["pozorovano_at"])
        if len(rows) < 1000:
            break
        offset += 1000
    mrtve = sorted(z for z, t in nejnov.items() if t < hranice)
    chybi = sorted(ocekavane - set(nejnov))
    problemy = [*(f"mrtvý {z}" for z in mrtve), *(f"bez dat {z}" for z in chybi)]
    vysledky.append((
        "Žádný mrtvý letákový řetězec",
        len(problemy) == 0,
        "; ".join(problemy) if problemy else f"{len(nejnov)} řetězců čerstvých",
    ))

    return vysledky


def main() -> int:
    # Windows konzole je cp1250 – emoji v reportu by spadlo na encode
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    url, klic = _env()
    vysledky = kontroly(url, klic)

    radky = ["## Zdraví scraper pipeline\n"]
    zle = 0
    for nazev, ok, detail in vysledky:
        ikona = "✅" if ok else "❌"
        if not ok:
            zle += 1
        radky.append(f"- {ikona} **{nazev}** — {detail}")
    radky.append(f"\n_Kontrola: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_")
    print("\n".join(radky))

    if zle:
        print(f"\n{zle} kontrol selhalo", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
