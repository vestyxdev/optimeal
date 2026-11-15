-- Migrace 0038: dočištění – perníčky z ovoce_zelenina do suchary (plurál
--   unikl vzoru 0037), Relax ovocný nápoj do ostatni.

begin;

update foods set kategorie = 'suchary_testoviny'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Mini perníčky',
  'Pardubický perník s borůvkovou náplní',
  'Pardubický perník se švestkovou náplní',
  'Perník meruňka',
  'Perníky s meruňkovou a jablečnou náplní'
);

update foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev = 'Relax černý rybíz, brusinka, ibišek';

commit;
