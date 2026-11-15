"""Zápis do Supabase přes PostgREST se service-role klíčem (server-side).

Service-role klíč NIKDY nepatří do frontendu – tady běží na serveru
(GitHub Actions runner) a má oprávnění zapisovat do price_observations.
"""

from __future__ import annotations

import difflib
import logging
import os
import re
from datetime import date, datetime, timezone

import requests

from .normalizace import normalizuj_nazev
from .retailers.base import Nabidka

log = logging.getLogger("scraper.db")


class SupabaseWriter:
    def __init__(self, url: str | None = None, klic: str | None = None):
        # strip(): secrets v GitHub Actions můžou mít trailing whitespace
        self.url = (url or os.environ["SUPABASE_URL"]).strip().rstrip("/")
        self.klic = klic or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self._hlavicky = {
            "apikey": self.klic,
            "Authorization": f"Bearer {self.klic}",
            "Content-Type": "application/json",
        }
        self._potraviny: list[dict] | None = None
        self._retailery: dict[str, str] | None = None

    def _get(self, tabulka: str, sloupce: str = "*", **params) -> list[dict]:
        r = requests.get(
            f"{self.url}/rest/v1/{tabulka}",
            headers=self._hlavicky,
            params={"select": sloupce, **params},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def nacti_potraviny(self) -> list[dict]:
        if self._potraviny is None:
            self._potraviny = self._get("foods", "id,nazev,ean,baleni_g")
            self._norm_potraviny = [
                (p["id"], normalizuj_nazev(p["nazev"]), p)
                for p in self._potraviny
            ]
        return self._potraviny

    def _retailer_id(self, nazev: str) -> str | None:
        if self._retailery is None:
            self._retailery = {
                normalizuj_nazev(r["nazev"]): r["id"] for r in self._get("retailers", "id,nazev")
            }
        klic = normalizuj_nazev(nazev)
        if klic in self._retailery:
            return self._retailery[klic]
        # nový obchod – vlož a zapamatuj
        r = requests.post(
            f"{self.url}/rest/v1/retailers",
            headers={**self._hlavicky, "Prefer": "return=representation,resolution=ignore-duplicates"},
            json={"nazev": nazev, "aktivni": True, "poznamka": "z open-prices"},
            timeout=30,
        )
        if r.ok and r.json():
            rid = r.json()[0]["id"] if isinstance(r.json(), list) else r.json()["id"]
            self._retailery[klic] = rid
            return rid
        # ignore-duplicates: obchod už existuje, jen jinak normalizovaný –
        # dohledej ho podle přesného názvu místo přeskočení všech jeho cen
        if r.ok and not r.json():
            try:
                existujici = self._get("retailers", "id,nazev", nazev=f"eq.{nazev}")
            except requests.RequestException as e:
                log.warning("Dohledání retailera '%s' selhalo: %s", nazev, e)
                existujici = []
            if existujici:
                self._retailery[klic] = existujici[0]["id"]
                self._retailery[normalizuj_nazev(existujici[0]["nazev"])] = existujici[0]["id"]
                return existujici[0]["id"]
        log.warning("Retailer '%s' se nepodařilo založit: %s", nazev, r.text[:200])
        return None

    def _dopln_ean(self, food_id: str, ean: str) -> None:
        """Doplní chybějící EAN na potravinu – best-effort, chyby jen logujeme."""
        try:
            r = requests.patch(
                f"{self.url}/rest/v1/foods",
                headers={**self._hlavicky, "Prefer": "return=minimal"},
                params={"id": f"eq.{food_id}"},
                json={"ean": ean},
                timeout=30,
            )
            if r.ok:
                for p in self._potraviny or []:
                    if p["id"] == food_id:
                        p["ean"] = ean
                log.info("Potravině %s doplněn EAN %s", food_id, ean)
            else:
                log.warning("Doplnění EAN na %s selhalo: %s", food_id, r.text[:200])
        except requests.RequestException as e:
            log.warning("Doplnění EAN na %s selhalo: %s", food_id, e)

    def _food_id(self, ean: str | None, nazev_produktu: str) -> str | None:
        """Napáruje záznam na foods.id – nejdřív EAN, pak normalizovaný název.

        Při shodě jménem se známým EANem se chybějící foods.ean doplní,
        takže příště matchuje EAN (přesnější než jméno).
        """
        potraviny = self.nacti_potraviny()
        if ean:
            for p in potraviny:
                if p.get("ean") and p["ean"] == ean:
                    return p["id"]
        if nazev_produktu:
            cil = normalizuj_nazev(nazev_produktu)
            for p in potraviny:
                if normalizuj_nazev(p["nazev"]) == cil:
                    if ean and not p.get("ean"):
                        self._dopln_ean(p["id"], ean)
                    return p["id"]
        return None

    def zapis_ceny(self, zaznamy: list[dict]) -> dict:
        """Přeloží normalizované záznamy na řádky price_observations a vloží."""
        radky = []
        stat = {"sparovano": 0, "preskoceno": 0}
        for z in zaznamy:
            food_id = self._food_id(z.get("ean"), z.get("nazev_produktu") or "")
            retailer_id = self._retailer_id(z["obchod"]) if z.get("obchod") else None
            if not food_id or not retailer_id:
                stat["preskoceno"] += 1
                continue
            radky.append(
                {
                    "food_id": food_id,
                    "retailer_id": retailer_id,
                    "cena": z["cena_za_100g"],
                    "je_sleva": z["je_sleva"],
                    "platnost_do": z.get("platnost_do"),
                    "zdroj": "open-prices",
                    "pozorovano_at": f"{z['datum']}T12:00:00+00:00" if z.get("datum") else None,
                }
            )
            stat["sparovano"] += 1
        if radky:
            r = requests.post(
                f"{self.url}/rest/v1/price_observations",
                headers={**self._hlavicky, "Prefer": "resolution=ignore-duplicates"},
                json=radky,
                timeout=60,
            )
            r.raise_for_status()
        stat["vlozeno"] = len(radky)
        return stat

    # ------------------------------------------------------------------
    # Letákové/eshopové nabídky (PriceScraper)
    # ------------------------------------------------------------------

    def _food_id_fuzzy(self, ean: str | None, nazev: str) -> str | None:
        """Párování nabídek na foods.

        Letákové názvy jsou povídavé („Mléko trvanlivé Pragolaktos –
        1,5% polotučné"), katalog má stručné názvy („Mléko trvanlivé").
        Pořadí: EAN → přesný název → token-subset → substring
        (word-boundary) → difflib ≥0.8. Preferujeme nejkonkrétnější
        shodu (delší název potraviny).
        """
        food_id = self._food_id(ean, nazev)
        if food_id:
            return food_id
        cil = normalizuj_nazev(nazev)
        cil_t = set(cil.split())
        if not cil_t:
            return None
        self.nacti_potraviny()  # naplní _norm_potraviny
        nej_id, nej_skore = None, 0.0
        for pid, fn, _p in self._norm_potraviny:
            ft = fn.split()
            fts = set(ft)
            skore = 0.0
            if ft and len(ft) >= 1 and fts <= cil_t:
                # všechna slova názvu potraviny jsou v nabídce
                skore = 0.90 + 0.01 * len(ft)
            elif len(fn) >= 4 and re.search(rf"\b{re.escape(fn)}\b", cil):
                skore = 0.88 + 0.01 * len(fn)
            elif len(cil) >= 4 and re.search(rf"\b{re.escape(cil)}\b", fn):
                skore = 0.85
            else:
                # okno: srovnej jméno potraviny s každým podřetězcem
                # nabídky stejné délky – „kuřecí prsa" vs „kuřecí
                # prsní řízky" → okno „kuřecí prsní" ≈ 0.85
                cl = cil.split()
                if len(cl) >= len(ft) and ft:
                    best_win = max(
                        difflib.SequenceMatcher(
                            None, fn, " ".join(cl[i : i + len(ft)])
                        ).ratio()
                        for i in range(len(cl) - len(ft) + 1)
                    )
                    r = max(
                        best_win,
                        difflib.SequenceMatcher(None, cil, fn).ratio(),
                    )
                else:
                    r = difflib.SequenceMatcher(None, cil, fn).ratio()
                if r >= 0.80:
                    skore = r
            if skore > nej_skore:
                nej_id, nej_skore = pid, skore
        return nej_id if nej_skore >= 0.80 else None

    def _dopln_baleni_a_obrazek(self, food_id: str, nabidka: Nabidka) -> None:
        """Doplní baleni_g/ean/obrazek z nabídky na potravinu – best-effort."""
        patch: dict = {}
        for p in self.nacti_potraviny():
            if p["id"] == food_id:
                if nabidka.gramy and not p.get("baleni_g"):
                    patch["baleni_g"] = nabidka.gramy
                if nabidka.ean and not p.get("ean"):
                    patch["ean"] = nabidka.ean
                break
        if not patch:
            return
        try:
            requests.patch(
                f"{self.url}/rest/v1/foods",
                headers={**self._hlavicky, "Prefer": "return=minimal"},
                params={"id": f"eq.{food_id}"},
                json=patch,
                timeout=30,
            )
        except requests.RequestException as e:
            log.warning("Doplnění metadat na %s selhalo: %s", food_id, e)

    def zapis_nabidky(self, nabidky: list[Nabidka], od: datetime) -> dict:
        """UPSERT nabídek do price_observations (zdroj='scraper:<obchod>').

        unique(food_id, retailer_id, pozorovano_at) → z jednoho běhu
        držíme jen NEJLEPŠÍ (nejnižší) cenu na dvojici potravina×obchod,
        jinak by stejné timestampy vyvolaly 409.
        """
        radky: dict[tuple, dict] = {}
        stat = {"sparovano": 0, "preskoceno": 0}
        ted = od.isoformat()
        for n in nabidky:
            food_id = self._food_id_fuzzy(n.ean, n.nazev)
            retailer_id = self._retailer_id(n.obchod)
            if not food_id or not retailer_id:
                stat["preskoceno"] += 1
                if len(stat.setdefault("nesparovano_nazvy", [])) < 8:
                    stat["nesparovano_nazvy"].append(n.nazev)
                continue
            self._dopln_baleni_a_obrazek(food_id, n)
            klic = (food_id, retailer_id)
            radek = {
                "food_id": food_id,
                "retailer_id": retailer_id,
                "cena": n.cena_za_100g,
                "puvodni_cena": n.puvodni_cena_za_100g,
                "je_sleva": True,
                "platnost_do": n.platnost_do,
                "zdroj": f"scraper:{n.obchod.lower()}",
                "pozorovano_at": ted,
            }
            if klic not in radky or n.cena_za_100g < radky[klic]["cena"]:
                radky[klic] = radek
            stat["sparovano"] += 1
        if stat["preskoceno"]:
            log.info(
                "Nespárováno %d nabídek, vzorek: %s",
                stat["preskoceno"], stat["nesparovano_nazvy"],
            )
        radky_list = list(radky.values())
        if radky_list:
            r = requests.post(
                f"{self.url}/rest/v1/price_observations",
                headers={**self._hlavicky, "Prefer": "resolution=ignore-duplicates"},
                json=radky_list,
                timeout=60,
            )
            r.raise_for_status()
        stat["vlozeno"] = len(radky_list)
        return stat

    def _pocet_smazanych(self, r: requests.Response) -> int:
        """Počet smazaných řádků z content-range ('*/53' s count=exact)."""
        m = re.search(r"/(\d+)$", r.headers.get("content-range", ""))
        return int(m.group(1)) if m else 0

    def purge_scrapera(self, predtim: datetime, zdroje: list[str]) -> int:
        """Stale purge: smaže scraper-pozorování neobnovená v tomto běhu –
        ale JEN u zdrojů, které v tomto běhu reálně stáhly stránku.
        Zablokovaný řetězec tak nesmaže svoje minulá data.
        """
        if not zdroje:
            return 0
        smazano = 0
        for zdroj in zdroje:
            try:
                r = requests.delete(
                    f"{self.url}/rest/v1/price_observations",
                    headers={**self._hlavicky, "Prefer": "count=exact"},
                    params={
                        "zdroj": f"eq.{zdroj}",
                        "pozorovano_at": f"lt.{predtim.isoformat()}",
                    },
                    timeout=60,
                )
                smazano += self._pocet_smazanych(r) if r.ok else 0
            except requests.RequestException as e:
                log.warning("Stale purge %s selhal: %s", zdroj, e)
        if smazano:
            log.info("Stale purge: smazáno %d starých scraper-pozorování", smazano)
        return smazano

    def purge_expirovanych(self) -> int:
        """Smaže pozorování s prošlou platností (view je filtruje taky,
        ale tabulka zůstává čistá a malá)."""
        try:
            r = requests.delete(
                f"{self.url}/rest/v1/price_observations",
                headers={**self._hlavicky, "Prefer": "count=exact"},
                params={
                    "platnost_do": f"lt.{date.today().isoformat()}",
                },
                timeout=60,
            )
            smazano = self._pocet_smazanych(r) if r.ok else 0
            if smazano:
                log.info("Purge: smazáno %d expirovaných pozorování", smazano)
            return smazano
        except requests.RequestException as e:
            log.warning("Purge expirovaných selhal: %s", e)
            return 0
