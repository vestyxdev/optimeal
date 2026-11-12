-- ============================================================
-- OptiMeal – seed: katalog 22 potravin + výchozí obchody + ceny
-- Data přenesená z produkce v1 (OptiMeal PHP). Ceny jsou
-- REFERENČNÍ hodnoty Kč/100 g s původem 'seed-v1' – přepíše je
-- scraper (ceny z letáků) hned, jakmile poběží.
-- ============================================================

insert into public.retailers (nazev, aktivni, poznamka) values
  ('Billa', true, null),
  ('Kaufland', true, null),
  ('Tesco', true, null),
  ('Albert', true, null),
  ('Lidl', true, null),
  ('Penny', true, null)
on conflict (nazev) do nothing;

-- --- katalog potravin (výživové hodnoty za 100 g) ---
insert into public.foods (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj) values
  ('Arašidy',              'ostatni',            26.0,  9.0, 49.0, 567.0,  8.00, 'seed-v1'),
  ('Banán',                'ovoce_zelenina',      1.1, 23.0,  0.3,  97.0,  3.00, 'seed-v1'),
  ('Brambory',             'ovoce_zelenina',      2.0, 17.0,  0.1,  77.0,  2.00, 'seed-v1'),
  ('Chléb celozrnný',      'peckoviny_obily',     9.0, 46.0,  3.5, 253.0,  4.50, 'seed-v1'),
  ('Hovězí svíčková',      'maso_ryby',          27.0,  0.0, 11.0, 209.0, 28.00, 'seed-v1'),
  ('Jablko',               'ovoce_zelenina',      0.3, 14.0,  0.2,  58.0,  3.50, 'seed-v1'),
  ('Jogurt bílý 3,5%',     'mlecne_vyrobky',      4.0,  5.0,  3.5,  70.0,  1.50, 'seed-v1'),
  ('Krabí tyčky',          'maso_ryby',          10.0,  3.0,  1.0,  60.0,  3.00, 'seed-v1'),
  ('Kuřecí prsa',          'maso_ryby',          31.0,  0.0,  3.5, 165.0, 12.00, 'seed-v1'),
  ('Losos',                'maso_ryby',          20.0,  0.0, 13.0, 208.0, 32.00, 'seed-v1'),
  ('Mléko čerstvé',        'mlecne_vyrobky',      3.3,  4.8,  3.6,  64.0,  2.50, 'seed-v1'),
  ('Ovesné vločky',        'peckoviny_obily',    13.5, 60.0,  7.0, 380.0,  4.50, 'seed-v1'),
  ('Parmigiano Reggiano',  'mlecne_vyrobky',     32.0,  0.0, 30.0, 402.0, 12.50, 'openfoodfacts'),
  ('Pohanka',              'peckoviny_obily',    13.0, 62.0,  3.4, 343.0,  6.50, 'seed-v1'),
  ('Quinoa',               'peckoviny_obily',    14.0, 57.0,  6.0, 368.0, 22.00, 'openfoodfacts'),
  ('Rýže basmati',         'suchary_testoviny',   7.0, 78.0,  1.0, 350.0,  4.00, 'seed-v1'),
  ('Sýr Eidam',            'mlecne_vyrobky',     25.0,  1.0, 30.0, 380.0,  9.00, 'seed-v1'),
  ('Sýr Niva',             'mlecne_vyrobky',     21.0,  0.5, 32.0, 371.0, 18.00, 'seed-v1'),
  ('Tvaroh polotučný',     'mlecne_vyrobky',     12.0,  4.0,  1.5,  85.0,  6.00, 'seed-v1'),
  ('Těstoviny celozrnné',  'suchary_testoviny',  13.0, 65.0,  2.5, 335.0,  5.50, 'seed-v1'),
  ('Vejce',                'ostatni',            13.0,  0.7, 11.0, 155.0,  8.00, 'seed-v1'),
  ('Čočka červená',        'suchary_testoviny',  25.0, 52.0,  1.0, 320.0,  5.50, 'seed-v1')
on conflict (nazev) do nothing;

-- --- běžné ceny jako pozorování (původ seed-v1) ---
with p as (select id, nazev, bezna_cena from public.foods where zdroj = 'seed-v1')
insert into public.price_observations (food_id, retailer_id, cena, je_sleva, zdroj)
select p.id, r.id, p.bezna_cena, false, 'seed-v1'
from p
cross join (select id from public.retailers where nazev = 'Billa') r
where not exists (
  select 1 from public.price_observations po
  where po.food_id = p.id and po.retailer_id = r.id and po.cena = p.bezna_cena
);

-- --- aktuální slevy z produkce v1 (platnost 14 dní, přepíše scraper) ---
do $$
declare
  slevy text[][] := array[
    array['Brambory', 'Billa', '1.49'],
    array['Hovězí svíčková', 'Kaufland', '24.90'],
    array['Kuřecí prsa', 'Billa', '9.49'],
    array['Losos', 'Kaufland', '29.90'],
    array['Mléko čerstvé', 'Billa', '1.99'],
    array['Tvaroh polotučný', 'Tesco', '4.49'],
    array['Těstoviny celozrnné', 'Tesco', '3.90'],
    array['Čočka červená', 'Kaufland', '4.10']
  ];
  s text[];
  v_food uuid;
  v_retail uuid;
begin
  foreach s slice 1 in array slevy loop
    select id into v_food from public.foods where nazev = s[1];
    select id into v_retail from public.retailers where nazev = s[2];
    if v_food is not null and v_retail is not null then
      insert into public.price_observations (food_id, retailer_id, cena, je_sleva, platnost_do, zdroj)
      values (v_food, v_retail, s[3]::numeric, true, current_date + 14, 'seed-v1')
      on conflict do nothing;
    end if;
    v_food := null;
    v_retail := null;
  end loop;
end $$;
