-- Migrace 0024: oprava fyzikálně nemožné výživy z OFF + 2 špatné kategorie
--   Hodnoty níže jsou lokálně opravené – v OFF je desetinná chyba
--   (např. chléb s 77 g bílkovin = 7,7 g). Součet maker >105 g/100 g
--   nově filtruje i generátor (jeNutrienceSpolehliva) a ingest OFF.

begin;

-- Chléb pšeničnožitný (EAN 8595070600837): b77 → 7,7 (typická hodnota pečiva,
-- konzistentní s kaloriemi 261 / sacharidy 53,3 / tuk 1,0)
update foods set bilkoviny = 7.7
where nazev = 'Chléb pšeničnožitný' and bilkoviny = 77;

-- Chvilka čokoládová (EAN 8595014602217): b77 → 7,7, t36 → 3,6
-- (pudinkový prášek, součet po opravě 90,3 g – fyzikálně validní)
update foods set bilkoviny = 7.7, tuky = 3.6
where nazev = 'Chvilka čokoládová' and bilkoviny = 77 and tuky = 36;

-- Corny Big Choco Banana (EAN 4011800548513): b30 → 5,4 (oficiální hodnota)
update foods set bilkoviny = 5.4
where nazev = 'Corny Big Choco Banana' and bilkoviny = 30;

-- Instantní polévka není maso; brambůrky a müsli tyčinka nejsou produktem
-- ovoce/zeleniny (vtaženy ovocnými příchutěmi v názvu)
update foods set kategorie = 'ostatni'
where nazev in (
  'BISTRO polévka s kuřecí příchutí',
  'Cyrilovy brambůrky povidlové',
  'Corny Big Choco Banana'
);

commit;
