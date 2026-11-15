-- Migrace 0035: konvence luštěnin.
--   Zelené fazolové lusky, hrách a mrkev s fazolkou = zelenina -> zůstávají v ovoce_zelenina.
--   Pečené/konzervované luštěniny, polévky z nich a čočkové chipsy = hotové výrobky -> ostatni
--   (tam už jsou suché luštěniny i ostatní polévky a chipsy).
--   Proteinové plátky z hrášku a fazolí = náhražka masa -> maso_ryby (jako seitan/tofu).
--   Překlepy: Fazole cervena -> červená, Vapeur Cervené -> červené,
--   "cirznou ve. slaném nálevu" -> "cizrnou ve slaném nálevu".

begin;

update foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Beanz fazole v rajčatové omáčce',
  'Bio bílé fazole v rajčatové omáčce',
  'Fazole v rajčatové omáčce',
  'Pečené fazole v rajčatové omáčce',
  'Pečené fazole v rajčatové omáčce s chili',
  'PENNY Fazole bílá máslová',
  'Čočková polévka',
  'Čočková polévka (activus ORGANIC)',
  'Čočková polévka (Albert Bistro)',
  'Farmářská polévka čočková',
  'Farmářská polévka s červenou čočkou',
  'Indická polévka z červené čočky',
  'Čočkové Chipsy Paprika',
  'Vapeur Cervené fazole 425 ml',
  'Vapeur čočka 425 ml'
);

update foods set kategorie = 'maso_ryby'
where kategorie = 'ostatni' and nazev = 'Proteinové plátky z hrášku a fazolí';

update foods set nazev = 'Fazole červená' where nazev = 'Fazole cervena';
update foods set nazev = 'Fazole červená (Nature''s Promise)' where nazev = 'Fazole Cervena (Nature''s Promise)';
update foods set nazev = 'Vapeur červené fazole 425 ml' where nazev = 'Vapeur Cervené fazole 425 ml';
update foods set nazev = 'Fazolový mix s cizrnou ve slaném nálevu' where nazev = 'Fazolový mix s cirznou ve. slaném nálevu';

commit;
