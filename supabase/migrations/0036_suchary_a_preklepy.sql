-- Migrace 0036: pečivo-sušenky a cereální produkty z ostatni do správných kategorií.
--   Konvence: sušenky/wafle/perníky -> suchary_testoviny (tortilly tam už jsou),
--   müsli/kaše/rýže/cereálie -> peckoviny_obily, mléčné dezerty -> mlecne_vyrobky,
--   náhražky masa -> maso_ryby. Polévky, ready-meal nudle, pomazánky a tyčinky
--   v ostatni zůstávají. Překlepy u čtyř názvů.

begin;

update foods set kategorie = 'suchary_testoviny'
where kategorie = 'ostatni' and nazev in (
  '8 tortill z hladké mouky',
  'Hořické trubičky čokoládové',
  'Trubičky s vanilkovou příchutí',
  'Jablečné trubičky s čokoládou a černým rybízem',
  'Kávové sušenky s kokosem',
  'Kořeněné sušenky',
  'Ovesné sušenky bez cukru',
  'Medový perník',
  'Sýrové oplatky kořeněné',
  'Krekry s rozmarýmen a extra panenským olivovým olejem'
);

update foods set kategorie = 'peckoviny_obily'
where kategorie = 'ostatni' and nazev in (
  'Cereálie Nestlé',
  'Müsli s meruňkami v jogurtové polevě',
  'Super kaše bez přidaného cukru',
  'Super kaše bez přidaného cukru jablka&meruňky',
  'Tiger thajská rýže lepkavá, Gao Lú''t',
  'Kakaové lupínky (K-Classic)'
);

update foods set kategorie = 'mlecne_vyrobky'
where kategorie = 'ostatni' and nazev in ('Monte Snack', 'Monte snack (Zott)');

update foods set kategorie = 'maso_ryby'
where kategorie = 'ostatni' and nazev = 'Sójový granulát';

update foods set nazev = 'Qwizz protein bar, slaný karamel' where nazev = 'Qwizz rotein bar, slaný karamel';
update foods set nazev = 'Ultra energy bar strawberry' where nazev = 'Ultra enery bar strawberry';
update foods set nazev = 'Kopr a másličko bramborové lupínky' where nazev = 'Kopr A Maslicko Bramborove Lupinky';
update foods set nazev = 'Hovězí s nudlemi do hrnečku' where nazev = 'Hovězí S Nudlemi Do Hrnečku';

commit;
