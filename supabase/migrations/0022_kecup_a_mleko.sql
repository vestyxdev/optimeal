-- =============================================================
-- 0022 – dolaďování kategorií + překlady mléčných výrobků
-- -------------------------------------------------------------
-- 0020 přehlédla český tvar „kečup" (regex měl jen anglické
-- „ketchup") – 39 kečupů zůstalo v ovoce_zelenina. Dále
-- kyselé cukroví s ovocnou příchutí (jahodové/malinové pásky,
-- žížalky, červi) stáhly ovocné kmeny do produce, a genitiv
-- „vloček" nemá podřetězec „vločk". Idempotentní.
-- =============================================================

begin;

-- kečup = kořenící přípravek → ostatni
update public.foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina' and nazev ~* 'ke[čc]up';

-- kyselé cukroví (žížalky, červi, pásky, duhové…) – ovocná
-- příchuť z nich neudělá ovoce
update public.foods set kategorie = 'ostatni'
where kategorie = 'ovoce_zelenina'
  and nazev ~* 'pásk|žížalk|červ[iíy]|yoyos|tutti|duhov|rybičk|pixle';

-- genitiv „vloček" (obilných vloček) neobsahuje „vločk"
update public.foods set kategorie = 'peckoviny_obily'
where nazev ~* 'vlo[čc]ek' and kategorie <> 'peckoviny_obily';

-- sterilovaná cibulka patří k zelenině, ne k pečivu
update public.foods set kategorie = 'ovoce_zelenina'
where nazev = 'Cibulka sterilovaná';

-- překlady slovenského/polského mléčného zboží
update public.foods set nazev = 'Acidofilní mléko (Mlékárna Kunín)'       where nazev = 'Acidofilni Mleko (Mlékárna Kunín)';
update public.foods set nazev = 'Bezlaktózové mléko'                       where nazev = 'Bezlaktozove mleko';
update public.foods set nazev = 'Tatranské horské bio mléko polotučné'     where nazev = 'Tatranské horské bio mlieko polotučné';
update public.foods set nazev = 'Trvanlivé mléko plnotučné'                where nazev = 'Trvanlive Mlieko plnotucne';
update public.foods set nazev = 'Máslo (Mlekovita)'                        where nazev = 'Máslo (Spółdzielnia Mleczarska MLEKOVITA)';
update public.foods set nazev = 'Zmrzlina jahodovo-malinová s makronkami',
                      kategorie = 'mlecne_vyrobky'
where nazev ~* 'Lody truskawkowo-malinowe';

commit;
