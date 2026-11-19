-- ============================================================
-- 0043: oprava dietních flagů z 0041 (příliš široké regexy)
-- ------------------------------------------------------------
-- '..o.k' (čočka) sedělo na 'ábovk' → Bábovka, 'dolek' → Vdolek,
-- 'ánočk' → Vánočka, 'skonk' → Laskonka, 'inovka' → salámy.
-- 'm.k' (mák) na 'omáčk'/'makový'. 'm.ta' (máta) na 'smetana'.
-- 's.l' (sůl) na 'salám'. 'zel.' na 'zelňačka'.
-- ============================================================

-- masité pokrmy a uzeniny: žádná dieta
update public.foods set diety = '{}'::text[]
 where zdroj = 'seed-cz'
   and nazev in ('Pařížský salám','Polský salám','Salám gothajský',
     'Salám herkules','Salám junior','Salám lovecký','Salám turistický',
     'Salám vysočina','Svíčková na smetaně','Zelňačka','Medovina');

-- mléčné výrobky a pečivo s vejci/mlékem: vegetarian (ne vegan)
update public.foods set diety = '{vegetariansky}'::text[]
 where zdroj = 'seed-cz'
   and nazev in ('Bábovka','Vánočka','Laskonka','Koláč makový',
     'Koláč povidlový','Vdolek','Šišky s mákem','Škubánky s mákem',
     'Koprová omáčka','Smetana do kávy 12 %','Smetana ke šlehání 31 %',
     'Zakysaná smetana 16 %');
