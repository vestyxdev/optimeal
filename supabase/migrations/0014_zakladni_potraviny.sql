-- ============================================================
-- 0014: základní potraviny + oprava chybných OFF importů
-- ------------------------------------------------------------
-- Katalog je příliš „brandový" – letáky nabízejí obecné potraviny
-- (Banány, Citrony, Kuřecí čtvrtky…), které v něm chyběly, takže se
-- nespárovaly. Doplňujeme pečlivě ověřené hodnoty (kaloricketabulky/
-- USDA-standard) za 100 g; bezna_cena = orientační Kč/100 g.
-- Zároveň opravujeme řádky, které dostaly výživu nesouvisejícího
-- produktu přes slabé OFF párování, a přehazujeme slané snacky
-- omylem zařazené do ovoce_zelenina.
-- ============================================================

insert into public.foods
  (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj, schvaleno)
values
  -- ovoce
  ('Banány',                'ovoce_zelenina', 1.1, 22.8, 0.3,  89, 3.50, 'seed-zaklady', true),
  ('Jablka',                'ovoce_zelenina', 0.3, 13.8, 0.2,  52, 4.00, 'seed-zaklady', true),
  ('Citrony',               'ovoce_zelenina', 1.1,  9.3, 0.3,  29, 6.00, 'seed-zaklady', true),
  ('Pomeranče',             'ovoce_zelenina', 0.9, 11.8, 0.1,  47, 4.50, 'seed-zaklady', true),
  ('Mandarinky čerstvé',    'ovoce_zelenina', 0.8, 13.3, 0.3,  53, 5.00, 'seed-zaklady', true),
  ('Limetky',               'ovoce_zelenina', 0.7, 10.5, 0.2,  30, 7.00, 'seed-zaklady', true),
  ('Grapefruit',            'ovoce_zelenina', 0.8, 10.7, 0.1,  42, 8.00, 'seed-zaklady', true),
  ('Hrušky',                'ovoce_zelenina', 0.4, 15.2, 0.1,  57, 5.00, 'seed-zaklady', true),
  ('Meruňky',               'ovoce_zelenina', 1.4, 11.1, 0.4,  48, 8.00, 'seed-zaklady', true),
  ('Broskve',               'ovoce_zelenina', 0.9,  9.5, 0.3,  39, 8.00, 'seed-zaklady', true),
  ('Meloun vodní',          'ovoce_zelenina', 0.6,  7.6, 0.2,  30, 3.00, 'seed-zaklady', true),
  ('Kokos čerstvý',         'ovoce_zelenina', 3.3, 15.2,33.5, 354, 30.00,'seed-zaklady', true),
  -- zelenina
  ('Rajčata',               'ovoce_zelenina', 0.9,  3.9, 0.2,  18, 5.00, 'seed-zaklady', true),
  ('Paprika čerstvá',       'ovoce_zelenina', 1.0,  6.0, 0.3,  26, 6.00, 'seed-zaklady', true),
  ('Okurka hadovka',        'ovoce_zelenina', 0.7,  3.6, 0.1,  15, 4.00, 'seed-zaklady', true),
  ('Petrželová nať',        'ovoce_zelenina', 3.0,  6.3, 0.8,  36, 30.00,'seed-zaklady', true),
  ('Kedlubna',              'ovoce_zelenina', 1.7,  6.2, 0.1,  27, 3.00, 'seed-zaklady', true),
  ('Ředkvičky',             'ovoce_zelenina', 0.7,  3.4, 0.1,  16, 3.50, 'seed-zaklady', true),
  ('Celer',                 'ovoce_zelenina', 0.7,  3.0, 0.2,  16, 4.00, 'seed-zaklady', true),
  ('Zázvor čerstvý',        'ovoce_zelenina', 1.8, 17.8, 0.8,  80, 15.00,'seed-zaklady', true),
  ('Salát hlávkový',        'ovoce_zelenina', 1.4,  2.2, 0.2,  14, 12.00,'seed-zaklady', true),
  ('Zelí bílé',             'ovoce_zelenina', 1.3,  5.8, 0.1,  25, 2.00, 'seed-zaklady', true),
  ('Dýně',                  'ovoce_zelenina', 1.0,  6.5, 0.1,  26, 3.00, 'seed-zaklady', true),
  ('Batáty',                'ovoce_zelenina', 1.6, 20.1, 0.1,  86, 8.00, 'seed-zaklady', true),
  ('Chřest',                'ovoce_zelenina', 2.2,  3.9, 0.1,  20, 30.00,'seed-zaklady', true),
  ('Žampiony čerstvé',      'ovoce_zelenina', 3.1,  3.3, 0.3,  22, 9.00, 'seed-zaklady', true),
  -- maso a ryby
  ('Kuřecí čtvrtky',        'maso_ryby',     18.0,  0.0,15.0, 215, 10.00,'seed-zaklady', true),
  ('Kuřecí stehna',         'maso_ryby',     20.0,  0.0,12.0, 190, 10.00,'seed-zaklady', true),
  ('Kuřecí křídla',         'maso_ryby',     19.0,  0.0,14.0, 203, 9.00, 'seed-zaklady', true),
  ('Krůtí prsa',            'maso_ryby',     24.0,  0.0, 1.7, 105, 25.00,'seed-zaklady', true),
  ('Vepřová panenská svíčková','maso_ryby',  21.0,  0.0, 2.0, 105, 25.00,'seed-zaklady', true),
  ('Vepřová plec',          'maso_ryby',     20.0,  0.0, 5.5, 132, 11.00,'seed-zaklady', true),
  ('Mleté maso vepřové',    'maso_ryby',     17.0,  0.0,21.0, 263, 12.00,'seed-zaklady', true),
  ('Husa',                  'maso_ryby',     25.0,  0.0,22.0, 305, 25.00,'seed-zaklady', true),
  ('Králík',                'maso_ryby',     33.0,  0.0, 3.5, 173, 20.00,'seed-zaklady', true),
  ('Kapr',                  'maso_ryby',     18.0,  0.0, 5.6, 127, 20.00,'seed-zaklady', true),
  -- nápoje a drogerie-adresné položky z letáků
  ('Voda Korunní',          'ostatni',        0.0,  0.0, 0.0,   0, 1.00, 'seed-zaklady', true),
  ('Okurky Znojmia',        'ostatni',        0.5,  6.0, 0.1,  30, 5.00, 'seed-zaklady', true),
  ('Jihlavanka mletá',      'ostatni',        4.0, 65.0, 1.0, 340, 12.00,'seed-zaklady', true),
  ('Jacobs Krönung instantní','ostatni',     12.0, 70.0, 0.5, 350, 60.00,'seed-zaklady', true)
on conflict (nazev) do nothing;

-- Oprava řádků s výživou nesouvisejícího produktu z OFF importu:
-- whisky má ~250 kcal a ~0 sacharidů (řádek měl 70 kcal / S40 – chyba).
update public.foods
  set kalorie = 250, bilkoviny = 0, sacharidy = 0.1, tuky = 0
  where nazev = 'Whiskey Jack Daniel''s';

-- Duplicitní Red Bull s kJ hodnotou v poli kcal (463 místo 46) –
-- dva správné záznamy Red Bull už v katalogu jsou.
delete from public.foods
  where nazev = 'Energetický nápoj Red Bull' and kalorie > 400;

-- Slané snacky omylem v kategorii ovoce_zelenina → ostatni.
update public.foods
  set kategorie = 'ostatni'
  where kategorie = 'ovoce_zelenina'
    and nazev ~* '(chips|tyčink|vroubk|hranolky|snack|slané)';
