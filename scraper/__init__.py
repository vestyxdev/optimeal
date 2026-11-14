"""OptiMeal scraper – ingest cen do price_observations (hybridní varianta C).

Architektura: strukturovaná API (Open Prices / ČNB) mají přednost, view
`aktualni_ceny` pak ze stejných `price_observations` řeší efektivní cenu –
stejný kontrakt jako seed i budoucí letákové zdroje (`zdroj='letak'`).
"""
