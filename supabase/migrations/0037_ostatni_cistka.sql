-- Migrace 0037: velká čistka ovoce_zelenina a mlecne_vyrobky.
--   ovoce_zelenina: džemy/mošty/namáčky -> ostatni (pomazánková+napojová konvence),
--   polévky a polévkové směsi -> ostatni, chips -> ostatni,
--   cereální lupínky a kaše -> peckoviny_obily, pečivo -> suchary.
--   mlecne_vyrobky: oříškové "másla" = pomazánky -> ostatni (skutečná másla
--   a margaríny zůstávají), máslové sušenky -> suchary, polévky/chips/čokoláda
--   /sorbet -> ostatni. Překlepy: Kvetáková smes, Meruňkovy, Pohánkova,
--   137635 Fit ryžovà.

begin;

-- ovoce_zelenina -> ostatni: džemy, mošty, pasty, candy
update foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Borůvkový džem','Borůvkový džem (TIBI)','Černorybízový džem','Džem jablečno-jahodový Jahůdka',
  'Džem z černého rybízu','Extra džem meruňkový','Extra džem z fíků','Extra malinový džem',
  'GRIZLY Vánoční rybízový džem na linecké, 200 g','Jahodový Džem','Jahodový Džem (Karlova Koruna)',
  'Jahodový džem (TIBI)','Jahodový džem s guavou','Malinový džem','Meruňkový džem',
  'Meruňkový džem (Albert)','Meruňkový džem (Gustona)','Meruňkový džem (K-Bio Organic)',
  'Meruňkový džem (Lidl)','Meruňkový džem (Nature''s Promise)','Meruňkový džem (Riso-R)',
  'Meruňkový džem (St. Dalfour)','Meruňkový džem výběrový','Meruňkovy extra džem',
  'Šípkový džem','Višňový džem','Višňový džem (Lidl Preferred Selection)',
  'Jablečno rybízový mošt','Jablečný mošt','Jablečný mošt s dužinou','Mošt - jahoda, jablko','Mošt jablko a mrkev',
  'Kaštanová pasta s borůvkami','Hašlerky černý rybíz','Hašlerky višeň',
  'Fruit rolls černý rybíz','Fruit rolls maliny'
);

-- ovoce_zelenina -> ostatni: polévky a polévkové směsi
update foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Bio Polévka rajčatová Toscana','Dýňová polévka se zázvorem','Exotická polévka se zeleninou a houbami shitake',
  'Farmářská polévka','Gazpacho Cold Soup','Gazpacho polévka','Hrášková krémová polévka s mátou',
  'Jarní polévka','Krémová dýňová polévka','Krémová polévka z dýně a mrkviček',
  'Kvetáková polévková smes 400 g','Luštěninová polévka a chilli','Minestrone polévka (Nature''s Promise)',
  'Minestrone polévková směs','Papriková polévka s feferonkami','Písmenková polévka',
  'Písmenková polévka (Natur compagnie)','Poctivá slepičí polévka','Polévka minestrone',
  'Polévka na italský způsob','Polévková směs','Polévková směs (Nowaco)','Rajčatová polévka',
  'Rajská polévka','Sedlácká polévka se zeleninou','Sušená směs na polévku','Tomatová polévka',
  'Tomatová polévka s bazalkou','Vydatná polévka s výběrem luštěnin a obilovin','Žampionová polévka',
  'Zelená polévková směs 400 g','Zeleninová směs do polévky','Zeleninová směs na polévku'
);

-- ovoce_zelenina -> ostatni: chipsy a snacky
update foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Banán chips','Banán plátky (banánové chipsy)','Bananenchips Fine Fruit','Banánové chipsy',
  'Banánové chipsy (Frutree)','Chipsy paprika','Chipsy se špenátem a česnekem','Crunchips Paprika',
  'High Protein Chips Sladká paprika','Jablečné chipsy jahodové','Kokosové chipsy malina',
  'Kokosové chipsy opékané','Kokosové chipsy s kakaem','Ovocné chipsy meloun','Polomáčené kokosové chipsy',
  'Smažené bramborové lupínky s červenou paprikou a jarní cibulkou','Smažené bramborové lupínky s červenou řepou a mátou'
);

