-- Migrace 0025: oprava dvou překlepů ve jménech potravin
--   SEmolinové těstoviny (přebytečné velké E po S)
--   SMléčná čokoláda jemnou tekutou náplni (přilepené S z předložky,
--   chybějící délka na náplní)
--   Kolize ověřeny: žádná existující položka se stejným názvem.

begin;

update foods set nazev = 'Semolinové těstoviny'
where nazev = 'SEmolinové těstoviny';

update foods set nazev = 'Mléčná čokoláda s jemnou tekutou náplní (44%)'
where nazev = 'SMléčná čokoláda jemnou tekutou náplni (44%)';

commit;
