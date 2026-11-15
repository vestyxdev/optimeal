-- =============================================================
-- 0019 – překlad cizojazyčných názvů z OFF importů
-- -------------------------------------------------------------
-- Katalog obsahuje stovky OFF položek s anglickými/německými/
-- polskými názvy. Značky a příchutě překládáme zachováním
-- v názvu (YoPro, K-take it veggie, dmBio…), takže EAN importy
-- ani letákový matcher nic neztratí.
--
-- Kolize kontrolovány proti živé DB (nazev je UNIQUE):
-- cíle 'Bílý jogurt', 'Řecký jogurt', 'Sójová omáčka',
-- 'Sójový nápoj', 'BBQ omáčka', 'Kokosový jogurt' existují –
-- proto kvalifikátory (natural / Natur / Kinzan / dmBio…).
-- Idempotentní – opakovaný běh nic nezmění.
-- =============================================================

begin;

-- nápoje (rostlinné drinky)
update public.foods set nazev = 'Ovesný nápoj'                          where nazev = 'Oat drink';
update public.foods set nazev = 'Ovesný nápoj Natur'                    where nazev = 'Hafer Drink Natur';
update public.foods set nazev = 'Bio ovesný nápoj Natur'                where nazev = 'Bio Hafer Drink';
update public.foods set nazev = 'Veganský ovesný nápoj'                 where nazev = 'Veganer Hafer Drink';
update public.foods set nazev = 'Ovesný nápoj barista'                  where nazev = 'Haferdrink Barista';
update public.foods set nazev = 'Bio ovesný nápoj barista'              where nazev = 'Organic oat barista drink';
update public.foods set nazev = 'Bio ovesný nápoj (import)'             where nazev = 'organic oat drink';
update public.foods set nazev = 'Kokosový nápoj'                        where nazev = 'Kokos Drink Natur';
update public.foods set nazev = 'Mandlový nápoj'                        where nazev = 'Almond drink';
update public.foods set nazev = 'Rýžový nápoj s vápníkem'               where nazev = 'Reis drink calcium';
update public.foods set nazev = 'Sójový nápoj Natur'                    where nazev = 'Soja Drink Natur';
update public.foods set nazev = 'Sójový nápoj (dmBio)'                  where nazev = 'Soja Drink Natur (dmBio)';
update public.foods set nazev = 'Proteinový drink vanilka'              where nazev = 'Protein drink plus. vanilla';
update public.foods set nazev = 'YoPro jogurtový drink stracciatella'   where nazev = 'yopro stracciatella flavour yogurt drink';
update public.foods set nazev = 'Schoko drink 3,5 % tuku'               where nazev = 'Schoko Drink 3.5% Fett';
update public.foods set nazev = 'Kakaový nápoj'                         where nazev = 'Cacao drink';
update public.foods set nazev = 'Ledový kávový nápoj'                   where nazev = 'Iced coffee-drink';
update public.foods set nazev = 'Cappuccino vanilkové'                  where nazev = 'Cappuccino Vanilla Flavoured';
update public.foods set nazev = 'Matcha jahodová'                       where nazev = 'Matcha strawberry flavour';
update public.foods set nazev = 'Mr. Brown ledová káva'                 where nazev = 'Mr. Brown Coffee drink';
update public.foods set nazev = 'Alpro káva s mandlovým nápojem'        where nazev = 'Alpro Kaffee mit Mandeldrink, Caffè 235ml';
update public.foods set nazev = 'K-take it veggie bio sójovo-rýžový nápoj' where nazev = 'K-take it veggie Bio Soja-Reisdrink';
update public.foods set nazev = 'K-take it veggie bio mandlový nápoj neslazený' where nazev = 'K-take it veggie Organic Drink Almond unsweetened';
update public.foods set nazev = 'K-take it veggie bio mandlový nápoj slazený'   where nazev = 'K-take it veggie Bio Mandeldrink gesüßt';
update public.foods set nazev = 'K-take it veggie bio ovesný nápoj'     where nazev = 'K-take it veggie Organic Oats Drink 1l';
update public.foods set nazev = 'K-take it veggie bio ovesný čokoládový nápoj' where nazev = 'K-take it veggie Organic Oats Choco Drink 1l';
update public.foods set nazev = 'K-take it veggie bio ovesný vanilkový nápoj'  where nazev = 'K-take it veggie Organic Oats Vanilla Drink 1l';
update public.foods set nazev = 'Provamel bio mandlový nápoj'           where nazev = 'Provamel Biologischer Mandeldrink 1L';
update public.foods set nazev = 'Oatie bezmléčný nápoj'                 where nazev = 'Oatie Dairy Free Drink';
update public.foods set nazev = 'Pure Joy kokosový nápoj'               where nazev = 'Pure Joy Kokos Drink';
update public.foods set nazev = 'Rostlinný nápoj jahoda'                where nazev = 'Plant drink jahoda';
update public.foods set nazev = 'Ochucený nápoj (Tesco)'                where nazev = 'Tesco drink';
update public.foods set nazev = 'Nápoj mrkev-banán-jablko'              where nazev = 'Drink carrot, banana & apple';
update public.foods set nazev = 'Jahodový ovocný nápoj'                 where nazev = 'Strawberry juice drink';
update public.foods set nazev = 'Ovsánek nápoj natural'                 where nazev = 'Ovsánek drink natural';
update public.foods set nazev = 'Kokosový veganský jogurtový drink jahoda-banán' where nazev = 'coconut vegangurt drink jahoda a banán';
update public.foods set nazev = 'Ovocný nápoj multivitamín'             where nazev = 'fruit drink multivitamín';
update public.foods set nazev = 'Energetický nápoj'                     where nazev = 'Energy Drink';
update public.foods set nazev = 'Energetický nápoj classic'             where nazev = 'energy drink classic';
update public.foods set nazev = 'BCAA nápoj hruška'                     where nazev = 'BCAA Drink Crispy Pear';
update public.foods set nazev = 'BCAA nápoj marakuja'                   where nazev = 'BCAA Drink Passion Fruit';
update public.foods set nazev = 'BCAA nápoj višeň'                      where nazev = 'BCAA Drink Cherry';
update public.foods set nazev = 'Carnitine activity drink eukalyptus-kiwi' where nazev = 'CARNITINE Activity drink eukalyptus+kiwi';
update public.foods set nazev = 'Carnitine activity drink ostružina-limetka' where nazev = 'Carnitine Activity Drink ostružina + limetka';
update public.foods set nazev = 'Carnitine activity drink pomelo'       where nazev = 'Carnitine Activity Drink pomelo';
update public.foods set nazev = 'Carnitine activity drink s kofeinem červený pomeranč' where nazev = 'Carnitine activity drink with caffeine - červený pomeranč';
update public.foods set nazev = 'Carnitine activity drink zelený čaj-bezinka'  where nazev = 'Carnitine activity drink zelený čaj+bezinka';
update public.foods set nazev = 'Carnitine activity drink s kofeinem citrón'   where nazev = 'Carnitine activity drink with caffeine - citrón';

