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
insert into public.foods (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj, baleni_g, baleni_label) values
  ('Arašidy',              'ostatni',            26.0,  9.0, 49.0, 567.0,  8.00, 'seed-v1', 200, 'Sáček'),
  ('Banán',                'ovoce_zelenina',      1.1, 23.0,  0.3,  97.0,  3.00, 'seed-v1', 125, 'Kus'),
  ('Brambory',             'ovoce_zelenina',      2.0, 17.0,  0.1,  77.0,  2.00, 'seed-v1', 2000, 'Sáček'),
  ('Chléb celozrnný',      'peckoviny_obily',     9.0, 46.0,  3.5, 253.0,  4.50, 'seed-v1', 800, 'Balení'),
  ('Hovězí svíčková',      'maso_ryby',          27.0,  0.0, 11.0, 209.0, 28.00, 'seed-v1', 500, 'Balení'),
  ('Jablko',               'ovoce_zelenina',      0.3, 14.0,  0.2,  58.0,  3.50, 'seed-v1', 180, 'Kus'),
  ('Jogurt bílý 3,5%',     'mlecne_vyrobky',      4.0,  5.0,  3.5,  70.0,  1.50, 'seed-v1', 150, 'Kelímek'),
  ('Krabí tyčky',          'maso_ryby',          10.0,  3.0,  1.0,  60.0,  3.00, 'seed-v1', 240, 'Balení'),
  ('Kuřecí prsa',          'maso_ryby',          31.0,  0.0,  3.5, 165.0, 12.00, 'seed-v1', 500, 'Balení'),
  ('Losos',                'maso_ryby',          20.0,  0.0, 13.0, 208.0, 32.00, 'seed-v1', 300, 'Balení'),
  ('Mléko čerstvé',        'mlecne_vyrobky',      3.3,  4.8,  3.6,  64.0,  2.50, 'seed-v1', 1000, 'Krabice'),
  ('Ovesné vločky',        'peckoviny_obily',    13.5, 60.0,  7.0, 380.0,  4.50, 'seed-v1', 500, 'Sáček'),
  ('Parmigiano Reggiano',  'mlecne_vyrobky',     32.0,  0.0, 30.0, 402.0, 12.50, 'openfoodfacts', 150, 'Balení'),
  ('Pohanka',              'peckoviny_obily',    13.0, 62.0,  3.4, 343.0,  6.50, 'seed-v1', 500, 'Sáček'),
  ('Quinoa',               'peckoviny_obily',    14.0, 57.0,  6.0, 368.0, 22.00, 'openfoodfacts', 500, 'Sáček'),
  ('Rýže basmati',         'suchary_testoviny',   7.0, 78.0,  1.0, 350.0,  4.00, 'seed-v1', 500, 'Sáček'),
  ('Sýr Eidam',            'mlecne_vyrobky',     25.0,  1.0, 30.0, 380.0,  9.00, 'seed-v1', 150, 'Balení'),
  ('Sýr Niva',             'mlecne_vyrobky',     21.0,  0.5, 32.0, 371.0, 18.00, 'seed-v1', 125, 'Balení'),
  ('Tvaroh polotučný',     'mlecne_vyrobky',     12.0,  4.0,  1.5,  85.0,  6.00, 'seed-v1', 250, 'Balení'),
  ('Těstoviny celozrnné',  'suchary_testoviny',  13.0, 65.0,  2.5, 335.0,  5.50, 'seed-v1', 500, 'Sáček'),
  ('Vejce',                'ostatni',            13.0,  0.7, 11.0, 155.0,  8.00, 'seed-v1', 60, 'Kus'),
  ('Čočka červená',        'suchary_testoviny',  25.0, 52.0,  1.0, 320.0,  5.50, 'seed-v1', 500, 'Sáček')
on conflict (nazev) do nothing;

-- POZN.: seed dřív vkládal i vymyšlená price_observations ("běžné"
-- ceny = bezna_cena u Billa/Lidlu + 8 fake slev). Od migrace 0047
-- se žádné seedové ceny nevkládají – zobrazují se jen reálně
-- nascrapovaná pozorování (scraper:* / asortiment:* / eshop:*).

