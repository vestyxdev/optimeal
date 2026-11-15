"""Scrapery jednotlivých českých řetězců."""

from .albert import AlbertScraper
from .billa import BillaScraper
from .globus import GlobusScraper
from .penny import PennyScraper
from .schwarz import KauflandScraper, LidlScraper
from .tesco import TescoScraper

SCRAPERY = [
    KauflandScraper,
    LidlScraper,
    AlbertScraper,
    BillaScraper,
    TescoScraper,
    PennyScraper,
    GlobusScraper,
]

__all__ = [
    "AlbertScraper", "BillaScraper", "GlobusScraper", "KauflandScraper",
    "LidlScraper", "PennyScraper", "SCRAPERY", "TescoScraper",
]
