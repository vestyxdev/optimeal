-- ============================================================
-- 0041: český potravinový systém – základní české potraviny
-- ------------------------------------------------------------
-- Katalog dosud dominují importy z OpenFoodFacts (cizojazyčné názvy).
-- Tato vlna přidává českou základnu: pečivo, mléčné speciality,
-- uzeniny, typické pokrmy, sladkosti, konzervy, nápoje, luštěniny
-- a sezónní ovoce/zeleninu – s reálnými makry a běžnou cenou Kč/100 g.
-- Sloupec pořadí: nazev, kategorie, bilkoviny, sacharidy, tuky,
-- kalorie, bezna_cena, zdroj, schvaleno.
-- ============================================================

insert into public.foods
  (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, zdroj, schvaleno)
values
  -- ---------------- pečivo a moučníky ----------------
  ('Rohlík',                  'peckoviny_obily', 8.5, 55,  1.5, 275,  3.5, 'seed-cz', true),
  ('Houska',                  'peckoviny_obily', 9.0, 56,  1.8, 280,  3.5, 'seed-cz', true),
  ('Chléb konzumní',          'peckoviny_obily', 7.5, 48,  1.2, 240,  5.0, 'seed-cz', true),
  ('Chléb šumava',            'peckoviny_obily', 8.0, 50,  1.5, 250,  5.5, 'seed-cz', true),
  ('Chléb žitný',             'peckoviny_obily', 7.0, 46,  1.6, 235,  5.5, 'seed-cz', true),
  ('Chléb celozrnný',         'peckoviny_obily', 8.5, 42,  2.5, 230,  7.0, 'seed-cz', true),
  ('Veka',                    'peckoviny_obily', 9.0, 54,  2.0, 275,  4.0, 'seed-cz', true),
  ('Dalamančík',              'peckoviny_obily', 8.5, 55,  2.2, 278,  5.0, 'seed-cz', true),
  ('Bageta',                  'peckoviny_obily', 9.0, 56,  1.5, 280,  4.0, 'seed-cz', true),
  ('Rohlík celozrnný',        'peckoviny_obily',10.0, 48,  3.0, 260,  4.0, 'seed-cz', true),
  ('Chléb toastový',          'peckoviny_obily', 8.0, 49,  3.5, 265,  5.0, 'seed-cz', true),
  ('Mazanec',                 'peckoviny_obily', 8.0, 55,  9.0, 340, 16.0, 'seed-cz', true),
  ('Vánočka',                 'peckoviny_obily', 8.0, 56, 10.0, 350, 18.0, 'seed-cz', true),
  ('Koláč tvarohový',         'peckoviny_obily', 9.0, 45,  9.0, 300, 22.0, 'seed-cz', true),
  ('Koláč makový',            'peckoviny_obily', 9.0, 48, 14.0, 350, 22.0, 'seed-cz', true),
  ('Koláč povidlový',         'peckoviny_obily', 6.0, 50,  6.0, 280, 22.0, 'seed-cz', true),
  ('Buchta s tvarohem',       'peckoviny_obily', 7.0, 48,  8.0, 290, 18.0, 'seed-cz', true),
  ('Bábovka',                 'peckoviny_obily', 6.0, 52, 18.0, 400, 20.0, 'seed-cz', true),
  ('Kobliha s náplní',        'peckoviny_obily', 5.0, 55, 17.0, 400, 20.0, 'seed-cz', true),
  ('Vdolek',                  'peckoviny_obily', 7.0, 45, 12.0, 320, 20.0, 'seed-cz', true),
  ('Trubička šlehačková',     'peckoviny_obily', 5.0, 45, 28.0, 450, 28.0, 'seed-cz', true),
  ('Kremrole',                'peckoviny_obily', 6.0, 48, 24.0, 430, 28.0, 'seed-cz', true),
  ('Indiánek',                'peckoviny_obily', 6.0, 60, 18.0, 420, 30.0, 'seed-cz', true),
  ('Větrník',                 'peckoviny_obily', 5.0, 40, 20.0, 350, 30.0, 'seed-cz', true),
  ('Medovník',                'peckoviny_obily', 5.0, 65, 14.0, 400, 45.0, 'seed-cz', true),
  ('Laskonka',                'peckoviny_obily', 6.0, 75,  8.0, 380, 30.0, 'seed-cz', true),
  ('Preclík slaný',           'peckoviny_obily',10.0, 78,  3.0, 380, 35.0, 'seed-cz', true),
  ('Slané tyčinky',           'peckoviny_obily', 9.0, 72,  8.0, 400, 35.0, 'seed-cz', true),
  ('Knedlík houskový',        'peckoviny_obily', 7.0, 50,  0.9, 240,  5.0, 'seed-cz', true),
  ('Knedlík bramborový',      'peckoviny_obily', 4.0, 40,  0.4, 190,  5.0, 'seed-cz', true),
  ('Knedlík ovocný tvarohový','peckoviny_obily', 6.0, 40,  4.0, 220,  8.0, 'seed-cz', true),
  ('Karlovarský knedlík',     'peckoviny_obily', 6.0, 45,  3.0, 230,  5.0, 'seed-cz', true),
  ('Bramborové těsto',        'peckoviny_obily', 3.0, 32,  0.2, 150,  4.0, 'seed-cz', true),
  ('Langoš',                  'peckoviny_obily', 8.0, 40, 18.0, 350, 30.0, 'seed-cz', true),
  ('Chlebíček',               'peckoviny_obily', 8.0, 35,  8.0, 250, 35.0, 'seed-cz', true),
  -- ---------------- české mléčné speciality ----------------
  ('Tvaroh měkký',            'mlecne_vyrobky',14.0,  3,  4.5, 110, 12.0, 'seed-cz', true),
  ('Tvaroh polotučný',        'mlecne_vyrobky',13.0,  3,  8.0, 145, 13.0, 'seed-cz', true),
  ('Tvaroh tvrdý',            'mlecne_vyrobky',16.0,  1.5,10.0, 160, 14.0, 'seed-cz', true),
  ('Tvaroh odtučněný',        'mlecne_vyrobky',17.0,  3,  0.5,  90, 12.0, 'seed-cz', true),
  ('Olomoucké tvarůžky',      'mlecne_vyrobky',28.0,  1, 11.0, 220, 30.0, 'seed-cz', true),
  ('Olomoucké syrečky',       'mlecne_vyrobky',24.0,  2, 15.0, 240, 32.0, 'seed-cz', true),
  ('Pomazánkové máslo',       'mlecne_vyrobky',11.0,  1.5,21.0, 240, 30.0, 'seed-cz', true),
  ('Hermelín 45 %',           'mlecne_vyrobky',20.0,  0.5,27.0, 320, 40.0, 'seed-cz', true),
  ('Hermelín 60 %',           'mlecne_vyrobky',18.0,  0.5,34.0, 380, 42.0, 'seed-cz', true),
  ('Hermelín grilovaný',      'mlecne_vyrobky',19.0,  1, 30.0, 350, 42.0, 'seed-cz', true),
  ('Niva 60 %',               'mlecne_vyrobky',22.0,  0.7,32.0, 360, 45.0, 'seed-cz', true),
  ('Blaťácké zlato',          'mlecne_vyrobky',24.0,  0.5,17.0, 250, 40.0, 'seed-cz', true),
  ('Korbáčiky uzené',         'mlecne_vyrobky',24.0,  1, 20.0, 280, 45.0, 'seed-cz', true),
  ('Parenica',                'mlecne_vyrobky',24.0,  1, 21.0, 290, 45.0, 'seed-cz', true),
  ('Oštiepok uzený',          'mlecne_vyrobky',25.0,  0.5,28.0, 350, 55.0, 'seed-cz', true),
  ('Sýr žervé',               'mlecne_vyrobky',14.0,  3, 27.0, 300, 38.0, 'seed-cz', true),
  ('Gervais originál',        'mlecne_vyrobky', 8.0,  2, 35.0, 350, 55.0, 'seed-cz', true),
  ('Lučina sýr',              'mlecne_vyrobky', 9.0,  1, 32.0, 330, 55.0, 'seed-cz', true),
  ('Pribináček',              'mlecne_vyrobky', 9.0,  5,  8.0, 130, 20.0, 'seed-cz', true),
  ('Termix',                  'mlecne_vyrobky', 5.0, 20,  8.0, 180, 18.0, 'seed-cz', true),
  ('Lipánek',                 'mlecne_vyrobky', 5.0, 16,  4.0, 120, 18.0, 'seed-cz', true),
  ('Tvarohový nanuk Míša',    'mlecne_vyrobky', 8.0, 20, 10.0, 200, 20.0, 'seed-cz', true),
  ('Jogurt bílý',             'mlecne_vyrobky', 4.0,  5,  3.3,  60, 10.0, 'seed-cz', true),
  ('Kefírové mléko',          'mlecne_vyrobky', 3.0,  4,  2.5,  50,  9.0, 'seed-cz', true),
  ('Zakysaná smetana 16 %',   'mlecne_vyrobky', 2.8,  3.6,16.0, 165, 20.0, 'seed-cz', true),
  ('Smetana ke šlehání 31 %', 'mlecne_vyrobky', 2.5,  3, 31.0, 300, 28.0, 'seed-cz', true),
  ('Smetana do kávy 12 %',    'mlecne_vyrobky', 3.0,  4, 12.0, 135, 18.0, 'seed-cz', true),
  ('Mléko polotučné 1,5 %',   'mlecne_vyrobky', 3.4,  4.8, 1.5,  47,  2.5, 'seed-cz', true),
  ('Mléko plnotučné 3,5 %',   'mlecne_vyrobky', 3.3,  4.8, 3.5,  64,  2.8, 'seed-cz', true),
  ('Podmáslí',                'mlecne_vyrobky', 3.2,  4.5, 0.5,  35,  2.5, 'seed-cz', true),
  ('Tvarohová pomazánka',     'mlecne_vyrobky',12.0,  3, 10.0, 150, 30.0, 'seed-cz', true),
  ('Máslo čerstvé',           'mlecne_vyrobky', 0.6,  0.6,82.0, 745,100.0, 'seed-cz', true),
  ('Sýr tavený',              'mlecne_vyrobky',12.0,  2, 18.0, 220, 35.0, 'seed-cz', true),
  ('Romadur',                 'mlecne_vyrobky',18.0,  1, 26.0, 310, 40.0, 'seed-cz', true),
  -- ---------------- české uzeniny ----------------
  ('Šunka dušená',            'maso_ryby',     17.0,  1,  3.5, 105, 30.0, 'seed-cz', true),
  ('Šunka od kosti',          'maso_ryby',     16.0,  1,  6.0, 120, 45.0, 'seed-cz', true),
  ('Šunka pražská',           'maso_ryby',     18.0,  0.8, 3.0, 100, 40.0, 'seed-cz', true),
  ('Salám lovecký',           'maso_ryby',     18.0,  0.5,28.0, 330, 35.0, 'seed-cz', true),
  ('Salám gothajský',         'maso_ryby',     15.0,  0.5,33.0, 360, 35.0, 'seed-cz', true),
  ('Salám vysočina',          'maso_ryby',     13.0,  1, 36.0, 380, 35.0, 'seed-cz', true),
  ('Salám herkules',          'maso_ryby',     17.0,  1, 27.0, 320, 32.0, 'seed-cz', true),
  ('Salám junior',            'maso_ryby',     14.0,  2, 28.0, 320, 30.0, 'seed-cz', true),
  ('Salám turistický',        'maso_ryby',     16.0,  1, 36.0, 400, 38.0, 'seed-cz', true),
  ('Pařížský salám',          'maso_ryby',     15.0,  1.5,24.0, 280, 32.0, 'seed-cz', true),
  ('Polský salám',            'maso_ryby',     16.0,  1, 25.0, 290, 32.0, 'seed-cz', true),
  ('Párky',                   'maso_ryby',     12.0,  1, 22.0, 250, 20.0, 'seed-cz', true),
  ('Vídeňské párky',          'maso_ryby',     12.0,  1, 23.0, 260, 22.0, 'seed-cz', true),
  ('Spekáčky',                'maso_ryby',     12.0,  1, 25.0, 280, 22.0, 'seed-cz', true),
  ('Viržl',                   'maso_ryby',     12.0,  1, 23.0, 260, 20.0, 'seed-cz', true),
  ('Klobása česká',           'maso_ryby',     14.0,  0.5,26.0, 290, 28.0, 'seed-cz', true),
  ('Buřtguláš',               'maso_ryby',     13.0,  1, 22.0, 260, 26.0, 'seed-cz', true),
  ('Utopenci',                'maso_ryby',     12.0,  2, 23.0, 260, 28.0, 'seed-cz', true),
  ('Tlačenka',                'maso_ryby',     12.0,  0.5,27.0, 300, 22.0, 'seed-cz', true),
  ('Prejt',                   'maso_ryby',     11.0,  3, 28.0, 320, 20.0, 'seed-cz', true),
  ('Jelito',                  'maso_ryby',     12.0,  0.5,27.0, 300, 20.0, 'seed-cz', true),
  ('Jitrnice',                'maso_ryby',     10.0,  5, 25.0, 290, 18.0, 'seed-cz', true),
  ('Škvarky',                 'maso_ryby',     60.0,  0, 38.0, 570, 50.0, 'seed-cz', true),
  ('Škvarková pomazánka',     'maso_ryby',     12.0,  2, 45.0, 450, 28.0, 'seed-cz', true),
  ('Sádlo vepřové',           'maso_ryby',      0.0,  0, 99.0, 890, 18.0, 'seed-cz', true),
  ('Anglická slanina',        'maso_ryby',     13.0,  0, 54.0, 540, 45.0, 'seed-cz', true),
  ('Bůček uzený',             'maso_ryby',      9.0,  0, 45.0, 450, 35.0, 'seed-cz', true),
  ('Krkovice uzená',          'maso_ryby',     14.0,  0.5,21.0, 250, 32.0, 'seed-cz', true),
  ('Kýta uzená',              'maso_ryby',     18.0,  1,  8.0, 150, 35.0, 'seed-cz', true),
  ('Pršut český',             'maso_ryby',     26.0,  0.5,18.0, 280, 80.0, 'seed-cz', true),
  ('Sekaná pečeně',           'maso_ryby',     15.0,  3, 19.0, 250, 28.0, 'seed-cz', true),
  ('Karbanátek',              'maso_ryby',     14.0,  5, 22.0, 280, 26.0, 'seed-cz', true),
  ('Játrová paštika',         'maso_ryby',     13.0,  2, 28.0, 300, 30.0, 'seed-cz', true),
  -- ---------------- typická česká hotová jídla ----------------
  ('Svíčková na smetaně',     'ostatni',        9.0,  5,  9.0, 140, 14.0, 'seed-cz', true),
  ('Guláš vepřový',           'ostatni',       10.0,  3,  8.0, 130, 12.0, 'seed-cz', true),
  ('Hovězí guláš',            'ostatni',       12.0,  2,  7.0, 120, 13.0, 'seed-cz', true),
  ('Koprová omáčka',          'ostatni',        4.0,  6, 10.0, 130, 10.0, 'seed-cz', true),
  ('Rajská omáčka',           'ostatni',        3.0,  9,  4.5,  90,  9.0, 'seed-cz', true),
  ('Smažený sýr',             'ostatni',       16.0, 15, 23.0, 330, 18.0, 'seed-cz', true),
  ('Vepřový řízek',           'ostatni',       18.0,  8, 16.0, 250, 25.0, 'seed-cz', true),
  ('Kuřecí řízek',            'ostatni',       20.0,  8, 13.0, 230, 23.0, 'seed-cz', true),
  ('Bramborák',               'ostatni',        4.0, 18, 10.0, 180, 15.0, 'seed-cz', true),
  ('Čočka na kyselo',         'ostatni',        5.0, 12,  3.0, 100,  8.0, 'seed-cz', true),
  ('Hrachová kaše',           'ostatni',        5.0, 15,  3.5, 110,  8.0, 'seed-cz', true),
  ('Lečo s vajíčky',          'ostatni',        4.0,  6,  5.5,  90, 10.0, 'seed-cz', true),
  ('Pečená kachna',           'ostatni',       18.0,  0, 20.0, 250, 35.0, 'seed-cz', true),
  ('Smažený kapr',            'ostatni',       20.0,  6, 11.0, 200, 30.0, 'seed-cz', true),
  ('Moravský vrabec',         'ostatni',       18.0,  1, 17.0, 230, 26.0, 'seed-cz', true),
  ('Španělský ptáček',        'ostatni',       14.0,  2, 10.0, 160, 24.0, 'seed-cz', true),
  ('Plněná paprika s rajskou','ostatni',        5.0,  8,  4.0,  90, 12.0, 'seed-cz', true),
  ('Ovocné knedlíky jahodové','ostatni',        6.0, 38,  5.0, 220, 14.0, 'seed-cz', true),
  ('Ovocné knedlíky borůvkové','ostatni',       6.0, 38,  5.0, 220, 14.0, 'seed-cz', true),
  ('Šišky s mákem',           'ostatni',        7.0, 45,  5.0, 250, 12.0, 'seed-cz', true),
  ('Škubánky s mákem',        'ostatni',        6.0, 40,  6.0, 230, 10.0, 'seed-cz', true),
  ('Míchaná vajíčka',         'ostatni',       12.0,  1, 10.0, 145, 12.0, 'seed-cz', true),
  ('Holandský řízek',         'ostatni',       10.0,  8, 12.0, 180, 18.0, 'seed-cz', true),
  ('Vepřové výpečky',         'ostatni',       20.0,  1, 15.0, 220, 28.0, 'seed-cz', true),
  ('Dušené zelí',             'ostatni',        1.5,  4,  3.0,  45,  4.0, 'seed-cz', true),
  ('Bramboračka',             'ostatni',        1.5,  7,  2.0,  50,  5.0, 'seed-cz', true),
  ('Česnečka',                'ostatni',        2.0,  7,  3.0,  60,  5.0, 'seed-cz', true),
  ('Gulášová polévka',        'ostatni',        4.0,  5,  3.0,  60,  7.0, 'seed-cz', true),
  ('Frankfurtská polévka',    'ostatni',        3.0,  8,  4.0,  80,  6.0, 'seed-cz', true),
  ('Zelňačka',                'ostatni',        3.0,  6,  4.0,  70,  5.0, 'seed-cz', true),
  ('Kulajda',                 'ostatni',        3.0,  6,  3.0,  55,  6.0, 'seed-cz', true),
  ('Hovězí vývar s nudlemi',  'ostatni',        2.0,  4,  0.5,  30,  5.0, 'seed-cz', true),
  ('Dršťková polévka',        'ostatni',        8.0,  2,  6.0,  90, 12.0, 'seed-cz', true),
  -- ---------------- české sladkosti ----------------
  ('Tatranka oříšková',       'suchary_testoviny',5.0,60,28.0,510, 45.0, 'seed-cz', true),
  ('Tatranka čokoládová',     'suchary_testoviny',5.0,62,27.0,510, 45.0, 'seed-cz', true),
  ('Horalky arašídové',       'suchary_testoviny',6.0,58,30.0,520, 45.0, 'seed-cz', true),
  ('Horalky kakaové',         'suchary_testoviny',6.0,60,28.0,515, 45.0, 'seed-cz', true),
  ('Zlaté oplatky',           'suchary_testoviny',5.0,65,20.0,470, 40.0, 'seed-cz', true),
  ('Křemes čokoládový',       'suchary_testoviny',8.0,55,28.0,500, 40.0, 'seed-cz', true),
  ('Studentská pečeť mléčná', 'ostatni',        9.0, 50, 34.0, 550, 55.0, 'seed-cz', true),
  ('Studentská pečeť hořká',  'ostatni',        9.0, 48, 36.0, 560, 55.0, 'seed-cz', true),
  ('Ledové kaštany',          'ostatni',        7.0, 52, 34.0, 540, 60.0, 'seed-cz', true),
  ('Kaštany pralinky',        'ostatni',        6.0, 55, 30.0, 520, 55.0, 'seed-cz', true),
  ('Milá čokoláda',           'ostatni',        8.0, 52, 35.0, 560, 50.0, 'seed-cz', true),
  ('Lentilky',                'ostatni',        8.0, 68, 16.0, 450, 60.0, 'seed-cz', true),
  ('Margot',                  'ostatni',        5.0, 62, 26.0, 500, 50.0, 'seed-cz', true),
  ('Bon pari',                'ostatni',        0.0, 98,  0.0, 400, 30.0, 'seed-cz', true),
  ('Hašlerky',                'ostatni',        0.0, 85,  0.5, 350, 45.0, 'seed-cz', true),
  ('Brumík',                  'ostatni',        7.0, 60, 21.0, 450, 50.0, 'seed-cz', true),
  ('Orion čokoláda mléčná',   'ostatni',        8.0, 55, 32.0, 540, 50.0, 'seed-cz', true),
  ('Granko instantní',        'ostatni',        5.0, 80,  3.0, 390, 40.0, 'seed-cz', true),
  -- ---------------- konzervy a dochucovadla ----------------
  ('Švestková povidla',       'ostatni',        1.0, 58,  0.2, 240, 22.0, 'seed-cz', true),
  ('Hořčice plnotučná',       'ostatni',        5.0,  6,  4.0,  90, 10.0, 'seed-cz', true),
  ('Hořčice křemžská',        'ostatni',        5.0,  7,  4.5, 100, 11.0, 'seed-cz', true),
  ('Tatarka',                 'ostatni',        1.0,  3, 65.0, 600, 35.0, 'seed-cz', true),
  ('Majonéza',                'ostatni',        1.0,  1.5,77.0, 700, 32.0, 'seed-cz', true),
  ('Kečup jemný',             'ostatni',        1.5, 25,  0.1, 110, 12.0, 'seed-cz', true),
  ('Okurky nakládané',        'ostatni',        1.0,  5,  0.2,  30, 10.0, 'seed-cz', true),
  ('Okurky znojemské',        'ostatni',        1.0,  6,  0.2,  35, 11.0, 'seed-cz', true),
  ('Čalamáda',                'ostatni',        1.0,  9,  0.5,  45, 12.0, 'seed-cz', true),
  ('Kysané zelí',             'ostatni',        1.0,  3,  0.2,  25,  3.5, 'seed-cz', true),
  ('Červená řepa sterilovaná','ostatni',        1.5,  8,  0.1,  45,  8.0, 'seed-cz', true),
  ('Sterilované žampiony',    'ostatni',        3.0,  1,  0.3,  20, 14.0, 'seed-cz', true),
  ('Sušené houby',            'ostatni',       25.0, 30,  3.0, 250,150.0, 'seed-cz', true),
  ('Kompot broskvový',        'ostatni',        0.4, 14,  0.1,  60, 10.0, 'seed-cz', true),
  ('Marmeláda jahodová',      'ostatni',        0.5, 60,  0.1, 250, 18.0, 'seed-cz', true),
  ('Ocet kvasný lihový',      'ostatni',        0.0,  0.5, 0.0,  15,  6.0, 'seed-cz', true),
  ('Sůl kuchyňská',           'ostatni',        0.0,  0,  0.0,   0,  1.5, 'seed-cz', true),
  ('Vegeta',                  'ostatni',       10.0, 35,  1.0, 200, 60.0, 'seed-cz', true),
  ('Droždí čerstvé',          'ostatni',       12.0,  8,  2.0, 105,  8.0, 'seed-cz', true),
  ('Droždí sušené',           'ostatni',       40.0, 20,  5.0, 300, 90.0, 'seed-cz', true),
  ('Strouhanka',              'ostatni',       12.0, 72,  2.0, 380, 10.0, 'seed-cz', true),
  ('Solamyl',                 'ostatni',        0.0, 87,  0.0, 350,  5.0, 'seed-cz', true),
  ('Kypřicí prášek',          'ostatni',        0.0, 25,  0.0, 100, 30.0, 'seed-cz', true),
  ('Bujón kostka',            'ostatni',        8.0, 10,  2.0,  90, 25.0, 'seed-cz', true),
  ('Sojová omáčka',           'ostatni',        8.0,  5,  0.0,  60, 25.0, 'seed-cz', true),
  -- ---------------- trvanlivé a luštěniny ----------------
  ('Hrách suchý',             'suchary_testoviny',21.0,55,2.0,330,  9.0, 'seed-cz', true),
  ('Fazole bílé',             'suchary_testoviny',22.0,60,1.5,330, 12.0, 'seed-cz', true),
  ('Fazole červené',          'suchary_testoviny',24.0,58,1.2,330, 12.0, 'seed-cz', true),
  ('Čočka červená',           'suchary_testoviny',25.0,60,1.0,350, 10.0, 'seed-cz', true),
  ('Pohanka',                 'suchary_testoviny',13.0,70,3.0,350,  9.0, 'seed-cz', true),
  ('Kroupy',                  'suchary_testoviny',11.0,72,1.5,340,  6.0, 'seed-cz', true),
  ('Krupice',                 'suchary_testoviny',12.0,73,1.0,360,  7.0, 'seed-cz', true),
  ('Bulgur',                  'suchary_testoviny',12.0,75,1.5,350,  8.0, 'seed-cz', true),
  ('Kuskus',                  'suchary_testoviny',13.0,75,1.5,360,  8.0, 'seed-cz', true),
  ('Těstoviny vaječné',       'suchary_testoviny',13.0,72,2.0,360,  8.0, 'seed-cz', true),
  ('Tarhoňa',                 'suchary_testoviny',12.0,75,1.5,360,  8.0, 'seed-cz', true),
  ('Suchary dětské piškoty',  'suchary_testoviny',9.0, 75,4.0,380, 20.0, 'seed-cz', true),
  ('Sojky slané',             'suchary_testoviny',20.0,40,20.0,400,25.0, 'seed-cz', true),
  ('Slunečnicová semínka',    'suchary_testoviny',21.0,11,50.0,560,35.0, 'seed-cz', true),
  ('Mák modrý',               'suchary_testoviny',18.0,14,42.0,525,60.0, 'seed-cz', true),
  ('Hrozinky',                'suchary_testoviny',3.0, 70,0.5,300, 25.0, 'seed-cz', true),
  ('Švestky sušené',          'suchary_testoviny',2.5, 55,0.5,240, 30.0, 'seed-cz', true),
  ('Meruňky sušené',          'suchary_testoviny',5.0, 60,0.5,260, 40.0, 'seed-cz', true),
  ('Brusinky sušené',         'suchary_testoviny',0.5, 80,0.5,330, 40.0, 'seed-cz', true),
  ('Vločky pětidruhové',      'suchary_testoviny',12.0,60,5.0,350,  8.0, 'seed-cz', true),
  -- ---------------- české nápoje ----------------
  ('Birell',                  'ostatni',        0.0,  6,  0.0,  25,  4.0, 'seed-cz', true),
  ('Nealkoholické pivo',      'ostatni',        0.3,  4.5,0.0,  20,  3.5, 'seed-cz', true),
  ('Pivo 10°',                'ostatni',        0.5,  3,  0.0,  40,  2.5, 'seed-cz', true),
  ('Mattoni perlivá',         'ostatni',        0.0,  0,  0.0,   0,  1.5, 'seed-cz', true),
  ('Poděbradka',              'ostatni',        0.0,  0,  0.0,   0,  1.5, 'seed-cz', true),
  ('Ondrášovka',              'ostatni',        0.0,  0,  0.0,   0,  1.5, 'seed-cz', true),
  ('Korunní',                 'ostatni',        0.0,  0,  0.0,   0,  1.5, 'seed-cz', true),
  ('Vinea bílá',              'ostatni',        0.0, 11,  0.0,  45,  5.0, 'seed-cz', true),
  ('Malinovka',               'ostatni',        0.0, 10,  0.0,  42,  4.0, 'seed-cz', true),
  ('Slivovice',               'ostatni',        0.0,  0,  0.0, 290, 30.0, 'seed-cz', true),
  ('Becherovka',              'ostatni',        0.0, 15,  0.0, 230, 35.0, 'seed-cz', true),
  ('Fernet Stock',            'ostatni',        0.0, 10,  0.0, 250, 30.0, 'seed-cz', true),
  ('Tuzemák',                 'ostatni',        0.0, 10,  0.0, 220, 25.0, 'seed-cz', true),
  ('Medovina',                'ostatni',        0.0, 30,  0.0, 280, 35.0, 'seed-cz', true),
  ('Malinový sirup',          'ostatni',        0.0, 75,  0.0, 300, 15.0, 'seed-cz', true),
  -- ---------------- české ovoce a zelenina ----------------
  ('Švestky',                 'ovoce_zelenina', 0.7, 10,  0.3,  46, 10.0, 'seed-cz', true),
  ('Mirabelky',               'ovoce_zelenina', 0.7, 12,  0.3,  50, 12.0, 'seed-cz', true),
  ('Třešně',                  'ovoce_zelenina', 1.0, 13,  0.2,  63, 15.0, 'seed-cz', true),
  ('Višně',                   'ovoce_zelenina', 1.0, 12,  0.3,  55, 15.0, 'seed-cz', true),
  ('Angrešt',                 'ovoce_zelenina', 0.9,  9,  0.6,  44, 15.0, 'seed-cz', true),
  ('Rybíz červený',           'ovoce_zelenina', 1.3, 10,  0.2,  50, 18.0, 'seed-cz', true),
  ('Rybíz černý',             'ovoce_zelenina', 1.5, 12,  0.4,  60, 18.0, 'seed-cz', true),
  ('Maliny čerstvé',          'ovoce_zelenina', 1.2, 12,  0.6,  52, 30.0, 'seed-cz', true),
  ('Ostružiny',               'ovoce_zelenina', 1.4, 10,  0.4,  45, 25.0, 'seed-cz', true),
  ('Borůvky čerstvé',         'ovoce_zelenina', 0.7, 14,  0.3,  57, 35.0, 'seed-cz', true),
  ('Brusinky čerstvé',        'ovoce_zelenina', 0.4, 12,  0.2,  46, 20.0, 'seed-cz', true),
  ('Meruňky čerstvé',         'ovoce_zelenina', 1.4, 11,  0.4,  48, 12.0, 'seed-cz', true),
  ('Broskve',                 'ovoce_zelenina', 1.0, 10,  0.3,  43, 10.0, 'seed-cz', true),
  ('Hrušky',                  'ovoce_zelenina', 0.4, 15,  0.1,  57,  7.0, 'seed-cz', true),
  ('Kapusta',                 'ovoce_zelenina', 1.3,  5,  0.1,  25,  5.0, 'seed-cz', true),
  ('Hlíva ústřičná',          'ovoce_zelenina', 3.0,  5,  0.3,  30, 15.0, 'seed-cz', true),
  ('Křen čerstvý',            'ovoce_zelenina', 3.0, 16,  0.5,  80, 25.0, 'seed-cz', true),
  ('Kopr čerstvý',            'ovoce_zelenina', 3.5,  7,  1.0,  43, 30.0, 'seed-cz', true),
  ('Petrželová nať',          'ovoce_zelenina', 3.0,  8,  0.8,  45, 30.0, 'seed-cz', true),
  ('Majoránka sušená',        'ovoce_zelenina',13.0, 40,  4.0, 270, 80.0, 'seed-cz', true),
  ('Máta čerstvá',            'ovoce_zelenina', 3.8,  8,  0.7,  45, 40.0, 'seed-cz', true),
  ('Zeleninová směs mražená', 'ovoce_zelenina', 3.0,  6,  0.3,  40,  6.0, 'seed-cz', true)