-- --- alergeny/diety pro seed potraviny (musí běžet AŽ po insertu potravin) ---
update public.foods set alergeny = array['arasidy'], diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev = 'Arašidy';
update public.foods set alergeny = '{}', diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Banán','Brambory','Jablko');
update public.foods set alergeny = array['lepek'], diety = array['vegetariansky']
  where nazev = 'Chléb celozrnný';  -- pekárny často hlásí i sezam – konzervativně lepek
update public.foods set alergeny = '{}', diety = '{}'
  where nazev in ('Hovězí svíčková','Kuřecí prsa');
update public.foods set alergeny = array['mleko'], diety = array['vegetariansky','bezlepkovy']
  where nazev in ('Jogurt bílý 3,5%','Mléko čerstvé','Parmigiano Reggiano','Sýr Eidam','Sýr Niva','Tvaroh polotučný');
update public.foods set alergeny = array['ryby','lepek','vejce'], diety = '{}'
  where nazev = 'Krabí tyčky';  -- surimi: ryba + často lepek a vaječný bílek
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

-- ============================================================
-- seed-v2: rozšíření katalogu (dalších ~80 českých základů)
-- ============================================================

insert into public.foods (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj, baleni_g, baleni_label) values
  ('Avokádo',              'ovoce_zelenina',      2.0,  9.0, 15.0, 160.0, 25.00, 'seed-v2', 200, 'Kus'),
  ('Balkánský sýr',        'mlecne_vyrobky',     17.0,  1.0, 21.0, 260.0,  8.00, 'seed-v2', 150, 'Balení'),
  ('Borůvky',              'ovoce_zelenina',      0.7, 14.0,  0.3,  60.0, 35.00, 'seed-v2', 125, 'Balení'),
  ('Brokolice',            'ovoce_zelenina',      2.8,  7.0,  0.4,  35.0,  4.00, 'seed-v2', 500, 'Balení'),
  ('Bulgur',               'suchary_testoviny',  12.0, 76.0,  1.3, 340.0,  4.00, 'seed-v2', 500, 'Sáček'),
  ('Cibule',               'ovoce_zelenina',      1.1,  9.0,  0.1,  42.0,  1.50, 'seed-v2', 100, 'Kus'),
  ('Cizrna konzerva',      'suchary_testoviny',   9.0, 27.0,  2.6, 160.0,  3.50, 'seed-v2', 400, 'Plechovka'),
  ('Citrón',               'ovoce_zelenina',      1.1,  9.0,  0.3,  35.0,  5.00, 'seed-v2', 80, 'Kus'),
  ('Cornflakes',           'suchary_testoviny',   7.0, 84.0,  0.9, 380.0,  5.00, 'seed-v2', 375, 'Krabice'),
  ('Cottage cheese',       'mlecne_vyrobky',     12.0,  3.0,  4.0,  95.0,  8.00, 'seed-v2', 180, 'Kelímek'),
  ('Cuketa',               'ovoce_zelenina',      1.2,  3.0,  0.3,  17.0,  3.00, 'seed-v2', 300, 'Kus'),
  ('Cukr krystal',         'ostatni',             0.0,100.0,  0.0, 400.0,  1.50, 'seed-v2', 1000, 'Sáček'),
  ('Česnek',               'ovoce_zelenina',      6.3, 33.0,  0.5, 149.0,  8.00, 'seed-v2', 50, 'Balení'),
  ('Fazole červené konz.', 'suchary_testoviny',   9.0, 21.0,  0.5, 120.0,  3.50, 'seed-v2', 400, 'Plechovka'),
  ('Hermelín',             'mlecne_vyrobky',     20.0,  1.0, 24.0, 280.0,  9.00, 'seed-v2', 100, 'Balení'),
  ('Hořká čokoláda 70 %',  'ostatni',            10.0, 34.0, 42.0, 550.0, 15.00, 'seed-v2', 100, 'Balení'),
  ('Houska',               'peckoviny_obily',     8.0, 52.0,  1.5, 255.0,  0.80, 'seed-v2', 45, 'Kus'),
  ('Hrách suchý',          'suchary_testoviny',  23.0, 60.0,  1.0, 345.0,  3.50, 'seed-v2', 500, 'Sáček'),
  ('Hrášek mražený',       'ovoce_zelenina',      5.4, 14.0,  0.4,  81.0,  5.00, 'seed-v2', 400, 'Sáček'),
  ('Hrozny',               'ovoce_zelenina',      0.7, 18.0,  0.2,  75.0,  6.00, 'seed-v2', 500, 'Balení'),
  ('Hruška',               'ovoce_zelenina',      0.4, 15.0,  0.1,  60.0,  4.00, 'seed-v2', 170, 'Kus'),
  ('Chia semínka',         'ostatni',            17.0, 42.0, 31.0, 486.0, 18.00, 'seed-v2', 200, 'Sáček'),
  ('Jogurt ovocný',        'mlecne_vyrobky',      3.5, 14.0,  2.0,  90.0,  2.50, 'seed-v2', 150, 'Kelímek'),
  ('Kefir',                'mlecne_vyrobky',      3.3,  4.0,  3.0,  55.0,  3.00, 'seed-v2', 500, 'Láhev'),
  ('Kiwi',                 'ovoce_zelenina',      1.1, 15.0,  0.5,  60.0,  7.00, 'seed-v2', 75, 'Kus'),
  ('Krevety',              'maso_ryby',          24.0,  0.3,  0.3,  99.0, 35.00, 'seed-v2', 300, 'Sáček'),
  ('Krůtí mleté',          'maso_ryby',          20.0,  0.0,  7.0, 150.0, 11.00, 'seed-v2', 500, 'Balení'),
  ('Krůtí prsa',           'maso_ryby',          24.0,  0.0,  1.5, 110.0, 14.00, 'seed-v2', 500, 'Balení'),
  ('Kukuřice konzerva',    'ovoce_zelenina',      3.4, 19.0,  1.2,  95.0,  4.00, 'seed-v2', 300, 'Plechovka'),
  ('Kuskus',               'suchary_testoviny',  13.0, 72.0,  0.6, 350.0,  4.00, 'seed-v2', 500, 'Sáček'),
  ('Kuřecí stehna b. kůže','maso_ryby',          17.0,  0.0,  7.0, 150.0,  7.50, 'seed-v2', 500, 'Balení'),
  ('Květák',               'ovoce_zelenina',      1.9,  5.0,  0.3,  25.0,  3.50, 'seed-v2', 800, 'Kus'),
  ('Ledový salát',         'ovoce_zelenina',      0.9,  2.9,  0.1,  14.0,  2.50, 'seed-v2', 200, 'Kus'),
  ('Makrela',              'maso_ryby',          19.0,  0.0, 14.0, 200.0,  8.00, 'seed-v2', 200, 'Kus'),
  ('Maliny',               'ovoce_zelenina',      1.5, 12.0,  0.7,  55.0, 40.00, 'seed-v2', 125, 'Balení'),
  ('Mandle',               'ostatni',            21.0, 22.0, 49.0, 579.0, 28.00, 'seed-v2', 200, 'Sáček'),
  ('Mandlové mléko',       'ostatni',             0.5,  3.0,  1.1,  22.0,  7.00, 'seed-v2', 1000, 'Krabice'),
  ('Máslo',                'mlecne_vyrobky',      0.5,  0.7, 82.0, 740.0, 21.00, 'seed-v2', 250, 'Balení'),
  ('Med',                  'ostatni',             0.3, 82.0,  0.0, 305.0,  8.00, 'seed-v2', 500, 'Kelímek'),
  ('Mleté hovězí',         'maso_ryby',          20.0,  0.0, 15.0, 215.0, 14.00, 'seed-v2', 500, 'Balení'),
  ('Mouka hladká',         'peckoviny_obily',    10.0, 75.0,  1.0, 355.0,  1.50, 'seed-v2', 1000, 'Sáček'),
  ('Mouka špaldová',       'peckoviny_obily',    15.0, 60.0,  2.0, 350.0,  4.00, 'seed-v2', 500, 'Sáček'),
  ('Mozzarella',           'mlecne_vyrobky',     18.0,  1.0, 18.0, 250.0, 10.00, 'seed-v2', 125, 'Balení'),
  ('Mrkev',                'ovoce_zelenina',      0.9, 10.0,  0.2,  41.0,  1.50, 'seed-v2', 100, 'Kus'),
  ('Müsli',                'suchary_testoviny',  10.0, 58.0,  8.0, 400.0,  7.00, 'seed-v2', 600, 'Krabice'),
  ('Okurka salátová',      'ovoce_zelenina',      0.7,  3.6,  0.1,  15.0,  3.00, 'seed-v2', 350, 'Kus'),
  ('Olivový olej',         'ostatni',             0.0,  0.0,100.0, 884.0, 10.00, 'seed-v2', 500, 'Láhev'),
  ('Paprika červená',      'ovoce_zelenina',      1.0,  6.0,  0.3,  30.0,  5.00, 'seed-v2', 200, 'Kus'),
  ('Piškoty dětské',       'suchary_testoviny',   8.0, 80.0,  2.0, 370.0,  4.50, 'seed-v2', 120, 'Balení'),
  ('Pistácie',             'ostatni',            20.0, 28.0, 45.0, 560.0, 35.00, 'seed-v2', 150, 'Sáček'),
  ('Pomeranč',             'ovoce_zelenina',      1.0, 12.0,  0.2,  52.0,  3.50, 'seed-v2', 150, 'Kus'),
  ('Proteinový prášek',    'ostatni',            78.0,  6.0,  4.0, 380.0, 45.00, 'seed-v2', 500, 'Balení'),
  ('Pstruh duhový',        'maso_ryby',          19.0,  0.0,  5.0, 120.0, 18.00, 'seed-v2', 300, 'Kus'),
  ('Rajče',                'ovoce_zelenina',      0.9,  4.0,  0.2,  20.0,  4.00, 'seed-v2', 120, 'Kus'),
  ('Rohlík',               'peckoviny_obily',     9.0, 57.0,  1.5, 280.0,  1.00, 'seed-v2', 43, 'Kus'),
  ('Rýže dlouhozrnná',     'suchary_testoviny',   7.0, 79.0,  0.7, 355.0,  3.50, 'seed-v2', 500, 'Sáček'),
  ('Rýže natural',         'suchary_testoviny',   8.0, 77.0,  3.0, 365.0,  5.00, 'seed-v2', 500, 'Sáček'),
  ('Rýžové chlebíčky',     'suchary_testoviny',   8.0, 80.0,  3.0, 385.0,  6.00, 'seed-v2', 130, 'Balení'),
  ('Sardinky v oleji',     'maso_ryby',          25.0,  0.0, 11.0, 208.0, 12.00, 'seed-v2', 110, 'Plechovka'),
  ('Skyr přírodní',        'mlecne_vyrobky',     11.0,  4.0,  0.2,  63.0,  9.00, 'seed-v2', 400, 'Kelímek'),
  ('Slunečnicová semínka', 'ostatni',            21.0, 20.0, 51.0, 585.0,  7.00, 'seed-v2', 200, 'Sáček'),
  ('Slunečnicový olej',    'ostatni',             0.0,  0.0,100.0, 884.0,  4.00, 'seed-v2', 1000, 'Láhev'),
  ('Smetana ke šlehání',   'mlecne_vyrobky',      2.5,  3.0, 31.0, 300.0,  5.00, 'seed-v2', 250, 'Krabice'),
  ('Smetana kysaná',       'mlecne_vyrobky',      2.5,  4.0, 18.0, 180.0,  4.00, 'seed-v2', 250, 'Krabice'),
  ('Sojové mléko',         'ostatni',             3.3,  5.0,  1.6,  47.0,  4.00, 'seed-v2', 1000, 'Krabice'),
  ('Suchary',              'suchary_testoviny',  11.0, 70.0,  5.0, 390.0,  5.00, 'seed-v2', 200, 'Balení'),
  ('Sýr Čedar',            'mlecne_vyrobky',     25.0,  1.0, 33.0, 400.0, 11.00, 'seed-v2', 200, 'Balení'),
  ('Špagety',              'suchary_testoviny',  12.0, 72.0,  1.5, 355.0,  2.50, 'seed-v2', 500, 'Sáček'),
  ('Špenát baby',          'ovoce_zelenina',      2.9,  3.6,  0.4,  23.0, 15.00, 'seed-v2', 200, 'Sáček'),
  ('Tofu přírodní',        'ostatni',            15.0,  2.0,  8.0, 140.0,  9.00, 'seed-v2', 200, 'Balení'),
  ('Tortilla pšeničná',    'peckoviny_obily',     8.0, 50.0,  6.0, 300.0,  6.00, 'seed-v2', 240, 'Balení'),
  ('Treska filet',         'maso_ryby',          18.0,  0.0,  0.5,  78.0, 25.00, 'seed-v2', 400, 'Balení'),
  ('Tuňák konzerva',       'maso_ryby',          24.0,  0.0,  0.5, 100.0, 18.00, 'seed-v2', 160, 'Plechovka'),
  ('Vepřová játra',        'maso_ryby',          21.0,  2.5,  3.5, 125.0,  4.00, 'seed-v2', 500, 'Balení'),
  ('Vepřová krkovice',     'maso_ryby',          20.0,  0.0, 13.0, 200.0,  9.00, 'seed-v2', 500, 'Balení'),
  ('Vepřová kýta',         'maso_ryby',          21.0,  0.0,  4.0, 130.0,  8.00, 'seed-v2', 500, 'Balení'),
  ('Vlašské ořechy',       'ostatni',            15.0,  7.0, 65.0, 654.0, 30.00, 'seed-v2', 200, 'Sáček'),
  ('Zázvor',               'ovoce_zelenina',      1.8, 18.0,  0.8,  80.0, 12.00, 'seed-v2', 100, 'Balení'),
  ('Žampiony',             'ovoce_zelenina',      3.0,  3.0,  0.3,  25.0,  5.00, 'seed-v2', 250, 'Balení'),
  ('Žitný chléb',          'peckoviny_obily',     7.0, 45.0,  2.0, 230.0,  4.00, 'seed-v2', 800, 'Balení'),
  ('Řecký jogurt',         'mlecne_vyrobky',     10.0,  3.6,  5.0, 100.0, 10.00, 'seed-v2', 400, 'Kelímek')
