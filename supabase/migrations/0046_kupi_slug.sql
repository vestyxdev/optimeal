-- ============================================================
-- 0046: price_observations.kupi_slug – slug produktu na kupi.cz
-- ------------------------------------------------------------
-- Letákové nabídky bez uváděné % slevy nemají puvodni_cena, ale
-- kupi.cz drží na detailu /sleva/<slug> „běžně stojí X Kč" (jejich
-- průměrnou běžnou cenu za stejné balení). obohaceni_puvodni.py
-- podle slugu dohledá stránku a doplní skutečnou přeškrtnutou cenu
-- → badge „−X %" a přeškrtnutá cena fungují i pro tyto nabídky.
-- ============================================================

alter table public.price_observations
  add column if not exists kupi_slug text;

comment on column public.price_observations.kupi_slug is
  'slug produktu na kupi.cz (/sleva/<slug>) – pro dohledání běžné ceny';

create index if not exists price_observations_kupi_slug_idx
  on public.price_observations (kupi_slug)
  where kupi_slug is not null;
