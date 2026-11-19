"""Scrapery jednotlivých českých řetězců (všechny přes Kupi.cz)."""

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

__all__ = [
    "AlbertScraper", "BillaScraper", "CbaScraper", "CoopScraper",
    "DmScraper", "FlopTopScraper", "GlobusScraper", "HruskaScraper",
    "KauflandScraper", "KosikScraper", "LidlScraper", "PennyScraper",
    "RossmannScraper", "SCRAPERY", "TescoScraper", "TetaScraper",
    "ZemanScraper",
]
