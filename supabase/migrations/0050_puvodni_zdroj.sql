-- ============================================================
-- 0050: provenance ověřených původních cen (puvodni_zdroj)
-- ------------------------------------------------------------
-- Každá ověřená sleva musí vědět, odkud její původní cena pochází:
--   'letak' – leták sám ukazuje % slevy / přeškrtnutou cenu
--   'eshop' – e-shopová was-price (Rohlík/Košík API)
--   'kupi'  – Kupi.cz detail „běžně stojí X Kč" (obohaceni_puvodni)
-- NULL = žádná původní cena, nebo stará data, u kterých nejde
-- zpětně rozlišit leták vs. Kupi detail (sloupce letákových nabídek
-- se sluguje až od 0046) – necháváme poctivě prázdné.
-- ============================================================

alter table public.price_observations
  add column if not exists puvodni_zdroj text
  check (puvodni_zdroj is null or puvodni_zdroj in ('letak', 'eshop', 'kupi'));

-- Backfill – jen tam, kde je zdroj zpětně jednoznačně dokladatelný:
update public.price_observations
   set puvodni_zdroj = 'eshop'
 where puvodni_cena is not null
   and puvodni_zdroj is null
   and zdroj like 'asortiment:%';

update public.price_observations
   set puvodni_zdroj = 'letak'
 where puvodni_cena is not null
   and puvodni_zdroj is null
   and zdroj like 'scraper:%'
   and kupi_slug is null;   -- bez slugu nemohl obohaceni zasáhnout

-- Řádky scraper:* se slugem a puvodni_cena jsou zpětně nejednoznačné
-- (letákové % i pozdější PATCH z Kupi detailu) → puvodni_zdroj NULL.

-- View: vynést provenanci ven pro audit/UI.
create or replace view public.aktualni_ceny as
select
  f.id as food_id,
  f.nazev,
  f.kategorie,
  f.bilkoviny,
  f.sacharidy,
  f.tuky,
  f.kalorie,
  f.bezna_cena,
  coalesce(nej.cena, f.bezna_cena) as aktualni_cena,
  nej.retailer_id,
  r.nazev as obchod,
  (nej.je_sleva
   and (nej.platnost_do is null or nej.platnost_do >= current_date)
   and nej.puvodni_cena is not null
   and nej.puvodni_cena > 0
   and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
   and nej.puvodni_cena >= 1.01 * coalesce(nej.cena, f.bezna_cena)) as sleva,
  nej.platnost_do,
  nej.zdroj as zdroj_ceny,
  nej.pozorovano_at,
  f.vytvoril,
  f.zdroj as zdroj_potraviny,
  f.alergeny,
  f.diety,
  f.ean,
  f.obrazek,
  coalesce(nej.baleni_g, f.baleni_g) as baleni_g,
  case
    when nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
    then nej.puvodni_cena
  end as puvodni_cena,
  case
    when nej.je_sleva
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
         and nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
         and coalesce(nej.cena, f.bezna_cena) < nej.puvodni_cena
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta,
  -- provenance jen u zobrazené (prošlé) původní ceny – nové sloupce
  -- Postgres přidává jen na konec view
  case
    when nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
    then nej.puvodni_zdroj
  end as puvodni_zdroj
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g,
         po.puvodni_zdroj
  from public.price_observations po
  where po.food_id = f.id
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;
