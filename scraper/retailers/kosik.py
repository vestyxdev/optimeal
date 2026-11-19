"""Košík.cz – plný asortiment přes veřejné JSON API webu.

Odkryté endpointy (listopad 2026, ověřeno proti živému webu):
  GET /api/front/page/products/flexible?vendor=1&slug=<leaf-slug>&limit=30
      &search_term=&page_display=full&platform=web
      → products{totalCount, items[], cursor}, subCategories[] (děti)
  POST /api/front/products/more {"cursor": "…"}
      → {products: […další items], cursor: "…"} (≈10/stránka)

Strom: BFS přes subCategories[].url z každé kategorie (top slugs níže).
Produkt: id, name, brand.name, price, recommendedPrice (přeškrtnutá),
percentageDiscount, productQuantity{value,unit}, unit, url, image.
EAN Košík neuvádí – párování jede přes fuzzy jméno+gramáž.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka, ceny_na_100g, gramaje_z_nazvu

log = logging.getLogger("scraper.kosik")

API = "https://www.kosik.cz/api/front"
STRANKA = 30
MAX_STRAN_LEAF = 80      # cursor ~10/strana u /more; pojistka proti zacyklení
MAX_KATEGORII = 400      # bezpečnostní strop BFS
# BFS přes ~800 slugů trvá minuty – leaf seznam se cachuje na disk,
# obnovuje max 1× týdně (nebo --obnov-strom)
STROM_CACHE = Path(__file__).with_name("kosik_strom.json")
STROM_CACHE_STARI = 7 * 86400

TOP_SLUGY = {
    "c1026-pekarna-a-cukrarna": "peckoviny_obily",
    "c985-ovoce-a-zelenina": "ovoce_zelenina",
    "c960-maso-drubez-a-ryby": "maso_ryby",
    "c1046-uzeniny-a-lahudky": "maso_ryby",
    "c898-mlecne-a-chlazene": "mlecne_vyrobky",
    "c1211-trvanlive": "ostatni",
    "c1083-mrazene": "ostatni",
    "c1107-napoje": "ostatni",
    "c36779-zdravi-a-zivotni-styl": "ostatni",
    "c1455-drogerie": "ostatni",
}

_JEDNOTKY_G = {"g": 1.0, "kg": 1000.0, "ml": 1.0, "cl": 10.0, "l": 1000.0}


def gramy_z_produktu(p: dict) -> Optional[float]:
    """productQuantity{value,unit} → gramy; fallback název ("500 g")."""
    pq = p.get("productQuantity") or {}
    try:
        v = float(pq.get("value") or 0)
        u = (pq.get("unit") or "").lower()
        if v > 0 and u in _JEDNOTKY_G:
            g = v * _JEDNOTKY_G[u]
            if 2 <= g <= 20000:
                return g
    except (TypeError, ValueError):
        pass
    return gramaje_z_nazvu(p.get("name") or "")


def c100_z_produktu(p: dict) -> tuple[Optional[float], Optional[float]]:
    """(akční Kč/100 g, původní Kč/100 g).

    pricePerUnit (Kč/kg|l) má přednost; jinak cena balení ÷ gramáž.
    recommendedPrice = přeškrtnutá cena při akci.
    """
    cena = p.get("price")
    try:
        cena = float(cena) if cena is not None else None
    except (TypeError, ValueError):
        cena = None
    if not cena or cena <= 0:
        return None, None
    orig = p.get("recommendedPrice")
    try:
        orig = float(orig) if orig else None
    except (TypeError, ValueError):
        orig = None
    puvodni = orig if orig and orig > cena else None

    ppu = p.get("pricePerUnit")
    jednotka_ppu = str(ppu.get("unit") if isinstance(ppu, dict) else p.get("unit") or "").lower()
    if isinstance(ppu, (int, float)) and ppu > 0 and jednotka_ppu in ("kg", "l"):
        c100 = round(float(ppu) / 10, 2)
        p100 = round(puvodni * 100 / gramy_z_produktu(p), 2) if puvodni and gramy_z_produktu(p) else None
        return c100, p100

    g = gramy_z_produktu(p)
    c100 = ceny_na_100g(cena, g)
    p100 = ceny_na_100g(puvodni, g) if puvodni else None
    return c100, p100


def nabidka_z_produktu(p: dict, kategorie: str) -> Optional[Nabidka]:
    nazev = (p.get("name") or "").strip()
    if not nazev:
        return None
    c100, p100 = c100_z_produktu(p)
    if c100 is None:
        return None
    pct = p.get("percentageDiscount")
    img = p.get("image")
    if isinstance(img, dict):
        img = img.get("url") or img.get("path")
    brand = p.get("brand")
    return Nabidka(
        nazev=nazev[:200],
        obchod="Košík.cz",
        cena_za_100g=c100,
        puvodni_cena_za_100g=p100,
        gramy=gramy_z_produktu(p),
        obrazek=img if isinstance(img, str) and img.startswith("http") else None,
        platnost_do=None,  # běžná/akční eshopová cena bez udané platnosti
        sleva_procenta=round(float(pct)) if pct else (
            round((1 - c100 / p100) * 100) if p100 and p100 > c100 else None
        ),
        je_sleva=bool(p100) or bool(p.get("isSale")),
        kategorie=kategorie,
        znacka=(brand or {}).get("name") if isinstance(brand, dict) else None,
        extra={"kosik_id": p.get("id")},
    )


class KosikScraper(BaseScraper):
    """Plný katalog Košíku – asortimentní ceny + eshopové akce."""

    obchod = "Košík.cz"
    zdroj = "asortiment"

    def __init__(self, pauza: float = 0.6, max_kategorii: Optional[int] = None,
                 obnov_strom: bool = False):
        super().__init__(pauza)
        self.max_kategorii = max_kategorii
        self.obnov_strom = obnov_strom
        # BFS už každý leaf načte – první stránku produktů si zapamatujeme,
        # ať ji _produkty_leaf nemusí tahat znovu (polovina requestů)
        self._prvni_stranka: dict[str, dict] = {}

    # --- strom kategorií ----------------------------------------------

    def _stranka(self, slug: str) -> Optional[dict]:
        return self._get_json(
            f"{API}/page/products/flexible",
            params={
                "vendor": 1, "slug": slug, "limit": STRANKA,
                "search_term": "", "page_display": "full", "platform": "web",
            },
        )

    def _listove_slugy(self) -> dict[str, str]:
        """{leaf slug: naše kategorie} – z cache (7 dní) nebo BFS."""
        if not self.obnov_strom:
            try:
                c = json.loads(STROM_CACHE.read_text(encoding="utf-8"))
                if time.time() - c.get("ts", 0) < STROM_CACHE_STARI and c.get("leaf"):
                    log.info("%s: strom z cache (%d leaf slugů)",
                             self.obchod, len(c["leaf"]))
                    return dict(c["leaf"])
            except (OSError, ValueError):
                pass
        leaf = self._bfs_slugy()
        try:
            STROM_CACHE.write_text(json.dumps(
                {"ts": time.time(), "leaf": leaf}, ensure_ascii=False),
                encoding="utf-8")
        except OSError as e:
            log.warning("%s: cache stromu se nepodařilo uložit: %s", self.obchod, e)
        return leaf

    def _bfs_slugy(self) -> dict[str, str]:
        """BFS přes subCategories[] → {leaf slug: naše kategorie}."""
        leaf: dict[str, str] = {}
        videni: set[str] = set()  # globální – křížové odkazy mezi topy
        for slug, kat in TOP_SLUGY.items():  # nechtějí zdvojené fetch
            if slug in videni:
                continue
            fronta = [slug]
            videni.add(slug)
            meznik = 0
            while fronta and len(videni) < MAX_KATEGORII:
                s = fronta.pop()
                if len(videni) - meznik >= 20:
                    meznik = len(videni)
                    log.info("%s: BFS %s – navštíveno %d, leaf %d",
                             self.obchod, slug, len(videni), len(leaf))
                d = self._stranka(s)
                if not d:
                    continue
                deti = [c["url"].lstrip("/") for c in d.get("subCategories") or [] if c.get("url")]
                if deti:
                    for dite in deti:
                        if dite not in videni:
                            videni.add(dite)
                            fronta.append(dite)
                else:
                    leaf[s] = kat
                    if d.get("products"):
                        self._prvni_stranka[s] = d["products"]
            log.info("%s: top %s → %d leaf slugů", self.obchod, slug,
                     sum(1 for k in leaf.values() if k == kat))
        return leaf

    # --- produkty -------------------------------------------------------

    def _produkty_leaf(self, slug: str) -> Iterator[dict]:
        pr = self._prvni_stranka.pop(slug, None)
        if pr is None:
            d = self._stranka(slug)
            if not d:
                return
            pr = d.get("products") or {}
        for item in pr.get("items") or []:
            yield item
        cursor = pr.get("cursor")
        celkem = pr.get("totalCount") or 0
        nacteno = len(pr.get("items") or [])
        for _ in range(MAX_STRAN_LEAF):
            if not cursor or nacteno >= celkem:
                break
            d2 = self._post_json(f"{API}/products/more", {"cursor": cursor})
            if not d2:
                break
            dalsi = d2.get("products") or []
            if not dalsi:
                break
            for item in dalsi:
                yield item
            nacteno += len(dalsi)
            cursor = d2.get("cursor") or cursor

    def _post_json(self, url: str, body: dict) -> Optional[dict]:
        """POST s retry/backoffem – protiklad _get pro /products/more."""
        import time
        import requests
        from .base import POKUSY
        for pokus in range(1, POKUSY + 1):
            try:
                r = self.session.post(url, json=body, timeout=30)
                if r.status_code == 200:
                    time.sleep(self.pauza * 0.7)
                    return r.json()
                if r.status_code in (403, 429) and pokus < POKUSY:
                    self._rotuj_ua()
                    time.sleep(3**pokus)
                    continue
                log.warning("%s: POST %s → %d", self.obchod, url, r.status_code)
                return None
            except requests.RequestException:
                if pokus == POKUSY:
                    return None
                time.sleep(2**pokus)
        return None

    def stahni_slevy(self) -> Iterator[Nabidka]:
        # fetched až po prvním reálném produktu (stejná pojistka jako Rohlík)
        leaf = self._listove_slugy()
        log.info("%s: %d leaf kategorií k průchodu", self.obchod, len(leaf))
        videni: set[int] = set()
        for i, (slug, kat) in enumerate(sorted(leaf.items())):
            if self.max_kategorii and i >= self.max_kategorii:
                break
            n = 0
            for p in self._produkty_leaf(slug):
                pid = p.get("id")
                if pid in videni:
                    continue
                videni.add(pid)
                nab = nabidka_z_produktu(p, kat)
                if nab:
                    self.fetched = True
                    self.nalezeno += 1
                    n += 1
                    yield nab
            log.info("%s: %s → %d produktů (celkem %d)", self.obchod, slug, n, self.nalezeno)
