"""Rohlík.cz – plný asortiment přes veřejné JSON API webu.

Odkryté endpointy (listopad 2026, ověřeno proti živému webu):
  GET /api/v1/categories/normal/{id}
      → metadata kategorie (hasSubcategories, name, slug)
  GET /api/v1/categories/normal/{id}/products?page=N&size=200&sort=recommended&filter=&excludeProductIds=
      → productIds + pageable (max 200/stránka)
  GET /api/v1/products/card?products=id&products=id…
      → karty produktů: name, brand, unit, textualAmount, weightedItem,
        prices{originalPrice, salePrice, unitPrice, saleText, saleValidTill},
        image.path, stock.availabilityStatus

Strom kategorií: BFS od TOP_KATEGORIE; u uzlů s hasSubcategories se
stáhne HTML stránka kategorie a z ní se vytahají /c<id> odkazy na děti.

Ceny: unitPrice je Kč/kg nebo Kč/l (podle unit) → /10 = Kč/100 g.
weightedItem (vážené zboží, "cca 130 g") bere cenu přímo z unitPrice;
kusové položky bez unitPrice se normalizují přes textualAmount.
EAN Rohlík veřejně neuvádí – párování jede přes fuzzy jméno+gramáž.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Iterator, Optional

from .base import BaseScraper, Nabidka, gramaje_z_nazvu

log = logging.getLogger("scraper.rohlik")

API = "https://www.rohlik.cz/api/v1"
STRANKA = 200
MAX_STRAN_KATEGORIE = 30  # 200×30 = 6 tis. produktů na leaf – pojistka
MAX_KARTY_NA_DOTAZ = 80   # query-string limit, držíme rezervu
# strom kategorií je ~statický, BFS přes ~1 500 uzlů trvá ~15 min –
# leaf seznam se proto cachuje na disk a obnovuje max 1× týdně
STROM_CACHE = Path(__file__).with_name("rohlik_strom.json")
STROM_CACHE_STARI = 7 * 86400

TOP_KATEGORIE = {
    300101000: "Pekárna a cukrárna",
    300102000: "Ovoce a zelenina",
    300103000: "Maso a ryby",
    300104000: "Uzeniny a lahůdky",
    300105000: "Mléčné a chlazené",
    300106000: "Trvanlivé",
    300107000: "Mražené",
    300108000: "Nápoje",
    300109000: "Drogerie",
    300112393: "Speciální výživa",
    300121429: "Plant-based",
}

# topy, které nejsou jídlo – leaf se ani nestahuje (drogerie by jinak
# založila "potraviny" jako prací gel v potravinovém katalogu)
NEPOTRAVINY_TOP = {300109000}

# Rohlík top kategorie → naše kategorie
TOP_MAPA = {
    300101000: "peckoviny_obily",
    300102000: "ovoce_zelenina",
    300103000: "maso_ryby",
    300104000: "maso_ryby",
    300105000: "mlecne_vyrobky",
    300106000: "ostatni",
    300107000: "ostatni",
    300108000: "ostatni",
    300109000: "ostatni",
    300112393: "ostatni",
    300121429: "ostatni",
}


def _kc(pole) -> Optional[float]:
    """Cena z API – /products/card vrací číslo, /search/products {full: x}."""
    if isinstance(pole, dict):
        pole = pole.get("full")
    try:
        return round(float(pole), 2) if pole and float(pole) > 0 else None
    except (TypeError, ValueError):
        return None


def gramy_z_karty(karta: dict) -> Optional[float]:
    """'130 g' / 'cca 80 g' / '500 ml' z textualAmount; l/kg → ×1000."""
    return gramaje_z_nazvu(karta.get("textualAmount") or "")


def c100_z_karty(karta: dict) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """(akční Kč/100 g, původní Kč/100 g, gramy) z karty produktu.

    unitPrice = Kč za kg/l (vážené i kusové s váhovým unit).
    Kusové s unit='ks': cena balení ÷ textualAmount.
    """
    prices = karta.get("prices") or {}
    unit = karta.get("unit") or ""
    g = gramy_z_karty(karta)
    orig = _kc(prices.get("originalPrice"))
    sale = _kc(prices.get("salePrice"))
    upu = _kc(prices.get("unitPrice"))  # Kč/kg nebo Kč/l

    cena = sale or orig
    puvodni = orig if sale and orig and orig > sale else None
    if cena is None:
        return None, None, g

    if unit in ("kg", "l") and upu:
        # unitPrice = cena za kg/l → /10 je Kč/100 g (vážené i kusové)
        c100 = round(upu / 10, 2)
        p100 = None
        if puvodni and g:
            p100 = round(puvodni * 100 / g, 2)
        return c100, p100, g
    # kusové / bez unitPrice: přepočet z balení
    if g:
        c100 = round(cena * 100 / g, 2)
        p100 = round(puvodni * 100 / g, 2) if puvodni else None
        return c100, p100, g
    return None, None, g


def nabidka_z_karty(karta: dict, kategorie: str) -> Optional[Nabidka]:
    if karta.get("archived") or (karta.get("stock") or {}).get("availabilityStatus") not in (None, "AVAILABLE"):
        return None
    c100, p100, g = c100_z_karty(karta)
    if c100 is None:
        return None
    nazev = (karta.get("name") or "").strip()
    if not nazev:
        return None
    prices = karta.get("prices") or {}
    sale_do = prices.get("saleValidTill")  # ISO datum nebo None
    img = (karta.get("image") or {}).get("path")
    return Nabidka(
        nazev=nazev[:200],
        obchod="Rohlík.cz",
        cena_za_100g=c100,
        puvodni_cena_za_100g=p100,
        gramy=g,
        obrazek=img if isinstance(img, str) and img.startswith("http") else None,
        platnost_do=(sale_do or "")[:10] or None,
        sleva_procenta=round((1 - c100 / p100) * 100) if p100 and p100 > c100 else None,
        je_sleva=p100 is not None,
        kategorie=kategorie,
        znacka=karta.get("brand") or None,
        extra={"rohlik_id": karta.get("productId"), "slug": karta.get("slug")},
    )


class RohlikScraper(BaseScraper):
    """Plný katalog Rohlíku – asortimentní ceny + eshopové akce."""

    obchod = "Rohlík.cz"
    zdroj = "asortiment"

    def __init__(self, pauza: float = 0.6, max_kategorii: Optional[int] = None,
                 obnov_strom: bool = False):
        super().__init__(pauza)
        self.max_kategorii = max_kategorii
        self.obnov_strom = obnov_strom
        # coverage accounting: selhání requestu ≠ prázdná kategorie
        self._leaf_chyba = False
        self.leaf_celkem = 0
        self.leaf_selhalo = 0
        self.leaf_prazdnych = 0

    # --- strom kategorií ------------------------------------------

    def _deti(self, cid: int) -> list[int]:
        """Ids podkategorií – čisté JSON API (≈150 B vs 600 kB HTML)."""
        d = self._get_json(f"{API}/categories/normal/{cid}/subcategories")
        return list(d.get("categoryIds") or []) if d else []

    def _listove_kategorie(self) -> dict[int, int]:
        """BFS: leaf categoryId → top categoryId. Cache na 7 dní – denní
        běh tak skáče rovnou na produkty, strom se předává --obnov-strom."""
        if not self.obnov_strom:
            try:
                c = json.loads(STROM_CACHE.read_text(encoding="utf-8"))
                if time.time() - c.get("ts", 0) < STROM_CACHE_STARI and c.get("leaf"):
                    leaf = {int(k): int(v) for k, v in c["leaf"].items()}
                    log.info("%s: strom z cache (%d leaf kategorií)",
                             self.obchod, len(leaf))
                    return leaf
            except (OSError, ValueError):
                pass
        leaf_top = self._bfs_listi()
        try:
            STROM_CACHE.write_text(json.dumps(
                {"ts": time.time(),
                 "leaf": {str(k): v for k, v in leaf_top.items()}},
                ensure_ascii=False), encoding="utf-8")
        except OSError as e:
            log.warning("%s: cache stromu se nepodařilo uložit: %s", self.obchod, e)
        return leaf_top

    def _bfs_listi(self) -> dict[int, int]:
        """BFS: leaf categoryId → top categoryId (pro mapování kategorií)."""
        leaf_top: dict[int, int] = {}
        for top in TOP_KATEGORIE:
            fronta = [top]
            navstivene = {top}
            meznik = 0
            while fronta:
                cid = fronta.pop()
                if len(navstivene) - meznik >= 30:
                    meznik = len(navstivene)
                    log.info("%s: BFS %s – navštíveno %d, leaf %d",
                             self.obchod, top, len(navstivene), len(leaf_top))
                deti = self._deti(cid)
                if deti:
                    for dite in deti:
                        if dite not in navstivene:
                            navstivene.add(dite)
                            fronta.append(dite)
                else:
                    leaf_top[cid] = top
            log.info("%s: kategorie %s → %d leaf kategorií (celkem %d)",
                     self.obchod, top,
                     sum(1 for v in leaf_top.values() if v == top), len(leaf_top))
        return leaf_top

    # --- produkty ---------------------------------------------------

    def _ids_kategorie(self, cid: int) -> list[int]:
        ids: list[int] = []
        for strana in range(MAX_STRAN_KATEGORIE):
            d = self._get_json(
                f"{API}/categories/normal/{cid}/products",
                params={
                    "page": strana, "size": STRANKA, "sort": "recommended",
                    "filter": "", "excludeProductIds": "",
                },
            )
            if d is None:
                self._leaf_chyba = True
                break
            stranka_ids = d.get("productIds") or []
            ids.extend(stranka_ids)
            if len(stranka_ids) < STRANKA:
                break
        return ids

    def _karty(self, ids: list[int]) -> Iterator[dict]:
        for i in range(0, len(ids), MAX_KARTY_NA_DOTAZ):
            davka = ids[i : i + MAX_KARTY_NA_DOTAZ]
            d = self._get_json(
                f"{API}/products/card",
                params=[("products", pid) for pid in davka],
            )
            if d is None:
                self._leaf_chyba = True
                continue
            if isinstance(d, list):
                yield from d
            elif isinstance(d, dict):
                yield from d.get("data") or []

    def stahni_slevy(self) -> Iterator[Nabidka]:
        # fetched označíme až po prvním reálném produktu – prázdná/dohozená
        # odezva API nesmí spustit stale purge (vymazal by platnou historii)
        leaf_top = self._listove_kategorie()
        leaf_top = {k: v for k, v in leaf_top.items()
                    if v not in NEPOTRAVINY_TOP}
        if self.max_kategorii:
            leaf_top = dict(sorted(leaf_top.items())[: self.max_kategorii])
        self.leaf_celkem = len(leaf_top)
        log.info("%s: %d leaf kategorií k průchodu", self.obchod, len(leaf_top))
        videni: set[int] = set()
        for cid, top in sorted(leaf_top.items()):
            self._leaf_chyba = False
            ids = [x for x in self._ids_kategorie(cid) if x not in videni]
            videni.update(ids)
            n = 0
            for karta in self._karty(ids):
                nab = nabidka_z_karty(karta, TOP_MAPA.get(top, "ostatni"))
                if nab:
                    self.fetched = True
                    self.nalezeno += 1
                    n += 1
                    yield nab
            if self._leaf_chyba:
                self.leaf_selhalo += 1
            elif n == 0:
                self.leaf_prazdnych += 1
            log.info("%s: %s → %d produktů (celkem %d)", self.obchod, cid, n, self.nalezeno)
        log.info(
            "%s: pokrytí %d/%d leaf OK, %d selhalo, %d prázdných",
            self.obchod, self.leaf_celkem - self.leaf_selhalo,
            self.leaf_celkem, self.leaf_selhalo, self.leaf_prazdnych,
        )
