-- ============================================================
-- 0040: oprava cenových dat + sanity limity + defaultní běžné ceny
-- ------------------------------------------------------------
-- Audit (scripts/over_ceny.mjs) našel:
--   a) 230× puvodni_cena < cena (špatně dopočtená "přeškrtnutá" cena)
--   b) pozorování mimo reálné meze (Kuličky 796 Kč, Cherry 999 Kč/100 g)
--   c) ~5 996 potravin bez jakékoli ceny (bezna_cena = 0)
--
-- Všechny ceny jsou Kč / 100 g (aktualni_ceny.cena i foods.bezna_cena).
-- ============================================================

-- a) přeškrtnutá cena nižší než akční je nesmysl → smažeme ji,
--    samotná sleva (cena + %) zůstane
update public.price_observations
   set puvodni_cena = null
 where puvodni_cena is not null
   and puvodni_cena < cena;

-- b) pozorování mimo reálné meze Kč/100 g = parse chyby;
--    potravina převezme bezna_cena (nebo další validní pozorování)
delete from public.price_observations
 where cena <= 0 or cena >= 400;

-- c) pojistky do budoucna (scraper má vlastní filtr v db.py)
alter table public.price_observations
  add constraint price_observations_cena_rozumna
    check (cena > 0 and cena < 400),
  add constraint price_observations_puvodni_vetsi
    check (puvodni_cena is null or puvodni_cena >= cena);

-- d) běžná cena pro potraviny, které žádnou nemají (dosud 0 → UI "–").
--    Hodnoty jsou odhady české maloobchodní úrovně podle názvu/kategorie;
--    jakékoli reálné pozorování z letáku je v aktualni_ceny přebije.
update public.foods set bezna_cena = coalesce(
  case
    when nazev ~* 'voda|miner.l|pod.brad|mattoni|ondrasov|n.poj|cola|fanta|sprite|d.jus|juice|limon.d|sirup|kofola|malinov|tonic|tonik|energy|powerade' then 2.5
    when nazev ~* 'cukr' then 2.2
    when nazev ~* 'mouka|.krob|solamyl|pudink|puding' then 1.6
    when nazev ~* 'olej' then 13.0
    when nazev ~* 'm.slo|butter' then 65.0
    when nazev ~* 'k.va|kapsle|espresso|coffee|instantn' then 55.0
    when nazev ~* '.okol.d|chocolate|kakao|pralin|nougat|nugat' then 32.0
    when nazev ~* 'eidam|hermel.n|mozzarell|parmesan|parmaz.n|cheddar|niva|gorgonzol|emmental|camembert|balk.nsk|bryndz|feta|s.yr|grana' then 38.0
    when nazev ~* 'tvaroh|jogurt|joghurt|kef.r|smetan|zakysan|podm.sl|pribin.cek|termix|quark|ricott|mascarpone|lip.nek|zerv.' then 14.0
    when nazev ~* 'sal.m|.unka|ham |uzen|p.rek|p.rky|klob.s|pa.tik|paštik|slanin|bacon|serano|prosciutt|prejt|tla.enk|jelito|.kvark|vir.l|spek.c|spek..k|utopenc|vir.l' then 28.0
    when nazev ~* 'kr.ta|kr.t|ku.e|kura|chicken|dr.be.|kachn|kr.l.k' then 17.0
    when nazev ~* 'hov.z|beef|sv.ckov|steak|telec|veal|rost.nec|rost.nec' then 32.0
    when nazev ~* 'vep.|pork|kotlet|krkovic|krkovi|b.ek|pe.en|kotleta|k.tlet' then 18.0
    when nazev ~* 'ryba|tu..k|losos|ryby|ryb.|fish|sardink|makrel|kapr|pstruh|filet|tilapi|sardel|hering|sle.|pangas|okoun|mo.sk|krevet' then 28.0
    when nazev ~* 't.stovin|pasta|spaghett|penne|nudl|lasagn|fusilli|kolink|vrtul|makaron|tarho' then 6.0
    when nazev ~* 'r.z|rice|ryz|basmati|arborio|ri.ot|kuskus|bulgur|pohank|quino|krup|amarant' then 5.0
    when nazev ~* 'fazol|hrach|hr.ch|..o.k|cizrn|chickpea|mungo|lentil|bean' then 9.0
    when nazev ~* 'chips|lup.nk|ty.ink|kreks|crack|snack|slan.|pistacie|mandle|migdal|o..sk|kesu|ara..d|bur.k|vla.sk|pekan|sezam|chia|ln.n|slune.nic|dýňov|dynov|k.nopn' then 45.0
    when nazev ~* 'kol..|dort|buchta|z.vin|strudl|tort|cake|croissant|b.bovka|v.no.k|mazanec|trubic|koblih|vdolek|indi.nek|v.trn|medovn|laskonk|mars |snickers|bounty|kit kat|twix|bonbon|su.enk|pi.kot|wafel|oplatk|tatrank|horalk' then 30.0
    when nazev ~* 'chleb|rohl|housk|peciv|pe.iv|baget|veka|toast|brio|dalam.n|knedl|lango|pizz|tortill' then 5.0
    when nazev ~* 'pivo|beer|vino|v.no|wine|sekt|prosecco|birell|radler|frizzant' then 4.0
    when nazev ~* '.aj |tea |matcha' then 35.0
    when nazev ~* 'ke.up|ketchup|ho..ic|mustard|majonez|tatar|remulad|ocet|vegeta|ko.en.|sul|s.l |pep.|om.ck|sauce|sojov|soy|worcester|chili|tabasco' then 15.0
    when nazev ~* 'marmel.d|povidl|med |medov.|honey|kompot|zel.|zelí|okurk|.alam.d' then 15.0
    else null
  end,
  case kategorie
    when 'maso_ryby' then 22.0
    when 'mlecne_vyrobky' then 16.0
    when 'ovoce_zelenina' then 5.5
    when 'peckoviny_obily' then 4.5
    when 'suchary_testoviny' then 13.0
    else 16.0
  end
)
where bezna_cena <= 0;