on conflict (nazev) do nothing;

-- alergeny a diety pro české položky (zjevné případy)
update public.foods
   set alergeny = '{lepek}'::text[]
 where zdroj = 'seed-cz'
   and nazev ~* 'rohl.k|housk|chleb|veka|dalaman|knedl|kol..|buchta|b.bovka|v.no.ka|mazanec|koblih|vdolek|trubi.k|kremrole|indi.n|v.trn|laskonk|precl|ty.ink|lango|chleb..ek|t.stovin|tarho|strouhank|kuskus|bulgur|krup|pohank|sekan.|karban.tek|jelito|jitrnic|horalk|tatrank|oplatk|k.emes|brum.k|.izek|brambor.k|nudl';

update public.foods
   set alergeny = array_append(coalesce(alergeny, '{}'::text[]), 'mleko')
 where zdroj = 'seed-cz'
   and nazev ~* 'tvaroh|hermel|niva|tvar..k|syre.k|pomaz.nkov|smetan|ml.ko|jogurt|kef.r|m.slo|podm.sl|lu.ina|gervais|pribin|termix|lip.nek|korb..ik|parenica|o.tiepok|m.a|romadur|taven.|sma.en. s.r|holandsk|kulajd|sv..kov.|koprov.|majonez|tatar|kol..|buchta|mazanec|v.no.k|kremrole|trubi.k|v.trn|indi.n|medovn|nanuk';

