-- ============================================================
-- 0045: oprava falešných slev + reálná balení + reálné běžné ceny
-- ------------------------------------------------------------
-- 1) price_observations.baleni_g – skutečná velikost prodávaného
--    balení z letáku/eshopu (kupi parsuje "1 l"/"200 g" z letáku,
--    dosud se zahazovala). Letáková nabídka "Topic 200 g" se tak
--    nezobrazí přepočtem na 1500g balení z OFF.
-- 2) aktualni_ceny.puvodni_cena / sleva_procenta – pouze z reálně
--    nascrapované přeškrtnuté ceny. Dosavadní fallback na
--    foods.bezna_cena vyráběl falešné slevy (−94 % u mléka za
--    9,90 Kč, protože bezna_cena=16 byl placeholder).
-- 3) foods.bezna_cena – přepočet z mediánu reálných pozorování
--    (poslední cena u každého obchodu, preferujeme neakční).
--    Placeholdery (16.00 ×1090 apod.) se tím nahradí reálnou
--    typickou cenou; potraviny bez pozorování zůstávají.
-- ============================================================

alter table public.price_observations
  add column if not exists baleni_g numeric;

comment on column public.price_observations.baleni_g is
  'velikost prodávaného balení v gramech, jak ji udává leták/eshop';

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
  coalesce(nej.baleni_g, f.baleni_g) as baleni_g,
  nej.puvodni_cena as puvodni_cena,
  case
    when nej.je_sleva
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
         and nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and coalesce(nej.cena, f.bezna_cena) < nej.puvodni_cena
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g
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

-- bezna_cena = typická cena z reálných dat: medián poslední ceny
-- u každého obchodu (neakční preferované; když má potravina jen
-- akční ceny, použijeme jejich medián – pořád reálnější než placeholder)
with posledni as (
  select distinct on (food_id, retailer_id)
    food_id, cena, je_sleva
  from public.price_observations
  where cena > 0
  order by food_id, retailer_id, pozorovano_at desc
),
mediany as (
  select
    food_id,
    percentile_cont(0.5) within group (order by cena)
      filter (where not je_sleva) as med_neakcni,
    percentile_cont(0.5) within group (order by cena) as med_vse
  from posledni
  group by food_id
)
update public.foods f
set bezna_cena = round(coalesce(m.med_neakcni, m.med_vse)::numeric, 2)
from mediany m
where f.id = m.food_id
  and coalesce(m.med_neakcni, m.med_vse) is not null;
