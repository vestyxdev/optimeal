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

-- --- reálná data pro katalog (22 seed potravin) ---------------
update public.foods set alergeny = array['arasidy'], diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev = 'Arašidy';
update public.foods set alergeny = '{}', diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Banán','Brambory','Jablko');
update public.foods set alergeny = array['lepek'], diety = array['vegetariansky']
  where nazev = 'Chléb celozrnný';  -- pekárny často hlásí i sezam – konzervativně lepek
update public.foods set alergeny = '{}', diety = '{}'
  where nazev = 'Hovězí svíčková';
update public.foods set alergeny = array['mleko'], diety = array['vegetariansky','bezlepkovy']
  where nazev in ('Jogurt bílý 3,5%','Mléko čerstvé','Parmigiano Reggiano','Sýr Eidam','Sýr Niva','Tvaroh polotučný');
update public.foods set alergeny = array['ryby','lepek','vejce'], diety = '{}'
  where nazev = 'Krabí tyčky';  -- surimi: ryba + často lepek a vaječný bílek
update public.foods set alergeny = '{}', diety = '{}'
  where nazev = 'Kuřecí prsa';
update public.foods set alergeny = array['ryby'], diety = '{}'
  where nazev = 'Losos';
update public.foods set alergeny = array['lepek'], diety = array['vegetariansky','vegansky']
  where nazev = 'Ovesné vločky';  -- stopy lepku z běžné produkce
update public.foods set alergeny = '{}', diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Pohanka','Quinoa','Rýže basmati','Čočka červená');
update public.foods set alergeny = array['lepek'], diety = array['vegetariansky']
  where nazev = 'Těstoviny celozrnné';
update public.foods set alergeny = array['vejce'], diety = array['vegetariansky']
  where nazev = 'Vejce';

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
