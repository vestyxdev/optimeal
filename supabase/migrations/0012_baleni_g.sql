-- ============================================================
-- 0012: foods.baleni_g – hmotnost/obsah balení
-- ------------------------------------------------------------
-- Ceny držíme normalizované na Kč/100 g, ale zákazník přemýšlí
-- v ceně za balení (TUC 25 Kč, ne 8,30 Kč/100 g). Sloupec
-- baleni_g umožní UI zobrazit „~25 Kč · 400 g“ tam, kde balení
-- známe (OFF quantity / product_quantity, nebo z názvu).
-- U váženého zboží (maso, pečivo z pultu) zůstává NULL → /100 g.
-- ============================================================

alter table public.foods
  add column if not exists baleni_g numeric;

comment on column public.foods.baleni_g is
  'hmotnost/obsah balení v g (u tekutin ml ~ g) – pro výpočet ceny za balení';

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
  f.diety,
  f.ean,
  f.obrazek,
  f.baleni_g
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
