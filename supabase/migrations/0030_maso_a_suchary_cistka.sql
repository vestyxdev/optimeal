-- Migrace 0030: polévky a chipsy z maso_ryby a suchary_testoviny -> ostatni.
--   Seitan a tofu zůstávají v maso_ryby – prodávají se jako náhražky masa.
--   Mrkev na nudličky je zelenina, ne sušenka.

begin;

-- maso_ryby: chipsy a polévky nejsou maso -> ostatni
update foods set kategorie = 'ostatni'
where kategorie = 'maso_ryby' and nazev in (
  'Bohemia Chips slanina',
  'Chipsy s mořskou solí',
  'Čočkové chipsy s mořskou solí',
  'Proteinové plátky z hrášku a fazolí',
  'Brokolicová instantní polévka s krutony',
  'Gulášová polévka',
  'Gulášová polévka (Maggi)',
  'Hrachová polévka s mořskými řasami',
  'Japonská polévka s mořskými řasami',
  'Naše Byšická polévka GULÁŠOVÁ ta chutná! Velká rodinná',
  'Poctivá polévka gulášová',
  'Zelná polévka s klobásou'
);

-- suchary_testoviny: instantní polévky, hotová jídla a luštěniny -> ostatni
update foods set kategorie = 'ostatni'
where kategorie = 'suchary_testoviny' and nazev in (
  'Hovězí polévka s MAXI knedlíčky',
  'Hovězí polévka s nudlemi',
  'Hovězí S Nudlemi Do Hrnečku',
  'Instantní nudlová polévka',
  'Instantní nudlová polévka - kachní příchuť',
  'Instantní nudlová polévka - příchuť kuřecí kari',
  'Instantní nudlová polévka hříbková',
  'Instantní nudlová polévka kuřecí příchuť',
  'Instantní polévka česneková s rýžovými nudlemi',
  'Instantní polévka houbová s nudlemi',
  'Instantní polévka zeleninová s rýžovými nudlemi',
  'Knedlíčková polévka',
  'Knedlíčková polévka (Náhlík a Náhlík)',
  'Nudlová polévka zeleninová',
  'Rajská polévka s nudlemi',
  'Rajská polévka s těstovinami',
  'Rajčatová polévka s těstovinami',
  'Stir fry nudle se zeleninou a kari',
  'Stir-fry nudle s kokosovým mlékem a citrónovou trávou',
  'Ravioli v rajčatové omáčce',
  'Těstoviny se zeleninou a bezmasými kuličkami',
  'Tortillas Kukuřičný snack s příchutí sýra',
  'Čočka červená',
  'Fazole červené konz.'
);

-- mrkev na nudličky je zelenina, ne sušenka
update foods set kategorie = 'ovoce_zelenina'
where kategorie = 'suchary_testoviny' and nazev = 'Mrkev na nudlicky';

commit;
