"""Zápis do Supabase přes PostgREST se service-role klíčem (server-side).

Service-role klíč NIKDY nepatří do frontendu – tady běží na serveru
(GitHub Actions runner) a má oprávnění zapisovat do price_observations.
"""

from __future__ import annotations

import logging
import os

import requests

from .normalizace import normalizuj_nazev

log = logging.getLogger("scraper.db")


class SupabaseWriter:
    def __init__(self, url: str | None = None, klic: str | None = None):
        self.url = (url or os.environ["SUPABASE_URL"]).rstrip("/")
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
            self._potraviny = self._get("foods", "id,nazev,ean")
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
