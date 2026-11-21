-- ============================================================
-- 0055: alergeny_stopy – oddělení stop („může obsahovat") od
--       alergenů v ingrediencích („obsahuje")
-- ------------------------------------------------------------
-- Dosud se OFF allergens_tags i traces_tags syply do jednoho
-- pole foods.alergeny – konzervativní pro varování, ale UI
-- nedokázalo říct, jestli produkt mléko OBSAHUJE, nebo jen
-- „může obsahovat stopy" (typicky čokoláda, müsli).
--
-- Nový sloupec alergeny_stopy = podmnožina alergenů, která
-- pochází pouze z traces_tags. foods.alergeny zůstává UNIONEM
-- (ingredience + stopy) → varovací logika se nemění; UI zobrazí
--   obsahuje:      alergeny - alergeny_stopy
--   může obsahovat stopy: alergeny_stopy
-- ============================================================

alter table public.foods
  add column if not exists alergeny_stopy text[] not null default '{}';

comment on column public.foods.alergeny_stopy is
  'Podmnožina foods.alergeny z OFF traces_tags – „může obsahovat stopy", ne ingredience.';

-- View: přidán sloupec alergeny_stopy (zbytek identický s 0052).
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
   and nej.puv_ok) as sleva,
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
  case when nej.puv_ok then nej.puvodni_cena end as puvodni_cena,
  case
    when nej.je_sleva and nej.puv_ok
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta,
  case when nej.puv_ok then nej.puvodni_zdroj end as puvodni_zdroj,
  f.alergeny_stopy
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g,
         po.puvodni_zdroj,
         (po.puvodni_cena is not null
          and po.puvodni_cena > 1.01 * po.cena
          and po.puvodni_cena <= 2.5 * po.cena
          and (f.bezna_cena is null or f.bezna_cena <= 0
               or po.puvodni_cena <= 2 * f.bezna_cena)) as puv_ok
  from public.price_observations po
  where po.food_id = f.id
    and not po.podezrele
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;
