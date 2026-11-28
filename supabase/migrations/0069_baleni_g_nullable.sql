-- 0069: baleni_g zpet nullable – „nezname hmotnost" neni 0 g.
-- NOT NULL constraint z lint-backfill migrace zlomil vytvor_potravinu:
-- Rohlík/Košík produkty bez parsovatelné gramáze (n.gramy=None) insert
-- odmítl a scraper tise prekakoval – proto nulova tvorba novych potravin
-- pri strict matcheru (2026-11-28: 6861/12715 produktu preskoceno).

alter table public.foods alter column baleni_g drop not null;

-- baleni_label je druhá past v témže: scraper ho pri zakládání přes
-- eshop vůbec nepředává (typ balení zná až parsování quantity),
-- takže insert umíral na not-null i po zfixování baleni_g.
alter table public.foods alter column baleni_label drop not null;