-- jogurty
update public.foods set nazev = 'Řecký jogurt 2 %'                      where nazev = 'Greek Yogurt 2%';
update public.foods set nazev = 'Jogurt vanilkový plnotučný'            where nazev = 'Yogurt intero alla vaniglia';
update public.foods set nazev = 'Jogurtový drink jahoda-máta'           where nazev = 'Yoghurt drink - Strawberry-mint';
update public.foods set nazev = 'Jogurtový drink mango-ananas'          where nazev = 'Yoghurt drink mango-pineapple';
update public.foods set nazev = 'Jogurt cookie dough'                   where nazev = 'Cookie Dough yogurt';
update public.foods set nazev = 'Siggi''s rostlinný kokosový jogurt'    where nazev = 'Siggi’s plant based coconut blend yogurt';
update public.foods set nazev = 'Pečený jogurt s bylinkami'             where nazev = 'Oven baked yogurt with herbs';
update public.foods set nazev = 'Jogurt bez tuku'                       where nazev = '4 cholesterol lowering fat free yogurts';
update public.foods set nazev = 'Bílý jogurt natural'                   where nazev = 'Yogurt Plain';
update public.foods set nazev = 'Řecký jogurt natural'                  where nazev = 'Greek yogurt';
update public.foods set nazev = 'Bílý jogurt (natur)'                   where nazev = 'Natural Yogur';
update public.foods set nazev = 'Kokosový jogurt natural'               where nazev = 'kokos naturalny';

