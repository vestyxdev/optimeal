-- ============================================================
-- 0006: ALERGÉNY A DIETY pro potraviny + generátor
-- foods.alergeny  : alergeny dle EU (názvy v češtině, kanonické klíče)
-- foods.diety     : vhodnost pro diety (vegetariansky/vegansky/bezlepkovy)
-- Naplní se reálnými daty pro seed potraviny a aktualizuje view.
-- ============================================================

alter table public.foods
  add column if not exists alergeny text[] not null default '{}',
  add column if not exists diety text[] not null default '{}';

comment on column public.foods.alergeny is
  'Alergeny (EU 14): lepek, korisi, vejce, ryby, arasidy, soja, mleko, skorocel, horcice, sezam, sulfit, lupina, vodnany, orisky.';
comment on column public.foods.diety is
  'Vhodné pro diety: vegetariansky, vegansky, bezlepkovy.';

-- Reálná data pro katalog se naplňují na KONCI supabase/seed.sql
-- (migrace běží před seedem – UPDATE zde by zasáhl prázdnou tabulku).

-- --- view aktualni_ceny: doplň alergeny/diety -----------------
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
  (nej.je_sleva and (nej.platnost_do is null or nej.platnost_do >= current_date)) as sleva,
  nej.platnost_do,
  nej.zdroj as zdroj_ceny,
  nej.pozorovano_at,
  f.vytvoril,
  f.zdroj as zdroj_potraviny,
  f.alergeny,
  f.diety
from public.foods f
left join lateral (
  select po.cena, po.retailer_id, po.je_sleva, po.platnost_do, po.zdroj, po.pozorovano_at
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
