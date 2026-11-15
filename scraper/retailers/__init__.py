"""Scrapery jednotlivých českých řetězců (všechny přes Kupi.cz)."""

from .kupi import (
    AlbertScraper,
    BillaScraper,
    GlobusScraper,
    KauflandScraper,
    LidlScraper,
    PennyScraper,
    TescoScraper,
)

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