-- omáčky
update public.foods set nazev = 'Omáčka sweet & sour'                   where nazev = 'Sweet & Sour Sauce';
update public.foods set nazev = 'Smetanová česneková omáčka'            where nazev = 'Creamy Garlic Sauce';
update public.foods set nazev = 'Sladká chilli omáčka'                  where nazev = 'Sweet chilli sauce';
update public.foods set nazev = 'Sladká chilli omáčka (Healthy Boy)'    where nazev = 'Sweet chilli sauce (Healthy boy)';
update public.foods set nazev = 'Sriracha omáčka'                       where nazev = 'Sriracha chilli sauce';
update public.foods set nazev = 'HuligaN pretzel crush medová hořčice'  where nazev = 'Honey Mustard Sauce HuligaN Pretzel CRUSH';
update public.foods set nazev = 'Hořčicová omáčka'                      where nazev = 'Mustard sauce';
update public.foods set nazev = 'Česneková omáčka'                      where nazev = 'Garlic Sauce';
update public.foods set nazev = 'Veganská omáčka'                       where nazev = 'Vegan Sauce';
update public.foods set nazev = 'Sójová omáčka (Kinzan)'                where nazev = 'Soy Sauce (Kinzan)';
update public.foods set nazev = 'Tmavá sójová omáčka'                   where nazev = 'Dark Soy Sauce';
update public.foods set nazev = 'Tmavá sójová omáčka Superior'          where nazev = 'Superior Dark Soy Sauce';
update public.foods set nazev = 'Sójová omáčka ramen'                   where nazev = 'Soy Sauce Ramen';
update public.foods set nazev = 'Rajčatová omáčka Classic'              where nazev = 'Tomato sauce Classic';
update public.foods set nazev = 'Omáčka na těstoviny'                   where nazev = 'PASTASAUCE';
update public.foods set nazev = 'Těstovinová omáčka basilico'           where nazev = 'Pasta sauce basilico';
update public.foods set nazev = 'Těstovinová omáčka rajče-ricotta'      where nazev = 'Tomato & Ricota Pasta Sauce';
update public.foods set nazev = 'Omáčka rogan josh'                     where nazev = 'Rogan Josh cooking sauce';
update public.foods set nazev = 'Papriková omáčka balkánská'            where nazev = 'Paprika Sauce Balkan-Art';
update public.foods set nazev = 'Smetanová kari omáčka'                 where nazev = 'Cremige Curry Sauce';
update public.foods set nazev = 'Kari omáčka thajská'                   where nazev = 'Curry Sauce thailändische Art';
update public.foods set nazev = 'Omáčka panang'                         where nazev = 'Pangang sauce';
update public.foods set nazev = 'Barbecue omáčka'                       where nazev = 'Barbeque Sauce';
update public.foods set nazev = 'Omáčka Caesar Réal'                    where nazev = 'Sauce césar Réal';
update public.foods set nazev = 'Wok omáčka Indonésie'                  where nazev = 'Wok Sauce Indonésie';
update public.foods set nazev = 'Sýrová omáčka Squeezy'                 where nazev = 'Squeezy Cheeze Sauce';
update public.foods set nazev = 'Bio rajčatová omáčka napolitaine'      where nazev = 'Sauce tomate bio à la napolitaine';
update public.foods set nazev = 'Ústřicová omáčka'                      where nazev = 'Oyster Sauce';
update public.foods set nazev = 'Luštěniny v omáčce Légumio'            where nazev = 'Légumio in sauce';
update public.foods set nazev = 'Luštěniny v omáčce (Bonduelle)'        where nazev = 'Légumio in sauce (Bonduelle)';
update public.foods set nazev = 'Beanz fazole v rajčatové omáčce'       where nazev = 'Beanz in a rich tomato sauce';
update public.foods set nazev = 'Matjes filety se syltskou omáčkou'     where nazev = 'Matjesfilets nach nordirischer Art mit Sauce nach Sylter Art';
update public.foods set nazev = 'Gran Mare sleďové filety v rajčatové omáčce' where nazev = 'Gran Mare Herring fillets In Tomato Sauce';

