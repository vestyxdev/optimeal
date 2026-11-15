-- ============================================================
-- 0015: druhá vlna základních potravin (z harvestu letákových
-- názvů po zavedení stem-párování) – ryby, drobné maso, káva,
-- víno/pivo jako generické položky.
-- Generický název zachytí jen nabídky, které nesedí na konkrétní
-- značku – matcher preferuje delší (konkrétnější) název potraviny.
-- ============================================================

insert into public.foods
  (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj, schvaleno)
values
  ('Kuřecí játra',          'maso_ryby',     16.9,  0.7, 4.8, 119,  9.00, 'seed-zaklady', true),
  ('Kuřecí hřbety',         'maso_ryby',     15.0,  0.0,15.0, 200,  5.00, 'seed-zaklady', true),
  ('Tilápie filety',        'maso_ryby',     20.0,  0.0, 1.7,  96, 25.00, 'seed-zaklady', true),
  ('Candát filety',         'maso_ryby',     19.0,  0.0, 1.0,  84, 45.00, 'seed-zaklady', true),
  ('Grepy',                 'ovoce_zelenina', 0.8, 10.7, 0.1,  42,  8.00, 'seed-zaklady', true),
  ('Pomelo',                'ovoce_zelenina', 0.8,  9.6, 0.0,  38, 10.00, 'seed-zaklady', true),
  ('Křen čerstvý',          'ovoce_zelenina', 1.2, 11.3, 0.7,  48, 15.00, 'seed-zaklady', true),
  ('Hovězí kýta',           'maso_ryby',     20.0,  0.0, 8.0, 160, 30.00, 'seed-zaklady', true),
  ('Kotleta vepřová',       'maso_ryby',     19.0,  0.0,15.0, 220, 18.00, 'seed-zaklady', true),
  ('Káva mletá',            'ostatni',       12.0, 55.0, 0.5, 300, 35.00, 'seed-zaklady', true),
  ('Káva instantní',        'ostatni',       12.0, 70.0, 0.5, 350, 60.00, 'seed-zaklady', true),
  ('Káva zrnková',          'ostatni',       12.0, 55.0, 0.5, 300, 45.00, 'seed-zaklady', true),
  ('Kávové kapsle',         'ostatni',       12.0, 70.0, 0.5, 350, 80.00, 'seed-zaklady', true),
  ('Víno bílé',             'ostatni',        0.1,  2.6, 0.0,  82, 15.00, 'seed-zaklady', true),
  ('Víno červené',          'ostatni',        0.1,  2.6, 0.0,  85, 15.00, 'seed-zaklady', true),
  ('Sekt',                  'ostatni',        0.2,  9.0, 0.0,  82, 15.00, 'seed-zaklady', true),
  ('Pivo',                  'ostatni',        0.5,  3.6, 0.0,  43,  2.00, 'seed-zaklady', true)
on conflict (nazev) do nothing;