-- ovoce_zelenina -> peckoviny_obily: cereální lupínky a kaše
update foods set kategorie = 'peckoviny_obily'
where kategorie = 'ovoce_zelenina' and nazev in (
  'Kakaové lupínky','Kakaové lupínky (Tesco)','Křupavé lupínky','Kukuřičné lupínky',
  'Kukuřičné lupínky (Albert)','Kukuřičné lupínky (Clever)','Kukuřičné lupínky (emco)',
  'Kukuřičné lupínky (K-Classic)','Kukuřičné lupínky (Kaufland)','Kukuřičné lupínky (Nature''s Promise)',
  'Ovesné lupínky celozrnné křupavé','Pšeničné lupínky',
  '137635 Fit ryžovà kaša - Usovsko','Ryžová kaša slaný karamel a mandle','Pohánkova Kaša Natural',
  'Kaša biela čokoláda & višne','Rýžová Probio kaša čokoláda a banán','Směs na ovesnou kaši'
);

-- ovoce_zelenina -> suchary_testoviny
update foods set kategorie = 'suchary_testoviny'
where kategorie = 'ovoce_zelenina' and nazev = 'Jemné pečivo s perníkovou příchutí a meruňkovou náplní';

-- mlecne_vyrobky -> ostatni: oříšková másla a krémy (pomazánky), polévky, chips, sladkosti
update foods set kategorie = 'ostatni'
where kategorie = 'mlecne_vyrobky' and nazev in (
  'Arašídové máslo','Arašídové máslo (Bery jones)','Arašídové máslo Hořká čokoláda',
  'Arašídové máslo s karamelem','Arašídové máslo s kousky arašídů','Arašídové máslo s příchutí slaného karamelu',
  'Arašídové máslo slaný karamel','Arašídové máslo, hořká čokoláda','Denuts cream, Arašídové máslo',
  'Ježkovo máslo','Kešu máslo s banánem','Mandlové máslo','Mandlové máslo (Šufan)',
  'Mandlové máslo s borůvkami','Ořechové máslo','Pistáciové máslo','Popcorn máslový',
  'Bio hrachová polévka s kukuřicí a kokosovým mlékem','Exotická polévka s cizrnou a kokosovým mlékem',
  'Krémová polévka ze zeleného chřestu','Tomatová polévka s italským sýrem',
  'Chipsy smetana a cibule','Chipsy Smetana a Cibule','Chipsy Smetana A Cibule (Bohemia)',
  'Vroubkované Chipsy Cheddar A Cibule','Lahůdka čokoláda','Mléčná čokoláda','Sorbetto al Limone'
);

-- mlecne_vyrobky -> suchary_testoviny: máslové sušenky a sýrové tyčinky
update foods set kategorie = 'suchary_testoviny'
where kategorie = 'mlecne_vyrobky' and nazev in (
  '8 máslových sušenek s pistáciovými oříšky a mandlemi','Bio keksy s máslovou příchutí',
  'Rodinné Club máslové','Original trvanlivé tyčinky se sýrem a solí','Sýrové tyčinky'
);

-- maso_ryby -> ostatni: slaninové chipsy a semínka (výjimky z masné kategorie)
update foods set kategorie = 'ostatni'
where kategorie = 'maso_ryby' and nazev in (
  'Bramborové lupínky smažené, se slaninovou přichuti','Mletá dýňová semínka'
);

-- překlepy
update foods set nazev = 'Květáková polévková směs 400 g' where nazev = 'Kvetáková polévková smes 400 g';
update foods set nazev = 'Meruňkový extra džem' where nazev = 'Meruňkovy extra džem';
update foods set nazev = 'Pohánková kaše Natural' where nazev = 'Pohánkova Kaša Natural';
update foods set nazev = 'Fit rýžová kaše (Usovsko)' where nazev = '137635 Fit ryžovà kaša - Usovsko';

commit;
