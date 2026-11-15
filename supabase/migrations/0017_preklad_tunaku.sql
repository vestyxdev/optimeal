-- =============================================================
-- 0017 – překlad anglických tuňákových položek (OFF importy)
-- -------------------------------------------------------------
-- Katalog obsahoval 17 anglických tuňákových řádků z OpenFoodFacts
-- (TUNA in brine, Tuna Chucks in tomato sause, …). V českém
-- katalogu působí neprofesionálně a letákový matcher české nabídky
-- na „tuňák" stejně nespáruje.
--
-- Každý nový název nechává token „tuna" v závorce – nabídky, které
-- dosud seděly na anglická slova (Billa nabízí doslova
-- „tuna steak"), se i po přejmenování spárují tokenovou podmnožinou.
-- Idempotentní – opakovaný běh nic nezmění.
-- =============================================================

begin;

update public.foods set nazev = 'Tuňákový steak (tuna)'                          where nazev = 'tuna steak';
update public.foods set nazev = 'Tuňákový steak ve vlastní šťávě (tuna)'         where nazev = 'Tuna steak in brine';
update public.foods set nazev = 'Tuňákový steak v slunečnicovém oleji (tuna)'    where nazev = 'tuna steak in sunflower oil';
update public.foods set nazev = 'Tuňákové steaky v rostlinném oleji (tuna)'      where nazev = 'Tuna steaks in vegetable oil and brine';
update public.foods set nazev = 'Tuňákový steak uzený v slunečnicovém oleji (tuna)' where nazev = 'Tuna steak smoked flavour, sunflower oil';
update public.foods set nazev = 'Tuňák ve vlastní šťávě (tuna)'                  where nazev = 'TUNA in brine';
update public.foods set nazev = 'Tuňák ve vlastní šťávě (Kitchin)'               where nazev = 'Tuna in brine (KITCHIN)';
update public.foods set nazev = 'Tuňákové filety ve vlastní šťávě (tuna)'        where nazev = 'Tuna Fillets in Brine';
update public.foods set nazev = 'Tuňákové vločky ve vlastní šťávě (tuna)'        where nazev = 'Tuna flakes in brine';
update public.foods set nazev = 'Tuňákový filet v olivovém oleji (tuna)'         where nazev = 'TUNA FILET in olive oil';
update public.foods set nazev = 'Tuňák v panenském olivovém oleji (tuna)'        where nazev = 'TUNA in Extra Virgin Olive Oil';
update public.foods set nazev = 'Tuňákové kousky v rajčatové omáčce (tuna)'      where nazev = 'Tuna Chucks in tomato sause';
update public.foods set nazev = 'Tuňák v pikantním oleji (tuna)'                 where nazev = 'Tuna in spicy oil';
update public.foods set nazev = 'Pikantní divoký tuňák (tuna)'                   where nazev = 'Spicy Wild Tuna';
update public.foods set nazev = 'Tuňák al naturale'                              where nazev = 'Tuna Al Naturale';
update public.foods set nazev = 'Tuňáková pomazánka (tuna)'                      where nazev = 'Tuna spread';
update public.foods set nazev = 'Rybačí paštika tuňák s chilli'                  where nazev = 'Paté Fish Spread Tuna and Hot Chilli Pepper';

commit;
