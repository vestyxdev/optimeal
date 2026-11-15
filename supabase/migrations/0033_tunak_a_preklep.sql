-- Migrace 0033: tuňákové konzervy z ostatni do maso_ryby (kde ryby patří),
--   jedlý cvrček je bílkovinná potravina. Jablečné kačenky jsou sušenky.
--   Pomazánky (včetně rybích) zůstávají v ostatni – konvence katalogu.
--   Překlep: "Tuňákový pomazanka rybex" -> "Tuňáková pomazánka Rybex".

begin;

update foods set kategorie = 'maso_ryby'
where kategorie = 'ostatni' and nazev in (
  'Tuňák kousky ve slunečnicovém oleji',
  'Tuňák steak v pikantním oleji',
  'Tuňák steak ve slunečnicovém oleji',
  'Tuňák v panenském olivovém oleji (tuna)',
  'Tuňák v pikantním oleji (tuna)',
  'Tuňák v Rostlinném Oleji a Slaném Nálevu',
  'Tuňák v rostlinném oleji a slaném nálevu (Giana)',
  'Tuňák ve slunečnicovém oleji',
  'Tuňákové steaky v rostlinném oleji (tuna)',
  'Tuňákový filet v olivovém oleji (tuna)',
  'Tuňákový steak uzený v slunečnicovém oleji (tuna)',
  'Tuňákový steak v slunečnicovém oleji (tuna)',
  'Jedlí cvrčci - slanina a hořčice'
);

update foods set kategorie = 'suchary_testoviny'
where kategorie = 'ostatni' and nazev = 'Jablečné kačenky se špaldovou moukou';

update foods set nazev = 'Tuňáková pomazánka Rybex'
where nazev = 'Tuňákový pomazanka rybex';

commit;
