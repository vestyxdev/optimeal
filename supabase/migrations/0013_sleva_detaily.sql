-- ============================================================
-- 0013: detaily slev – původní (přeškrtnutá) cena + % slevy
-- ------------------------------------------------------------
-- price_observations.puvodni_cena: původní cena za 100 g, jak ji
-- uvádí leták/e-shop (může se lišit od foods.bezna_cena).
-- View aktualni_ceny navíc počítá sleva_procenta pro badge „-30 %":
--   původní = puvodni_cena ∥ bezna_cena, sleva = aktivní →
--   round((1 - aktualni/puvodni) * 100)
-- ============================================================

alter table public.price_observations
  add column if not exists puvodni_cena numeric;

comment on column public.price_observations.puvodni_cena is
  'původní (přeškrtnutá) cena za 100 g z letáku – pro výpočet % slevy';

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
  f.baleni_g,
  coalesce(nej.puvodni_cena, f.bezna_cena) as puvodni_cena,
  case
    when nej.je_sleva
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
         and coalesce(nej.puvodni_cena, f.bezna_cena) > 0
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(coalesce(nej.puvodni_cena, f.bezna_cena), 0)) * 100
    )
    else null
  end as sleva_procenta
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at
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
