-- =============================================================
-- 0021 – překlad cyrilice + obecné/zkrácené názvy + entity
-- -------------------------------------------------------------
-- Zbývající rusky/ukrajinsky/bulharsky/řecky psané názvy z OFF
-- importů + názvy, kde OFF ukládá jen variantu („Original",
-- „Fruit") a skutečný produkt poznáme z EAN + brand.
-- + oprava HTML entit (&quot;) a kategorií u opravených řádků.
-- Idempotentní.
-- =============================================================

begin;

-- ── cyrilice / řečtina → čeština ──────────────────────────────
update public.foods set nazev = 'Pomerančový džus 100% z koncentrátu'            where nazev = '100% сок от портокал от концентрат';
update public.foods set nazev = 'Proteinová tyčinka Monsters s jahodovou polevou' where nazev = 'Батончик протеїновий глазурований кондитерською глазур''ю з полуницею Monsters';
update public.foods set nazev = 'Bio konopná mouka'                              where nazev = 'Био брашно от коноп';
update public.foods set nazev = 'Rahat lokum jahodové'                           where nazev = 'Локум Сладки Времена Вкус Ягода';
update public.foods set nazev = 'Těstoviny spirály'                              where nazev = 'макаронные изделия spiraline макароны паста';
update public.foods set nazev = 'Mozzarella XXL'                                 where nazev = 'Моцарела XXL';
update public.foods set nazev = 'Nestea mango'                                   where nazev = 'нестий манго кен 8627';
update public.foods set nazev = 'Pečené chlebové kroužky houba-smetana'          where nazev = 'Печени хлебни кръгчета с вкус на гъби и сметана';
update public.foods set nazev = 'Lovita Classic sušenky s polevou'               where nazev = 'Печиво здобне з кусочками глазурі Lovita Classic Cookies';
update public.foods set nazev = 'Proteinová sušenka čokoládový brownie'          where nazev = 'Протеиновое печенье &quot;Шоколадный брауни&quot;';
update public.foods set nazev = 'Slané tyčinky máslo-sýr'                        where nazev = 'Соленки с масло и сирене';
update public.foods set nazev = 'Sýr eidam 45%'                                  where nazev = 'Сыр эдам 45';
update public.foods set nazev = 'Vafl dortíčky Hyper kakao-arašídy'              where nazev = 'Тунквани вафлени торти Хипер с какао и фъстъци';
update public.foods set nazev = 'Arašídy, pražené a solené'                      where nazev = 'Фъстъци, печени и осолени';
update public.foods set nazev = 'Psyllium vláknina (Dragon Superfoods)'          where nazev = 'Хуск фибри';
update public.foods set nazev = 'Třešně (čereshi)'                               where nazev = 'Череши';
update public.foods set nazev = 'Šproty v oleji (šprot)'                         where nazev = 'Шпроты в масле';
update public.foods set nazev = 'Feta sýr (φέτα)'                                where nazev = 'φέτα';

-- ── obecné názvy → produkt podle EAN/brandu ───────────────────
update public.foods set nazev = 'Zlatý Bažant 12%'        where nazev = '12%';
update public.foods set nazev = 'Nestlé Bros'             where nazev = 'Bros';
update public.foods set nazev = 'Kinder Chocolate'        where nazev = 'Chocolate';
update public.foods set nazev = 'Hera Classic'            where nazev = 'Classic';
update public.foods set nazev = 'Monster Energy Original' where nazev = 'energy';
update public.foods set nazev = 'Fit Fruit'               where nazev = 'Fruit';
update public.foods set nazev = 'Orion Koko'              where nazev = 'koko';
update public.foods set nazev = 'Leerdammer Original'     where nazev = 'Original';
update public.foods set nazev = 'Coca-Cola Vanilla'       where nazev = 'Vanilla';
update public.foods set nazev = 'Tuňák (Thon)'            where nazev = 'Thon';
update public.foods set nazev = 'Rýže (Riz)'              where nazev = 'Riz';

-- ── HTML entity ───────────────────────────────────────────────
update public.foods set nazev = 'Želé Maliny'             where nazev = 'Želé &quot;Maliny&quot;';

-- ── kategorie opravených řádků (0020 běžela před překladem) ───
update public.foods set kategorie = 'suchary_testoviny' where nazev in
  ('Těstoviny spirály', 'Vafl dortíčky Hyper kakao-arašídy', 'Nestlé Bros');
update public.foods set kategorie = 'peckoviny_obily'   where nazev = 'Rýže (Riz)';
update public.foods set kategorie = 'ostatni'           where nazev in
  ('Psyllium vláknina (Dragon Superfoods)', 'Bio konopná mouka', 'Zlatý Bažant 12%', 'Monster Energy Original', 'Coca-Cola Vanilla', 'Kinder Chocolate', 'Orion Koko', 'Rahat lokum jahodové', 'Želé Maliny');
update public.foods set kategorie = 'mlecne_vyrobky'    where nazev in
  ('Hera Classic', 'Mozzarella XXL', 'Sýr eidam 45%', 'Feta sýr (φέτα)', 'Leerdammer Original');
update public.foods set kategorie = 'peckoviny_obily'   where nazev = 'Pečené chlebové kroužky houba-smetana';
update public.foods set kategorie = 'maso_ryby'         where nazev in ('Tuňák (Thon)', 'Šproty v oleji (šprot)');

commit;