on conflict (nazev) do nothing;

-- (seed-v2 ceny – viz poznámka výše, nevkládají se)

-- --- alergeny/diety pro seed-v2 ---
update public.foods set alergeny = array['mleko'], diety = array['vegetariansky','bezlepkovy']
  where nazev in ('Balkánský sýr','Cottage cheese','Hermelín','Jogurt ovocný','Kefir','Máslo','Mozzarella','Skyr přírodní','Smetana ke šlehání','Smetana kysaná','Sýr Čedar','Řecký jogurt','Proteinový prášek');
update public.foods set alergeny = array['ryby'], diety = '{}'
  where nazev in ('Makrela','Pstruh duhový','Sardinky v oleji','Treska filet','Tuňák konzerva');
update public.foods set alergeny = array['korisi'], diety = '{}'
  where nazev = 'Krevety';
update public.foods set alergeny = '{}', diety = '{}'
  where nazev in ('Krůtí mleté','Krůtí prsa','Kuřecí stehna b. kůže','Mleté hovězí','Vepřová játra','Vepřová krkovice','Vepřová kýta');
update public.foods set alergeny = '{}', diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Avokádo','Borůvky','Brokolice','Cibule','Citrón','Cuketa','Česnek','Hrášek mražený','Hrozny','Hruška','Kiwi','Kukuřice konzerva','Květák','Ledový salát','Maliny','Mrkev','Okurka salátová','Paprika červená','Pomeranč','Rajče','Špenát baby','Zázvor','Žampiony');
update public.foods set alergeny = '{}', diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Chia semínka','Cukr krystal','Olivový olej','Slunečnicová semínka','Slunečnicový olej','Rýže dlouhozrnná','Rýže natural','Rýžové chlebíčky','Bulgur','Hrách suchý','Fazole červené konz.','Cizrna konzerva');
update public.foods set alergeny = array['lepek'], diety = array['vegetariansky']
  where nazev in ('Houska','Rohlík','Kuskus','Mouka hladká','Mouka špaldová','Piškoty dětské','Suchary','Špagety','Tortilla pšeničná','Žitný chléb','Cornflakes');
update public.foods set alergeny = array['lepek','orisky'], diety = array['vegetariansky','vegansky']
  where nazev = 'Müsli';
update public.foods set alergeny = array['orisky'], diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Mandle','Mandlové mléko','Pistácie','Vlašské ořechy');
update public.foods set alergeny = array['soja'], diety = array['vegetariansky','vegansky','bezlepkovy']
  where nazev in ('Tofu přírodní','Sojové mléko');
update public.foods set alergeny = '{}', diety = array['vegetariansky','bezlepkovy']
  where nazev = 'Med';
update public.foods set alergeny = array['mleko'], diety = array['vegetariansky','bezlepkovy']
  where nazev = 'Hořká čokoláda 70 %';  -- stopy mléka z výroby, není veganská
