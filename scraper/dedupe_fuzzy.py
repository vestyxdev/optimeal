"""Fuzzy dedupe katalogu potravin.

Detekce běží v Pythonu (token-blocking + trigramová Jaccard podobnost),
samotné sloučení provede DB funkce ``sluc_potraviny`` atomicky.

Režimy:
  python -m scraper.dedupe_fuzzy            # dry-run report do dedupe_pary.json
  python -m scraper.dedupe_fuzzy --pruh 0.75

Merge pak provede node skript (service role / přímé PG), viz README výstupu.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import requests

VELIKOST_RE = re.compile(r"\b\d+([.,]\d+)?\s*(g|kg|ml|l|cl|ks)\b", re.IGNORECASE)
NEPISMENA_RE = re.compile(r"[^\w\s]", re.UNICODE)
STOP_SLOVA = {"a", "s", "v", "z", "na", "do", "bio", "the", "of"}


def norm(text: str) -> str:
    """Diakritika pryč, lowercase, jen alfanumerika + mezery."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = NEPISMENA_RE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def tokeny(text: str) -> list[str]:
    return [t for t in norm(text).split() if len(t) >= 3 and t not in STOP_SLOVA]


def trigramy(text: str) -> set[str]:
    t = " " + norm(text) + " "
    return {t[i : i + 3] for i in range(len(t) - 2)}


CISLA_RE = re.compile(r"\d+(?:[.,]\d+)?")


def cisla(text: str) -> list[str]:
    """Multiset čísel v názvu (normalizovaný desetinný formát).

    „Smetana 15 %" vs „16 %" = jiné produkty, i když je název jinak stejný.
    Velikosti balení se před voláním typicky už odstranily (VELIKOST_RE),
    takže zbylé číslice jsou tuky/procenta/druhové označení.
    """
    return sorted(c.replace(",", ".") for c in CISLA_RE.findall(text))


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def nacti_potraviny(url: str, klic: str) -> list[dict]:
    """Všechny potraviny přes REST stránkování (jen potřebné sloupce)."""
    h = {"apikey": klic, "Authorization": f"Bearer {klic}"}
    vse: list[dict] = []
    offset = 0
    while True:
        r = requests.get(
            f"{url}/rest/v1/foods",
            headers=h,
            params={
                "select": "id,nazev,kategorie,ean,znacka,obrazek,baleni_g,alergeny",
                "order": "id",
                "offset": offset,
                "limit": 1000,
            },
            timeout=60,
        )
        r.raise_for_status()
        davka = r.json()
        vse.extend(davka)
        if len(davka) < 1000:
            break
        offset += 1000
    return vse


def skore_keepera(p: dict) -> float:
    """Vyšší = kompletnější záznam, který má přežít."""
    s = 0.0
    if p.get("ean"):
        s += 2.0
    if p.get("obrazek"):
        s += 1.0
    if p.get("alergeny"):
        s += 1.0
    if p.get("baleni_g"):
        s += 0.5
    # Kratší název = méně „okecávaný" duplicitní řádek
    s -= len(p["nazev"]) / 200.0
    return s


def hledej_duplicity(potraviny: list[dict], prah: float) -> list[dict]:
    """Token-blocking: kandidáti sdílí aspoň jeden významný token; potvrdí je
    trigramová podobnost normalizovaného názvu bez velikostních přídomků."""
    index: dict[str, list[int]] = {}
    for i, p in enumerate(potraviny):
        # set(): opakovaný token v názvu („Rice … rice bar") by jinak
        # zaindexoval řádek dvakrát a spároval ho sám se sebou
        for t in set(tokeny(p["nazev"])):
            index.setdefault(t, []).append(i)

    tri = [trigramy(VELIKOST_RE.sub(" ", p["nazev"])) for p in potraviny]
    videni: set[tuple[int, int]] = set()
    duplicity: list[dict] = []

    for token, idxs in index.items():
        if len(idxs) > 300:  # příliš obecný token ('mleko' apod.) – žádný signál
            continue
        for x in range(len(idxs)):
            for y in range(x + 1, len(idxs)):
                i, j = idxs[x], idxs[y]
                if (i, j) in videni:
                    continue
                videni.add((i, j))
                a, b = potraviny[i], potraviny[j]
                # Různé EANy = různé produkty, i kdyby se jmenovaly podobně
                if a.get("ean") and b.get("ean") and a["ean"] != b["ean"]:
                    continue
                if (a.get("kategorie") or "") != (b.get("kategorie") or ""):
                    continue
                # Různé značky = různé produkty
                if a.get("znacka") and b.get("znacka") and norm(a["znacka"]) != norm(b["znacka"]):
                    continue
                # Různá čísla mimo velikost balení (tuk %, druhové označení) = jiný produkt
                if cisla(VELIKOST_RE.sub(" ", a["nazev"])) != cisla(VELIKOST_RE.sub(" ", b["nazev"])):
                    continue
                sim = jaccard(tri[i], tri[j])
                if sim >= prah:
                    keeper, loser = (a, b) if skore_keepera(a) >= skore_keepera(b) else (b, a)
                    duplicity.append({
                        "keeper_id": keeper["id"],
                        "keeper_nazev": keeper["nazev"],
                        "loser_id": loser["id"],
                        "loser_nazev": loser["nazev"],
                        "podobnost": round(sim, 3),
                        "token": token,
                    })
    duplicity.sort(key=lambda d: -d["podobnost"])
    return duplicity


def _nacti_env() -> None:
    """Lokální .env / .env.local (v CI jdou proměnné z prostředí)."""
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pruh", type=float, default=0.75,
                    help="prah trigramove podobnosti (0-1, vyssi = konzervativnejsi)")
    ap.add_argument("--vystup", default="dedupe_pary.json")
    ap.add_argument("--merge", action="store_true",
                    help="rovnou sloucit pres RPC sluc_potraviny (vyzaduje service role klic)")
    args = ap.parse_args()

    _nacti_env()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").strip().rstrip("/")
    klic = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("VITE_SUPABASE_ANON_KEY"))
    if not url or not klic:
        print("chybi SUPABASE_URL / klic", file=sys.stderr)
        return 2

    print("nacitam katalog...", file=sys.stderr)
    potraviny = nacti_potraviny(url, klic)
    print(f"nacteno {len(potraviny)} potravin, hledam duplicity (prah {args.pruh})...", file=sys.stderr)

    duplicity = hledej_duplicity(potraviny, args.pruh)
    Path(args.vystup).write_text(json.dumps(duplicity, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"nalezeno {len(duplicity)} paru -> {args.vystup}", file=sys.stderr)
    for d in duplicity[:15]:
        print(f"  {d['podobnost']:.2f}  {d['keeper_nazev']}  <=  {d['loser_nazev']}")
    if len(duplicity) > 15:
        print(f"  ... a dalsich {len(duplicity) - 15}")

    if args.merge:
        if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            print("merge vyzaduje SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
            return 2
        h = {"apikey": klic, "Authorization": f"Bearer {klic}", "Content-Type": "application/json"}
        slouceno, chyby = 0, 0
        for d in duplicity:
            r = requests.post(
                f"{url}/rest/v1/rpc/sluc_potraviny",
                headers=h,
                json={"keeper": d["keeper_id"], "loser": d["loser_id"]},
                timeout=30,
            )
            if r.status_code in (200, 204):
                slouceno += 1
            else:
                chyby += 1
                print(f"  CHYBA {d['keeper_nazev']} <= {d['loser_nazev']}: {r.text[:200]}", file=sys.stderr)
        print(f"merge: slouceno {slouceno}, chyb {chyby}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
