-- =============================================================
-- 0018 – deduplikace + překlad cyrilických OFF importů
-- -------------------------------------------------------------
-- Analýza katalogu (normalizace diakritiky/interpunce) našla
-- jediný skutečný duplicit: „Řecký jogurt - čokoláda" vs.
-- „Řecký jogurt čokoláda" (84 kcal oba). Varianty mléka/tvarohu
-- slučovat NEJDEME – jde o různé produkty/brandové varianty
-- (Clever × Pilos × Boni sedí na různé letáky).
--
-- Merge přemapovává všechny FK odkazy: recipe_ingredients
-- (unique recipe_id+food_id → nejdřív kolize smazat),
-- price_observations (unique food_id+retailer_id+pozorovano_at
-- → nejdřív kolize smazat), shopping_list_items (set null →
-- přemapovat, aby položky neztratily vazbu).
-- =============================================================

begin;

-- a) skutečný duplicit – sloučit do „Řecký jogurt čokoláda"
do $$
declare
  drop_id uuid;
  keep_id uuid;
begin
  select id into drop_id from public.foods where nazev = 'Řecký jogurt - čokoláda';
  select id into keep_id from public.foods where nazev = 'Řecký jogurt čokoláda';
  if drop_id is null or keep_id is null then
    return; -- už sloučeno / řádek neexistuje
  end if;

  delete from public.recipe_ingredients ri
    where ri.food_id = drop_id
      and exists (
        select 1 from public.recipe_ingredients x
         where x.recipe_id = ri.recipe_id and x.food_id = keep_id
      );
  update public.recipe_ingredients set food_id = keep_id where food_id = drop_id;

  delete from public.price_observations po
    where po.food_id = drop_id
      and exists (
        select 1 from public.price_observations x
         where x.food_id = keep_id
           and x.retailer_id = po.retailer_id
           and x.pozorovano_at = po.pozorovano_at
      );
  update public.price_observations set food_id = keep_id where food_id = drop_id;

  update public.shopping_list_items set food_id = keep_id where food_id = drop_id;

  delete from public.foods where id = drop_id;
end $$;

-- b) cyrilické OFF importy → české názvy
update public.foods set nazev = 'Omáčka bolognese'        where nazev = 'Сос Болонезе';
update public.foods set nazev = 'Chipsy smetana a cibule' where nazev = 'Сметана та цибуля';
update public.foods set nazev = 'Gorgonzola (ZNP)'        where nazev = 'Горгонзола ЗНП';

commit;
