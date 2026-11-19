"""Scrapery jednotlivých českých řetězců.

SCRAPERY – letákové akce přes Kupi.cz (ceniky.py).
ASORTIMENT_SCRAPERY – plný eshopový sortiment přes interní JSON API
(asortiment.py): Rohlík.cz + Košík.cz. iTesco je za WAF – promo
pokrytí Tesca zůstává na Kupi.cz.
"""

from .kosik import KosikScraper as KosikAsortimentScraper
from .rohlik import RohlikScraper as RohlikAsortimentScraper
from .kupi import (
    AlbertScraper,
    BillaScraper,
    CbaScraper,
    CoopScraper,
    DmScraper,
    FlopTopScraper,
    GlobusScraper,
    HruskaScraper,
    KauflandScraper,
    KosikScraper,
    LidlScraper,
    PennyScraper,
    RossmannScraper,
    TescoScraper,
    TetaScraper,
    ZemanScraper,
)

SCRAPERY = [
    KauflandScraper,
    LidlScraper,
    AlbertScraper,
    BillaScraper,
    TescoScraper,
    PennyScraper,
    GlobusScraper,
    CoopScraper,
    HruskaScraper,
    FlopTopScraper,
    CbaScraper,
    KosikScraper,
    DmScraper,
    RossmannScraper,
    TetaScraper,
    ZemanScraper,
]

ASORTIMENT_SCRAPERY = [
    RohlikAsortimentScraper,
    KosikAsortimentScraper,
]

__all__ = [
    "AlbertScraper", "ASORTIMENT_SCRAPERY", "BillaScraper", "CbaScraper",
    "CoopScraper", "DmScraper", "FlopTopScraper", "GlobusScraper",
    "HruskaScraper", "KauflandScraper", "KosikAsortimentScraper",
    "KosikScraper", "LidlScraper", "PennyScraper",
    "RohlikAsortimentScraper", "RossmannScraper", "SCRAPERY",
    "TescoScraper", "TetaScraper", "ZemanScraper",
]
