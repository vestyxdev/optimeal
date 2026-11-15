-- =============================================================
-- 0020 – oprava kategorií starých importů
-- -------------------------------------------------------------
-- Část katalogu má špatnou kategorii (typicky chléb/pečivo
-- v "ovoce_zelenina" – default starého importu). Současné
-- importní pipeline (ingest_off, import_nesparovanych) mapují
-- správně; tady opravujeme existující řádky podle kmenů názvů.
--
-- Pořadí UPDATEů rozhoduje: strukturální kategorie (pečivo,
-- těstoviny) běží POZDĚJI a přebijí substanční (ovoce, maso,
-- mléko) – „bageta se sýrem" je pečivo, „jogurt s jahodou"
-- je mléčný výrobek. Poslední krok vrátí do „ostatni" suroviny
-- a přípravky (omáčky, oleje, koření, nápoje, doplňky) – ty
-- pod žádnou z pěti reálných kategorií nepatří.
-- Idempotentní.
-- =============================================================

begin;

-- překlep v názvu (è → é) + přesun k pečivu přes kroky níže
update public.foods set nazev = 'Chléb pšeničnožitný' where nazev = 'Chlèb pšeničnožitný';

-- 1) ovoce a zelenina (+ houby) – jede první
update public.foods set kategorie = 'ovoce_zelenina'
where nazev ~* 'ban[aá]n|jablk|pomeran[čc]|citr[oó]n|mandarink|kiwi|hrozn|broskv|meru[ňn]|merunk|[šs]vest|jahod|malin|bor[ůu]v|ostružin|ryb[ií]z|angre[šs]t|grep|limet|ananas|mang|hru[šs]k|vi[šs]e[ňn]|t[řr]e[šs]|kaki|f[íi]k|kokos|brusink|brusnic|durian|li[čc]i|meloun|rajc|rajsk|okurk|paprik|paplika|cibul|cesnek|mrkev|mrkvi|petr[žz]el|celer|brokolic|kv[ěe]t[aá]k|zel[íi]|kapust|kedlubn|[řr]edkv|brambor|bat[aá]t|d[ýy][ňn]|avok[aá]d|[žz]ampion|[šs]ampion|houb|hl[íi]v|bedl|h[řr][íi]b|feferonk|rukola|[šs]pen[aá]t|p[oó]rek|patizon|lilek|koriandr|zázvor|cizrn|oliv';

-- 2) maso a ryby
update public.foods set kategorie = 'maso_ryby'
where nazev ~* 'ku[řr]ec|kr[ůu]t|hov[ěe]z|vep[řr]|kachn|hus|jehn[ěe]|telec|kr[aá]l[ií]k|bažant|zaj[íi]c|srn[čc]|[úu]zen|[šs]unk|sal[aá]m|klob[aá]s|pa[řr]ek|p[aá]rk|prosciutt|chorizo|slanin|bacon|pastrami|mlet|steak|gul[aá]š|tatarsk|kebab|tu[ňn][aá]k|losos|kapr|pstruh|sle[ďd]|makrel|sardink|tresk|tilapi|krevet|chobotnic|kalam[aá]r|mo[řr]sk|pangas|alja[šs]k|maso|meat|seitan';

-- 3) mléčné výrobky (běží po ovoci – „jogurt jahodový" zůstane mléčný)
update public.foods set kategorie = 'mlecne_vyrobky'
where nazev ~* 'ml[ée]k|jogurt|s[ýy]r|smetan|m[aá]sl|tvaroh|kef[íi]r|pudink|zmrzlin|dezert|bryndz|niva|eidam|camembert|brie|feta|gouda|cheddar|parmez[aá]n|parmigian|mozzarell|ricott|mascarpone|halloumi|quark|blu[eè]|pribin[aá][čc]|bob[íi]k|termix|actimel|danone|salko|skyr|lip[aá]nek|kondenzovan';

-- 4) suchary a těstoviny (strukturální – přebije substanci)
update public.foods set kategorie = 'suchary_testoviny'
where nazev ~* 't[ěe]stovin|spaget|penne|fusilli|nudl|kol[ií]nk|lasagn|gnocchi|raviol|tortellin|vermicell|tagliatelle|maccheroni|farfalle|su[šs]enk|pi[šs]kot|krekr|oplatk|obl[aá]tk|waf|biscuit|cracker|pretzel|grissini|pizza|tortill|wrap|knedl';

-- 5) pečivo a obiloviny (strukturální – poslední substanční výhra)
update public.foods set kategorie = 'peckoviny_obily'
where nazev ~* 'chl[ée]b|chleba|rohl[ií]k|housk|croissant|donut|koblih|kol[aá][čc]|peciv|baget|veka|toast|str[uú]dl|l[ií]vanec|bucht|bulka|toust|mazanec|v[aá]no[čc]k|plet[ýy]n|precl[ií]k|loup[aá]k|oslava|pala[čc]ink|plack|focacci|ciabatt|lok[šs]|piadina|baguette|r[ýy]že|risott|bulgur|kuskus|couscous|quino|vlo[čc]k|m[üu]sli|granola|krupic|p[šs]eno|pohank|amarant|[šs]pald|je[čc]men|tarho[ňn]|kaše|kornflejk|cornflakes|cereal|ovsen';

-- 6) suroviny a přípravky zpět do „ostatni" – omáčky, pomazánky,
--    nápoje, koření, oleje, cukry, mouky, doplňky výživy
update public.foods set kategorie = 'ostatni'
where nazev ~* 'om[aá][čc]k|sauce|pesto|pomaz[aá]nk|dresink|majonn|majolka|ho[řr][čc]ic|ketchup|sirup|džus|juice|n[aá]poj|drink|limon[aá]d|sodovk|koktejl|kolagen|vitam[ií]n|dopl[ňn][ěe]k|probiot|ko[řr]en|ocet|olej|s[aá]dl|mouk|cukr|bouillon|bu[ďd]on|buj[oó]n|v[ýy]var|whey|bcaa|carnitin|kreatin|energetick|isotonick|k[aá]v|[čc]aj\b|s[ůu]l\b';

commit;