update public.foods
   set alergeny = array_append(coalesce(alergeny, '{}'::text[]), 'vejce')
 where zdroj = 'seed-cz'
   and nazev ~* 't.stovin vaje.n|m.chan. vaj|le.o|majonez|tatar|.izek|karban.tek|sekan.|holandsk|indian|v.trn|kremrol|trubi.k|mazanec|v.no.k|babovka|b.bovka|koblih|vdolek|knedl|lango|nudl';

update public.foods
   set alergeny = array_append(coalesce(alergeny, '{}'::text[]), 'horcice')
 where zdroj = 'seed-cz' and nazev ~* 'ho..ic|utop|tatar';

update public.foods
   set alergeny = array_append(coalesce(alergeny, '{}'::text[]), 'arasidy')
 where zdroj = 'seed-cz' and nazev ~* 'horalky ara..d|studentsk|lentilky|margot';

update public.foods
   set diety = '{vegetariansky}'::text[]
 where zdroj = 'seed-cz'
   and (kategorie in ('mlecne_vyrobky', 'ovoce_zelenina', 'peckoviny_obily')
    or nazev ~* 'nanuk|pribin|termix|lip.nek|granko|lentilky|bon pari|ha.lerk|brum.k|margot|studentsk|kastan|mil.|povidl|marmel.d|kompot|kysan. zel.|zel.|okurk|.alam.d|houby|fazol|hrach|hr.ch|cočk|čočk|lentil|pohank|kroup|krupic|bulgur|kuskus|t.stovin|tarho|ocet|sůl|sul |vegeta|dro.d|strouhank|solamyl|kyp.ic|buj.n|sojov|mák modrý|mák |hrozink|su.en.|vlo.ky|miner.l|voda|birell|nealko|mattoni|pod.brad|ondr.|korunn|vinea|malinov|sirup|kol..|buchta|b.bovka|v.no.k|mazanec|koblih|vdolek|indi.n|v.trn|medovn|laskonk|precl|ty.ink|du.en. zel.|.o.ka na kyselo|hrachov. ka.e|ovocn. knedl|brambor.k|sma.en. s.r|brambora.ka|.esne.k|zel..k|kulajd|m.chan.|holandsk');

update public.foods
   set diety = '{vegansky,vegetariansky}'::text[]
 where zdroj = 'seed-cz'
   and nazev ~* 'kysan. zel.|zel.|okurk|.alam.d|kompot|marmel.d|povidl|ocet|sůl|sul |vegeta|solamyl|kyp.ic|su.en. houby|fazol|hrach|hr.ch|cočk|čočk|lentil|pohank|kroup|krupic|bulgur|kuskus|tarho|mák modrý|mák |hrozink|su.en.|vlo.ky|miner.l|mattoni|pod.brad|ondr.|korunn|vinea|malinov|birell|nealko|slivovic|becherov|fernet|tuzem.k|pivo|sirup|vestky|mirabel|t.e.n|vi.n|angre.t|ryb.z|maliny|ostru.iny|bor.vky|brusinky|meru.k|broskv|hru.ky|kapust|hl.va|k.en|kopr|petr.el|major.n|máta|zeleninov|hrachov. ka.e|du.en. zel.|bramborov. t.sto';
