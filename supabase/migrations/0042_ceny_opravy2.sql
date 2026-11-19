-- ============================================================
-- 0042: oprava běžných cen zasažených příliš širokými regexy 0040
-- ------------------------------------------------------------
-- Vzor 'r..' (měl být "rýže/rice") sedí na 'rbo' v "caRBOnara",
-- 'rze' v "wuRZEL", 'rra' v "cuRRy" apod. → maso_ryby/mléčné
-- položky dostaly 5 Kč/100 g místo výchozí hodnoty kategorie.
-- Podmínka původu: opravujeme jen hodnoty přesně 5.00, které
-- předtím byly 0 (seed/kurátorské ceny migrace nezasáhla).
-- ============================================================

update public.foods set bezna_cena = 22.0
 where kategorie = 'maso_ryby' and bezna_cena = 5.0
   and nazev !~* 'r.z|rice|ryz|basmati|arborio|ri.ot';

update public.foods set bezna_cena = 16.0
 where kategorie = 'mlecne_vyrobky' and bezna_cena = 5.0
   and nazev !~* 'r.z|rice|ryz|basmati|arborio|ri.ot';

update public.foods set bezna_cena = 5.5
 where kategorie = 'ovoce_zelenina' and bezna_cena = 5.0
   and nazev !~* 'chleb|rohl|housk|peciv|pe.iv|baget|veka|toast|brio|dalam.n|knedl|lango|pizz|tortill|r.z|rice|ryz|basmati';

update public.foods set bezna_cena = 13.0
 where kategorie = 'suchary_testoviny' and bezna_cena = 5.0
   and nazev !~* 'chleb|rohl|housk|peciv|pe.iv|baget|veka|toast|brio|dalam.n|knedl|lango|pizz|tortill|r.z|rice|ryz|basmati|t.stovin|pasta|spaghett|penne|nudl|lasagn|fusilli|kolink|vrtul|makaron|tarho|kuskus|bulgur|pohank|quino|krup|amarant';
