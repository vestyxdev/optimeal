-- Migrace 0031: vyčistění peckoviny_obily – rostlinná mléka, energy bary,
--   perníky/cookies/křupavé pečivo a tuňákové vločky tam nepatří.
--   Müsli, kaše, rýžové chlebíčky a kuskus s luštěninami zůstávají.

begin;

-- energy/protein/müsli tyčinky, čokolády a sendviče -> ostatni
update foods set kategorie = 'ostatni'
where kategorie = 'peckoviny_obily' and nazev in (
  'BA! Energy bar',
  'Big white chocolate',
  'Crispy Energy Bar Caramel Seasalt',
  'Crispy Energy Bar Raspberry',
  'Dark Chocolate & Sea Salt',
  'Energy bar - Raisin & walnut',
  'Müsli s meruňkami v jogurtové polevě',
  'Müsli tyčinka banán v kakaové polevě',
  'Müsli Tyčinka Jablko',
  'Müsli tyčinka jablko (Kitbis)',
  'Müsli tyčinka s ovocnými kousky s Višňovou příchutí v jogurtové polevě',
  'Toast s kuřecím masem',
  'Toast tavený sýr',
  'Kuskus s uzeným tofu a zeleninou'
);

-- křupavé pečivo a cukroví -> suchary_testoviny
update foods set kategorie = 'suchary_testoviny'
where kategorie = 'peckoviny_obily' and nazev in (
  '7Days Croissant Chocolate drops Max',
  'Coeurs pain d''épices chocolat noir',
  'Corny Big Dark Chocolate Cookies',
  'Gingerbread dark chocolate covered',
  'Gingerbread With Fruit Filling Dark Chocolate Covered',
  'Oat cookies milk chocolate'
);

-- rostlinná mléka a smetany -> mlecne_vyrobky
update foods set kategorie = 'mlecne_vyrobky'
where kategorie = 'peckoviny_obily' and nazev in (
  'Sójové mléko (Rohlík)',
  'Špaldová alternativa smetany',
  'Špaldové mléko'
);

-- tuňákové vločky ve vlastní šťávě jsou ryba, ne cereálie
update foods set kategorie = 'maso_ryby'
where kategorie = 'peckoviny_obily' and nazev = 'Tuňákové vločky ve vlastní šťávě (tuna)';

commit;
