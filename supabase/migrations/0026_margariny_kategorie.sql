-- Migrace 0026: margaríny a rostlinné tuky z kategorie ovoce_zelenina
--   do mlecne_vyrobky (kde podle konvence už jsou Hera Classic, Perla,
--   Ghi, Rostlinné máslo, Margarín). 10 položek, 30–80 g tuku/100 g –
--   rozhodně ne produkt zeleninového oddělení.

begin;

update foods set kategorie = 'mlecne_vyrobky'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Hera',
  'Flora linie',
  'Flora Omega 3&6 GOLD',
  'Margarín (Flora)',
  'Margarín (Rama)',
  'Margarín buttery',
  'Rostlinný roztíratelný tuk',
  'Rostlinný roztíratelný tuk originál',
  'Rostlinný tuk',
  'Sonnenblumen Margarine',
  'Zlatá Haná'
);

commit;
