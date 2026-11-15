-- Migrace 0027: konzervované ryby a jerky do maso_ryby, lněné semínko z něj ven.
--   Konvence katalogu: čerstvé i konzervované ryby a sušené maso → maso_ryby
--   (16 položek), pomazánky/nápoje/suroviny → ostatni. Rybí pomazánky
--   zůstávají v ostatni – pomazánky tam mají 96 položek (záměrně).
--   "Kyselé rybičky" je kyselé cukroví (želé rybičky), ne ryba – zůstává.

begin;

update foods set kategorie = 'maso_ryby'
where kategorie = 'ostatni' and nazev in (
  'Jerky',
  'Losos v hořčicové omáčce',
  'Makrela filety v olivovém oleji',
  'Makrela filety v rostlinném oleji',
  'Sardinky v oleji',
  'Sardinky v olivovém oleji',
  'Sardinky ve slaném nálevu a rostlinném oleji',
  'Sardinky ve slaném nálevu a rostlinném oleji (Clever)',
  'Sardinky ve slunečnicovém oleji',
  'Sardinky ve slunečnicovém oleji s chilli',
  'Tuňák kousky v oleji s koprem'
);

-- mleté lněné semínko není maso ani ryba (zřejmě importní chyba)
update foods set kategorie = 'ostatni'
where kategorie = 'maso_ryby' and nazev = 'Lněná semínka mletá';

commit;