-- pomazánky
update public.foods set nazev = 'Kakaovo-lískooříšková pomazánka'       where nazev = 'Cocoa-hazelnut spread';
update public.foods set nazev = 'Tvarohová pomazánka'                   where nazev = 'Curd spread';
update public.foods set nazev = 'Kakaová pomazánka'                     where nazev = 'Cocoa spread';
update public.foods set nazev = 'Pomerančová ovocná pomazánka'          where nazev = 'Seville Orange fruit spread';
update public.foods set nazev = 'Lískooříšková čokoládová pomazánka hladká' where nazev = 'Smooth Hazelnut Chocolate Spread';
update public.foods set nazev = 'Lískooříšková čokoládová pomazánka'    where nazev = 'Hazelnut chocolate spread';
update public.foods set nazev = 'Nussano lískooříšková pomazánka'       where nazev = 'Nussano, hazelnut chocolate spread';
update public.foods set nazev = 'Pomerančovo-bezová pomazánka'          where nazev = 'Orange and elderflower spread';
update public.foods set nazev = 'Bio zeleninová pomazánka paprika-kešu' where nazev = 'Organic vegetable spread paprika-cashew';
update public.foods set nazev = 'Plant Chef mexická pomazánka'          where nazev = 'Plant Chef Mexican Style Spread';
update public.foods set nazev = 'K-take it veggie rajčatovo-bazalková pomazánka' where nazev = 'K-take it veggie Organic Bread Spread Tomato Basil 180g';
update public.foods set nazev = 'Rostlinná pomazánka česnek a bylinky'  where nazev = 'Plant based spread garlic & herbs';
update public.foods set nazev = 'Probiotická smetanová pomazánka'       where nazev = 'Probiotic cream cheese spread';
update public.foods set nazev = 'Kokosová pomazánka'                    where nazev = 'Cocospread';
update public.foods set nazev = 'Lososová pomazánka'                    where nazev = 'Salmon spread';
update public.foods set nazev = 'Losos v hořčicové omáčce'              where nazev = 'salmon in mustard sauce';

-- konzervy a ostatní
update public.foods set nazev = 'Kukuřice konzervovaná'                 where nazev = 'Sweetcorn in brine';
update public.foods set nazev = 'Černé fazole konzervované'             where nazev = 'Black Beans in Brine';
update public.foods set nazev = 'Rižské uzené šproty v oleji'           where nazev = 'Riga Smoked Sprats In Oil';
update public.foods set nazev = 'Mature White Cheddar'                  where nazev = 'Mature Whte Cheddar';
update public.foods set nazev = 'Milk Break kakaový snack'              where nazev = 'Milk break cocoa snack';
update public.foods set nazev = 'Jogurt bílý (naturalny)'               where nazev = 'Jogurt naturalny';
update public.foods set nazev = 'Mléko plnotučné (SK)'                  where nazev = 'Mlieko Plnotučné';

commit;
