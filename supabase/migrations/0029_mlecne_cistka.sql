-- Migrace 0029: vyčistění mlecne_vyrobky – čokoládové tabulky, chipsy,
--   vegan majonéza a máslové fazole tam nepatří.
--   Konvence: čokoláda/sladkosti → ostatni, pečivo/cukroví → suchary_testoviny,
--   ryby → maso_ryby, luštěniny → ovoce_zelenina.
--   Zachováváme: zmrzlinu, mléčné dezerty, rostlinná mléka, sýrové pomazánky,
--   margaríny (ty v mlecne patří).

begin;

-- čokoládové tabulky, tyčinky a snacky -> ostatni (ne mléčné výrobky)
update foods set kategorie = 'ostatni'
where kategorie = 'mlecne_vyrobky' and nazev in (
  'Chocolate (Lindt)',
  'Indulgent Chocolate',
  'Jimmy fantastic milk chocolate',
  'Milk chocolate',
  'Milk chocolate (clever)',
  'Milk chocolate (Katy)',
  'Milk chocolate bars',
  'Milk Chocolate With Peanuts',
  'Milka Crunchy Chocolate',
  'White Chocolate Almond',
  'Chocolat Whole Almonds',
  'Bílá čokoláda s čokoládovým dražé',
  'Baton pufos cu umplutura de ciocolata',
  'KitKat Ball with Milk Chocolate',
  'Mochi Chocolate',
  'Rice up zero sugar coconut milk chocolate brown rice bar',
  'High Protein White Chocolate Quark Bar',
  'Peanut zéro chocolat',
  'Plant protein (chocolate flavour)',
  'Vegan majonéza',
  'Kopr A Maslicko Bramborove Lupinky',
  'Sedmizrnná Badgers se šunkou, sýrem a vajíčkem',
  'Chocolate crisp'
);

-- pečivo/cukroví -> suchary_testoviny
update foods set kategorie = 'suchary_testoviny'
where kategorie = 'mlecne_vyrobky' and nazev in (
  'Doughie Chocolate Chip',
  'Kinder Pingu Prajitura cu lapte si caramel trasa in ciocolata'
);

-- máslové fazole jsou luštěnina, ne mléko -> ovoce_zelenina
update foods set kategorie = 'ovoce_zelenina'
where kategorie = 'mlecne_vyrobky' and nazev = 'PENNY Fazole bílá máslová';

-- rybí salát s jogurtem je rybí produkt -> maso_ryby
update foods set kategorie = 'maso_ryby'
where kategorie = 'mlecne_vyrobky' and nazev = 'Rybí salát s jogurtem';

commit;
