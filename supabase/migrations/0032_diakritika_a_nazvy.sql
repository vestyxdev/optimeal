-- Migrace 0032: chybějící diakritika, překlepy a strojově přeložené názvy.
--   Kolize ověřeny: žádný cílový název zatím v katalogu není (UNIQUE nazev).

begin;

update foods set nazev = 'Meruňkový nektar' where nazev = 'Merňkový nektar';
update foods set nazev = 'Seafoo tofu uzený' where nazev = 'Seafoo tofu tuned';
update foods set nazev = 'Losos uzený kousky' where nazev = 'Losos uzeny kousky';
update foods set nazev = 'Uzený losos' where nazev = 'Uzeny Losos';
update foods set nazev = 'Bezlaktozový tvaroh' where nazev = 'Bezlaktozovy Tvaroh';
update foods set nazev = 'Balkánský sýr (Fresh)' where nazev = 'Balkánsky syr (Fresh)';
update foods set nazev = 'Athenikos bílý jogurt' where nazev = 'Athenikos bíý jogurt';
update foods set nazev = 'Basmati rýže' where nazev = 'Basmati ryze';
update foods set nazev = 'Basmati rýže (Lagris)' where nazev = 'Basmati ryze (Lagris)';
update foods set nazev = 'Ananasové plátky (Giana Bucati)' where nazev = 'Ananas giana bucati';
update foods set nazev = 'Bez laktózy jogurt borůvka' where nazev = 'Bez laktozy jogurt boruvka';
update foods set nazev = 'Podmáslí ananas-kokos' where nazev = 'Butter Milch (Ananas/Kokos)';
update foods set nazev = 'Oplatka s lískooříškově-kakaovou náplní 48 % (alpské mléko)'
where nazev = 'Oplatka s liskooriskovo-kakaovou naplni 48% sypana kousky liskovych orechu a macena v mlecne cokolade z alpskeho mleka 3';

commit;
