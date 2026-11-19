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

from .normalizace import normalizuj_nazev, stem_nazev
from .retailers.base import Nabidka, je_potravina

log = logging.getLogger("scraper.db")


def _platna_puvodni(puvodni: float, cena: float) -> bool:
    """Sanity ověřené původní ceny – stejné meze jako view aktualni_ceny:
    musí znamenat aspoň ~1 % slevu a nesmí přesáhnout 4× akční cenu
    (nad tím jde o pack-mismatch artefakt, ne o reálnou přeškrtnutou cenu)."""
    return (
        puvodni > 0
        and cena > 0
        and puvodni >= cena * 1.01
        and puvodni <= cena * 4
    )


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
        self._norm_potraviny: list[tuple] = []
        self._token_index: dict[str, set[int]] | None = None
        self._nazev_index: dict[str, str] = {}
        self._ean_index: dict[str, str] = {}
        self._id_index: dict[str, dict] = {}
        self._indexy_hotove = False

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
            # PostgREST vrací max ~1000 řádků na dotaz – stránkujeme,
            # jinak matcher vidí jen zlomek katalogu (6389 potravin!)
            self._potraviny = []
            offset = 0
            while True:
                davka = self._get(
                    "foods", "id,nazev,ean,baleni_g,obrazek,externi_id",
                    offset=offset, limit=1000,
                )
                self._potraviny.extend(davka)
                if len(davka) < 1000:
                    break
                offset += 1000
            log.info("Načteno %d potravin pro párování", len(self._potraviny))
        if not self._indexy_hotove:
            self._norm_potraviny = [
                (p["id"], normalizuj_nazev(p["nazev"]), stem_nazev(p["nazev"]), p)
                for p in self._potraviny
            ]
            # O(1) indexy – _food_id běží na KAŽDOU nabídku (desetitisíce
            # za běh); lineární průchod s normalizuj_nazev na řádek by
            # stál ~350 ms na nabídku → hodiny navíc
            self._id_index = {p["id"]: p for p in self._potraviny}
            self._nazev_index = {
                normalizuj_nazev(p["nazev"]): p["id"] for p in self._potraviny
            }
            self._ean_index = {
                p["ean"]: p["id"] for p in self._potraviny if p.get("ean")
            }
            # invertovaný index token→idx pro fuzzy match – bez něj běží
            # difflib proti ~7 tis. potravinám na KAŽDÝ produkt (minuty);
            # s ním jen proti desítkám kandidátů se společným tokenem
            self._token_index = {}
            for idx, (_pid, fn, fstem, _p) in enumerate(self._norm_potraviny):
                for t in set(fn.split()) | set(fstem.split()):
                    self._token_index.setdefault(t, set()).add(idx)
            self._indexy_hotove = True
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
                p = self._id_index.get(food_id)
                if p is not None:
                    p["ean"] = ean
                self._ean_index[ean] = food_id
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
        self.nacti_potraviny()
        if ean and ean in self._ean_index:
            return self._ean_index[ean]
        if nazev_produktu:
            cil = normalizuj_nazev(nazev_produktu)
            fid = self._nazev_index.get(cil)
            if fid:
                p = self._id_index[fid]
                if ean and not p.get("ean"):
                    self._dopln_ean(fid, ean)
                return fid
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
        cil_stem = stem_nazev(nazev)
        cil_stem_t = set(cil_stem.split())
        self.nacti_potraviny()  # naplní _norm_potraviny + _token_index
        # kandidáti = potraviny sdílející aspoň jeden token/kmen s nabídkou;
        # prázdná množina → žádná lexikálně podobná potravina neexistuje
        kandidati: set[int] = set()
        for t in cil_t | cil_stem_t:
            kandidati |= self._token_index.get(t, set())
        if not kandidati:
            return None
        nej_id, nej_skore = None, 0.0
        for idx in kandidati:
            pid, fn, fstem, _p = self._norm_potraviny[idx]
            ft = fn.split()
            fts = set(ft)
            fst = set(fstem.split())
            skore = 0.0
            if ft and len(ft) >= 1 and fts <= cil_t:
                # všechna slova názvu potraviny jsou v nabídce
                skore = 0.90 + 0.01 * len(ft)
            elif fst and fst <= cil_stem_t:
                # totéž na kmenech – „citrony" nabídka ≈ „citrón" katalog
                skore = 0.89 + 0.01 * len(fst)
            elif len(fn) >= 4 and re.search(rf"\b{re.escape(fn)}\b", cil):
                skore = 0.88 + 0.01 * len(fn)
            elif len(fstem) >= 4 and re.search(rf"\b{re.escape(fstem)}\b", cil_stem):
                skore = 0.87 + 0.01 * len(fstem)
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

    @staticmethod
    def _externi_id(nabidka: Nabidka) -> str | None:
        """ID produktu u eshopu z nabídky (rohlik_id / kosik_id) –
        obohaceni_eshop.py díky němu dohledá nutriční hodnoty přímo
        u zdroje."""
        ext = nabidka.extra or {}
        eid = ext.get("rohlik_id") or ext.get("kosik_id")
        return str(eid) if eid else None

    def _dopln_baleni_a_obrazek(self, food_id: str, nabidka: Nabidka) -> None:
        """Doplní baleni_g/ean/obrazek/externi_id – best-effort."""
        patch: dict = {}
        self.nacti_potraviny()
        p = self._id_index.get(food_id)
        if p is not None:
            if nabidka.gramy and not p.get("baleni_g"):
                patch["baleni_g"] = nabidka.gramy
            if nabidka.ean and not p.get("ean"):
                patch["ean"] = nabidka.ean
            if nabidka.obrazek and not p.get("obrazek"):
                patch["obrazek"] = nabidka.obrazek
            if not p.get("externi_id"):
                eid = self._externi_id(nabidka)
                if eid:
                    patch["externi_id"] = eid
        if not patch:
            return
        try:
            r = requests.patch(
                f"{self.url}/rest/v1/foods",
                headers={**self._hlavicky, "Prefer": "return=minimal"},
                params={"id": f"eq.{food_id}"},
                json=patch,
                timeout=30,
            )
            if r.ok:
                # in-memory taky – jinak se totáž potravina patchuje
                # znovu u každé další nabídky (stovky zbytečných PATCH)
                p.update(patch)
                if "ean" in patch:
                    self._ean_index[patch["ean"]] = food_id
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
            # sanity: cena mimo reálné meze Kč/100 g = parse chyba
            # (migrace 0040 má stejný CHECK jako pojistku)
            if not n.cena_za_100g or not (0.3 <= n.cena_za_100g < 400):
                stat["preskoceno"] += 1
                stat.setdefault("anomalie_ceny", []).append(
                    f"{n.nazev} {n.cena_za_100g}"
                )
                continue
            puvodni = n.puvodni_cena_za_100g
            if puvodni is not None and not _platna_puvodni(puvodni, n.cena_za_100g):
                stat.setdefault("anomalie_puvodni", []).append(
                    f"{n.nazev} {puvodni}>{n.cena_za_100g}")
                puvodni = None
            klic = (food_id, retailer_id)
            radek = {
                "food_id": food_id,
                "retailer_id": retailer_id,
                "cena": n.cena_za_100g,
                "puvodni_cena": puvodni,
                "puvodni_zdroj": "letak" if puvodni is not None else None,
                "je_sleva": n.je_sleva,
                "platnost_do": n.platnost_do,
                "baleni_g": n.gramy,
                "kupi_slug": (n.extra or {}).get("kupi_slug"),
                "zdroj": f"scraper:{n.obchod.lower()}",
                "pozorovano_at": ted,
            }
            if klic not in radky or n.cena_za_100g < radky[klic]["cena"]:
                radky[klic] = radek
            stat["sparovano"] += 1
        if stat["preskoceno"]:
            log.info(
                "Nespárováno %d nabídek, vzorek: %s",
                stat["preskoceno"], stat.get("nesparovano_nazvy", []),
            )
        if stat.get("anomalie_ceny"):
            log.warning(
                "Přeskočeno %d anomálních cen, vzorek: %s",
                len(stat["anomalie_ceny"]), stat["anomalie_ceny"][:8],
            )
        if stat.get("anomalie_puvodni"):
            log.warning(
                "Zahozeno %d neplatných původních cen, vzorek: %s",
                len(stat["anomalie_puvodni"]), stat["anomalie_puvodni"][:8],
            )
        radky_list = list(radky.values())
        # počet ověřených slev (puvodni_cena ze zdroje) – souhrn běhu
        stat["overenych_slev"] = sum(
            1 for r in radky_list if r["puvodni_cena"] is not None
        )
        vlozeno = 0
        # dávky po 500 – stejně jako zapis_asortiment; jedna velká dávka
        # by u tisíců řádků mohla timeoutovat a padala na řádkový fallback
        for i in range(0, len(radky_list), 500):
            davka = radky_list[i : i + 500]
            r = requests.post(
                f"{self.url}/rest/v1/price_observations",
                headers={**self._hlavicky, "Prefer": "resolution=ignore-duplicates"},
                json=davka,
                timeout=60,
            )
            if r.ok:
                vlozeno += len(davka)
                continue
            # otravná řádka nesmí shodit celý letákový běh – logni
            # detail PostgREST (constraint + klíč) a projdi po řádkách
            log.error("Dávka letákových cen %d: HTTP %d – %s",
                      len(davka), r.status_code, r.text[:400])
            for radek in davka:
                rr = requests.post(
                    f"{self.url}/rest/v1/price_observations",
                    headers={**self._hlavicky,
                             "Prefer": "resolution=ignore-duplicates"},
                    json=[radek],
                    timeout=30,
                )
                if rr.ok:
                    vlozeno += 1
                else:
                    log.error("Odmítnuta řádka %s: %d %s",
                              radek.get("food_id"), rr.status_code,
                              rr.text[:200])
        stat["vlozeno"] = vlozeno
        return stat

    def vytvor_potravinu(self, n: Nabidka) -> str | None:
        """Založí potravinu z eshopové nabídky – schválenou hned
        (zdroj je důvěryhodný eshop; jen makra chybí a ty doplní
        obohaceni.py z Open Food Facts – kalorie=0 generátor ignoruje).
        Vrací foods.id nebo None."""
        radka = {
            "nazev": n.nazev[:200],
            "kategorie": n.kategorie or "ostatni",
            "bilkoviny": 0, "sacharidy": 0, "tuky": 0, "kalorie": 0,
            "bezna_cena": n.cena_za_100g,
            "baleni_g": n.gramy,
            "ean": n.ean,
            "obrazek": n.obrazek,
            "externi_id": self._externi_id(n),
            "zdroj": f"eshop:{n.obchod.lower()}",
            "schvaleno": True,
        }
        try:
            r = requests.post(
                f"{self.url}/rest/v1/foods",
                headers={**self._hlavicky,
                         "Prefer": "return=representation,resolution=ignore-duplicates"},
                json=radka,
                timeout=30,
            )
            if r.ok and r.json():
                fid = r.json()[0]["id"]
                # novinka v cache – další stejnojmenné nabídky se spárují
                nova = {"id": fid, "nazev": radka["nazev"], "ean": n.ean,
                        "baleni_g": n.gramy, "obrazek": n.obrazek,
                        "externi_id": radka["externi_id"]}
                self._potraviny.append(nova)
                fn = normalizuj_nazev(nova["nazev"])
                fstem = stem_nazev(nova["nazev"])
                idx = len(self._norm_potraviny)
                self._norm_potraviny.append((fid, fn, fstem, nova))
                if self._token_index is not None:
                    for t in set(fn.split()) | set(fstem.split()):
                        self._token_index.setdefault(t, set()).add(idx)
                self._id_index[fid] = nova
                self._nazev_index[fn] = fid
                if n.ean:
                    self._ean_index[n.ean] = fid
                return fid
            # duplicitní název → dohledej existující
            self.nacti_potraviny()
            return self._nazev_index.get(normalizuj_nazev(n.nazev[:200]))
        except requests.RequestException as e:
            log.warning("Založení potraviny '%s' selhalo: %s", n.nazev[:50], e)
        return None

    def zapis_asortiment(self, nabidky: list[Nabidka], od: datetime,
                         vytvarej: bool = True) -> dict:
        """UPSERT asortimentních cen (zdroj='asortiment:<obchod>').

        Stejná logika jako zapis_nabidky, plus: nespárované produkty
        zakládají jako nové potraviny (schvaleno=false), takže se
        pokryje celý eshopový sortiment – obohaceni.py je pak doplní.
        """
        radky: dict[tuple, dict] = {}
        stat = {"sparovano": 0, "preskoceno": 0, "nove_potraviny": 0}
        ted = od.isoformat()
        # klíče už zapsané dřívějším flushem – týž produkt bývá v eshopu
        # pod několika kategoriemi; bez toho se po flushi znovu zařadí
        # a insert narazí na unique(food_id,retailer_id,pozorovano_at)
        zapsane: set[tuple] = set()

        def flush() -> None:
            # průběžný flush – kdyby job umřel (timeout) uprostřed zápisu,
            # nepřijde se o desetitisíce už spárovaných řádků
            nonlocal radky
            if not radky:
                return
            davky = list(radky.values())
            # počet ověřených slev (puvodni_cena ze zdroje) – souhrn běhu
            stat["overenych_slev"] = stat.get("overenych_slev", 0) + sum(
                1 for r in davky if r["puvodni_cena"] is not None
            )
            for i in range(0, len(davky), 500):
                davka = davky[i : i + 500]
                r = requests.post(
                    f"{self.url}/rest/v1/price_observations",
                    headers={**self._hlavicky,
                             "Prefer": "resolution=ignore-duplicates"},
                    json=davka,
                    timeout=120,
                )
                if r.ok:
                    stat["vlozeno"] = stat.get("vlozeno", 0) + len(davka)
                    continue
                # jediná otravná řádka nesmí shodit celou dávku (ani běh) –
                # zaloguj detail PostgREST (jmenuje constraint i klíč)
                # a dávku projeď po řádkách, validní se zapíšou
                log.error(
                    "Dávka pozorování %d: HTTP %d – %s",
                    len(davka), r.status_code, r.text[:400],
                )
                for radek in davka:
                    rr = requests.post(
                        f"{self.url}/rest/v1/price_observations",
                        headers={**self._hlavicky,
                                 "Prefer": "resolution=ignore-duplicates"},
                        json=[radek],
                        timeout=30,
                    )
                    if rr.ok:
                        stat["vlozeno"] = stat.get("vlozeno", 0) + 1
                    else:
                        stat.setdefault("odmitnute", []).append(
                            f"{radek['food_id']}:{radek['cena']} → {rr.status_code} {rr.text[:200]}"
                        )
            zapsane.update(radky)
            radky = {}

        for n in nabidky:
            if not je_potravina(n.nazev):
                stat["preskoceno"] += 1
                continue
            food_id = self._food_id_fuzzy(n.ean, n.nazev)
            if not food_id and vytvarej:
                food_id = self.vytvor_potravinu(n)
                if food_id:
                    stat["nove_potraviny"] += 1
            retailer_id = self._retailer_id(n.obchod)
            if not food_id or not retailer_id:
                stat["preskoceno"] += 1
                if len(stat.setdefault("nesparovano_nazvy", [])) < 8:
                    stat["nesparovano_nazvy"].append(n.nazev)
                continue
            self._dopln_baleni_a_obrazek(food_id, n)
            if not n.cena_za_100g or not (0.3 <= n.cena_za_100g < 400):
                stat["preskoceno"] += 1
                stat.setdefault("anomalie_ceny", []).append(
                    f"{n.nazev} {n.cena_za_100g}")
                continue
            puvodni = n.puvodni_cena_za_100g
            if puvodni is not None and not _platna_puvodni(puvodni, n.cena_za_100g):
                stat.setdefault("anomalie_puvodni", []).append(
                    f"{n.nazev} {puvodni}>{n.cena_za_100g}")
                puvodni = None
            klic = (food_id, retailer_id)
            radek = {
                "food_id": food_id,
                "retailer_id": retailer_id,
                "cena": n.cena_za_100g,
                "puvodni_cena": puvodni,
                "puvodni_zdroj": "eshop" if puvodni is not None else None,
                "je_sleva": n.je_sleva,
                "platnost_do": n.platnost_do,
                "baleni_g": n.gramy,
                "kupi_slug": (n.extra or {}).get("kupi_slug"),
                "zdroj": f"asortiment:{n.obchod.lower()}",
                "pozorovano_at": ted,
            }
            if klic in zapsane:
                stat["sparovano"] += 1
                continue
            if klic not in radky or n.cena_za_100g < radky[klic]["cena"]:
                radky[klic] = radek
            stat["sparovano"] += 1
            if len(radky) >= 2000:
                flush()
        if stat["preskoceno"]:
            log.info("Přeskočeno %d nabídek, vzorek: %s",
                     stat["preskoceno"], stat.get("nesparovano_nazvy", []))
        if stat.get("anomalie_ceny"):
            log.warning("Anomální ceny %d, vzorek: %s",
                        len(stat["anomalie_ceny"]), stat["anomalie_ceny"][:8])
        if stat.get("anomalie_puvodni"):
            log.warning("Zahozeno %d neplatných původních cen, vzorek: %s",
                        len(stat["anomalie_puvodni"]),
                        stat["anomalie_puvodni"][:8])
        flush()
        if stat.get("odmitnute"):
            log.error("Odmítnuto %d řádků, vzorek: %s",
                      len(stat["odmitnute"]), stat["odmitnute"][:5])
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
