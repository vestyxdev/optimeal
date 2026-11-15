-- Migrace 0034: mléčné výrobky schované v ostatni -> mlecne_vyrobky.
--   Jogurtové nápoje a pomazánky zůstávají v ostatni (konvence nápojů/pomazánek).
--   Edamame jsou sójové boby, ne eidam – zůstávají.
--   Christmas pudding je vánoční cake -> suchary_testoviny.

begin;

update foods set kategorie = 'mlecne_vyrobky'
where kategorie = 'ostatni' and nazev in (
  'Activia Probiotický jogurt bílý slazený',
  'Camembert s brusinkovou omáčkou',
  'Florian smetanový jogurt káva arabica',
  'HighProtein Jogurt - Javorový sirup (lidl)',
  'Nakládaný hermelín s cukrem a sladidlem',
  'Ovesný jogurt s příchutí kávy',
  'Skyr vanilka cukru',
  'High Protein Pudding',
  'High protein pudding Chocolate',
  'PROTEIN pudding',
  'Protein pudding (Olma)',
  'Protein pudding vanilla',
  'Pudink s černou lepkavou rýží',
  'Vanilkový puding se šlehačkou Cremore DUO'
);

update foods set kategorie = 'suchary_testoviny'
where kategorie = 'ostatni' and nazev = 'Alcohol free Christmas pudding';

commit;
