-- ============================================================
-- SEED: RECEPTY (v1)
-- ------------------------------------------------------------
-- 9 českých receptů složených výhradně z katalogu potravin v1
-- (22 potravin). Gramáže jsou na 1 porci. Ceny se neukládají –
-- počítají se živě z view aktualni_ceny, takže recept odráží
-- aktuální slevy. Provenance: zdroj = 'seed-v1'.
-- ============================================================

-- ---- 1. Ovesná kaše s banánem ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000001', null,
  'Ovesná kaše s banánem',
  'Rychlá a sytá snídaně – pomalé sacharidy, draslík a bílkoviny z mléka.',
  'snidane', 1, 10,
  E'Mléko přiveďte k varu, přisypte ovesné vločky a na mírném ohni vařte 5 minut.\nKaši odstavte, přikryjte a nechte 2 minutu dosednout.\nNakrájený banán vmíchejte a podávejte.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000001', f.id, v.gramy, v.pozn
from (values
  ('Ovesné vločky', 60.0, null::text),
  ('Mléko čerstvé', 250.0, null::text),
  ('Banán', 100.0, 'nakrájený')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 2. Jogurtová mísa s ovocem a vločkami ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000002', null,
  'Jogurtová mísa s ovocem a vločkami',
  'Studená snídaně nebo svačina bez vaření – bílkoviny, vláknina, 5 minut práce.',
  'snidane', 1, 5,
  E'Jogurt naložte do misky.\nVločky a na plátky nakrájené jablko vmíchejte.\nOkamžitě podávejte.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000002', f.id, v.gramy, v.pozn
from (values
  ('Jogurt bílý 3,5%', 250.0, null::text),
  ('Ovesné vločky', 40.0, null::text),
  ('Jablko', 100.0, 'na plátky')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 3. Vajíčková pomazánka na celozrnném chlebu ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000003', null,
  'Vajíčková pomazánka na celozrnném chlebu',
  'Bílkovinová svačina – tvaroh místo majonézy, takže méně tuku a více bílkovin.',
  'svacina', 2, 15,
  E'Vejce uvařte natvrdo (9 minut), ochlaďte a oloupejte.\nS tvarohem je rozmačkejte vidličkou, osolte a opepřete.\nPomazánku naneste na plátky chleba.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000003', f.id, v.gramy, v.pozn
from (values
  ('Vejce', 100.0, '2 ks, natvrdo'),
  ('Tvaroh polotučný', 50.0, null::text),
  ('Chléb celozrnný', 120.0, 'na plátky')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 4. Kuřecí prsa s basmati rýží ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000004', null,
  'Kuřecí prsa s basmati rýží',
  'Klasika pro růst svalů – nejvyšší podíl bílkovin na korunu v celém jídelníčku.',
  'hlavni', 2, 35,
  E'Rýži propláchněte a vařte podle návodu (cca 15 minut).\nKuřecí prsa osolte, opepřete a opékejte na pánvi 6–8 minut z každé strany.\nPodávejte s rýží, na vršek kuřete můžete přidat plátek citronu.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000004', f.id, v.gramy, v.pozn
from (values
  ('Kuřecí prsa', 150.0, null::text),
  ('Rýže basmati', 80.0, 'vařená hmotnost surové')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 5. Čočková polévka ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000005', null,
  'Čočková polévka',
  'Levná a vydatná polévka – rostlinné bílkoviny a pomalé sacharidy v jednom hrnci.',
  'polevka', 4, 40,
  E'Čočku propláchněte, brambory oloupejte a nakrájejte na kostky.\nDo vroucí vody (1,5 l) přidejte čočku a brambory, vařte 25 minut.\nČást polévky rozmixujte pro zahuštění, osolte, opepřete a podávejte.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000005', f.id, v.gramy, v.pozn
from (values
  ('Čočka červená', 60.0, null::text),
  ('Brambory', 100.0, 'na kostky')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 6. Losos s brambory ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000006', null,
  'Losos s brambory',
  'Omega-3 mastné kyseliny a vyvážený poměr makroživin – peče se na jednom plechu.',
  'hlavni', 2, 30,
  E'Brambory oloupejte, nakrájejte na půlky a nechte je 20 minut vařit v osolené vodě.\nLosos osolte a opékejte po 3–4 minutách z každé strany na pánvi.\nPodávejte spolu, brambory můžete prohřát na pánvi po lososovi.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000006', f.id, v.gramy, v.pozn
from (values
  ('Losos', 150.0, 'filet'),
  ('Brambory', 300.0, null::text)
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 7. Těstoviny s tvarohem ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000007', null,
  'Těstoviny s tvarohem',
  'Student zlatý střed: levné, rychlé a dostatek bílkovin. Méně tuku než sýrové omáčky.',
  'hlavni', 2, 20,
  E'Těstoviny vařte podle návodu do al dente.\nTvaroh rozšlehejte s trochou vody od těstovin do krémové konzistence.\nTěstoviny smíchejte s tvarohem, osolte, opepřete a podávejte.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000007', f.id, v.gramy, v.pozn
from (values
  ('Těstoviny celozrnné', 100.0, null::text),
  ('Tvaroh polotučný', 100.0, null::text)
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 8. Hovězí svíčková s pohankou ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000008', null,
  'Hovězí svíčková s pohankou',
  'Železo, zinek a plnohodnotné bílkoviny – pohanka je místo rýže s nižším glykemickým indexem.',
  'hlavni', 2, 40,
  E'Pohanku propláchněte a vařte 15 minut v dvojnásobném objemu vody.\nSvíčkovou osolte, opepřete a rychle opékejte 3–4 minuty z každé strany.\nNechte maso 5 minut odpočinout, pak nakrájejte a podávejte s pohankou.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000008', f.id, v.gramy, v.pozn
from (values
  ('Hovězí svíčková', 150.0, null::text),
  ('Pohanka', 80.0, null::text)
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;

-- ---- 9. Těstoviny s vejcem a parmezánem (carbonara lite) ----
insert into public.recipes (id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
values (
  '11111111-0000-0000-0000-000000000009', null,
  'Těstoviny s vejcem a parmezánem',
  'Odlehčená carbonara – bez slaniny, bílkoviny z vajec a sýra, krémová konzistence.',
  'hlavni', 2, 20,
  E'Těstoviny vařte podle návodu, 3 lžíce vody od vaření si odložte.\nVejce rozšlehejte s nastrouhaným parmezánem.\nSceděné horké těstoviny důkladně promíchejte s vejcovou směsí (mimo plamen), podle potřeby zřeďte odloženou vodou, osolte a opepřete.',
  'seed-v1'
)
on conflict (id) do nothing;

insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
select '11111111-0000-0000-0000-000000000009', f.id, v.gramy, v.pozn
from (values
  ('Těstoviny celozrnné', 100.0, null::text),
  ('Vejce', 50.0, '1 ks'),
  ('Parmigiano Reggiano', 15.0, 'nastrouhaný')
) as v(nazev, gramy, pozn)
join public.foods f on f.nazev = v.nazev
on conflict (recipe_id, food_id) do nothing;
