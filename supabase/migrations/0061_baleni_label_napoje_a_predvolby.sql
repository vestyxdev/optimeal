-- 0061: baleni_label + kategorie 'napoje' + 100% pokrytí gramáže balení
--       + uživatelské předvolby (oblíbené obchody, výchozí jednotka deníku)
--       + rozšíření cílů o vodu/vlákninu

-- 1) kategorie 'napoje' – check constraint nesmí nové nápoje odmítnout
alter table public.foods drop constraint if exists foods_kategorie_check;
alter table public.foods add constraint foods_kategorie_check check (
  kategorie in ('maso_ryby', 'mlecne_vyrobky', 'ovoce_zelenina',
                'peckoviny_obily', 'suchary_testoviny', 'napoje', 'ostatni')
);

-- 2) popisek balení pro UI („Balení" | „Plechovka" | „Láhev" | „Kelímek" | „Kus" | „Sáček" | „Krabice")
alter table public.foods
  add column if not exists baleni_label text check (
    baleni_label in ('Balení', 'Plechovka', 'Láhev', 'Kelímek', 'Kus', 'Sáček', 'Krabice')
  );

-- 3) kusové položky – baleni_g = typická hmotnost kusu, label = Kus
update public.foods set baleni_g = 60,  baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(^|[^a-zá-ž])(vejce|vajíčk|vajeck|bílek|žloutek)';
update public.foods set baleni_g = 43,  baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(rohlík|rohlik|housk|žeml|zeml|bul(ka|ky)|dalamánek|dalamanek|inženýr|inzinyr|kaiserk)';
update public.foods set baleni_g = 125, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ 'banán|banan( |$)';
update public.foods set baleni_g = 180, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(^|[^a-zá-ž])(jablko|jablka|jablčn)';
update public.foods set baleni_g = 150, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(pomeranč|pomeranc|mandarink|broskev|meruňk|merunk|nektarink|sliv|švestk|svestk)';
update public.foods set baleni_g = 170, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ 'hrušk|hrusk';
update public.foods set baleni_g = 75,  baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(^|[^a-zá-ž])(kiwi)';
update public.foods set baleni_g = 200, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(avokád|avokad|paprik|brambor( |$)|meloun)';
update public.foods set baleni_g = 120, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(rajče|rajce|rajčat|rajc[ae]|paradajk)';
update public.foods set baleni_g = 100, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(cibul|mrkev|mrkv|citr[oó]n|limetk|petržel|petrzel|celer( |$))';
update public.foods set baleni_g = 300, baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(okurk|salát hlávkov|hlávkov|iceberg)';
update public.foods set baleni_g = 60,  baleni_label = 'Kus'
 where baleni_g is null and lower(nazev) ~ '(tyčink|tyčinka|\bbar\b|energy|protein bar|raw)';

-- 4) balené potraviny – typické české retail gramáže + labely
update public.foods set baleni_g = 150,  baleni_label = 'Kelímek'
 where baleni_g is null and lower(nazev) ~ '(jogurt|jogurtov|pudink|puding|pomazánk|pomazank|tvaroh(?!.*vanilk)|krém dessert|krem dessert|monte( |$)|raf|křupav|skyr)';
update public.foods set baleni_g = 250,  baleni_label = 'Balení'
 where baleni_g is null and lower(nazev) ~ '(tvaroh|máslo|maslo|margarín|margarin|niva|hermelín|hermelin|camembert|sýr na smažení|pařížský salát|parizsk)';
update public.foods set baleni_g = 1000, baleni_label = 'Krabice'
 where baleni_g is null and lower(nazev) ~ '(mléko|mleko|mléčný nápoj|džus|dzus|juice|nektar|ice tea|ledový čaj|ledovy caj)';
update public.foods set baleni_g = 250,  baleni_label = 'Krabice'
 where baleni_g is null and lower(nazev) ~ '(smetana|zakysan|smetanov)';
update public.foods set baleni_g = 500,  baleni_label = 'Kelímek'
 where baleni_g is null and lower(nazev) ~ '(kefir|kefír|acidofil)';
update public.foods set baleni_g = 150,  baleni_label = 'Balení'
 where baleni_g is null and lower(nazev) ~ '(eidam|gouda|emmental|balkánsk|balkansk|mozzarell|sýr|syr( |$)|hermelín|uzený sýr|párky|parek|salám|salam|šunk|sunk|uzenin|předkrm|slanina|klobás|klobas)';
update public.foods set baleni_g = 500,  baleni_label = 'Balení'
 where baleni_g is null and lower(nazev) ~ '(kuřec|kurec|krůt|krut|hověz|hovez|vepřov|vepr|maso|prsa|steak|mlet[ée]|svíčkov|svickov|pečen|pecen|krkovič|karbanát|kotlet|sekan|řízek|rizek|špíz|spiz|jahň|kachn|zde|gyros|falafel|losos|tresk|pangas|makrel|ryba|rybí|rybi|pstruh|sardel|šprot|sprot|tilapie|kapr)';
update public.foods set baleni_g = 160,  baleni_label = 'Plechovka'
 where baleni_g is null and lower(nazev) ~ '(tuňák|tunak|tuňákov|tunakov)';
update public.foods set baleni_g = 400,  baleni_label = 'Plechovka'
 where baleni_g is null and lower(nazev) ~ '(konzerv|rajčata loupan|rajcat|loupan|fazole.*konz|pasta sard|paštika|pastika|šproty|sproty)';
update public.foods set baleni_g = 300,  baleni_label = 'Plechovka'
 where baleni_g is null and lower(nazev) ~ '(kukuřice.*konz|konz.*kukuřic|hrášek.*konz|konz.*hrášek|kukuřice v konz|konzervovaná kukuřice|konzervovaný hrášek)';
update public.foods set baleni_g = 1000, baleni_label = 'Láhev'
 where baleni_g is null and lower(nazev) ~ '(olej( |$)|olivový olej|slunečnicov|slunecnicov|repkov|voda|minerál|mineral|cola|pepsi|kofola|fanta|sprite|tonic|sirup|nápoj|napoj|limonád|limonad|octov|ocet)';
update public.foods set baleni_g = 500,  baleni_label = 'Láhev'
 where baleni_g is null and lower(nazev) ~ '(pivo|radler|nealko pivo|birell|ostrov|vlašsk|mléčný|proteinový nápoj|proteinovy napoj|protein shake)';
update public.foods set baleni_g = 800,  baleni_label = 'Balení'
 where baleni_g is null and lower(nazev) ~ '(chléb|chleba|chlebíčk|chlebicek|kváskov|kvas|toast)';
update public.foods set baleni_g = 1000, baleni_label = 'Sáček'
 where baleni_g is null and lower(nazev) ~ '(mouka|cukr( |$)|moučník|mouka pšen|pšenič|psenič|hladká mouka|polohrub|hrubá mouka|samodraj|strouhank)';
update public.foods set baleni_g = 500,  baleni_label = 'Sáček'
 where baleni_g is null and lower(nazev) ~ '(rýž|ryz|těstovin|testovin|spaghet|penne|fusilli|nudle|kuskus|couscous|bulgur|pohank|vločk|ovesn|krupic|jáhl|jahl|müsli|muesli|granola|cereál|cereal|cornflakes|hrách|hrach|fazole|čočk|cock|cizrn|luštěn|lustenin|quinoa|rozink|brusink|mandle|ořech|orech|vlašsk|kešu|kesu|pistác|pistac|arašíd|arasid|lísk|lisk|datl|sušen|susen|mražen|polévk|polevk|knedlík|knedlik)';
update public.foods set baleni_g = 200,  baleni_label = 'Balení'
 where baleni_g is null and lower(nazev) ~ '(sušenk|susenk|koláč|kolac|perník|pernik|muffin|croissant|wafle|koblíž|koblih|piškot|piskot|tofu|tempeh|seitan|hummus|zmrzlin|nanuk|čokolád|cokolad|kečup|kecup|majonéz|majonez|tatark|hořčic|horcic|pesto|džem|dzem|marmelád|marmelad|nutell|chips|brambůr|brambur|tyčink|křupk|krupk|popcorn|oliv|kapar|kořen|koren|sůl|sul|pepř|pepr|med( |$)|sirup|šunk|sunk)';

-- 5) fallback podle kategorie – nic nesmí zůstat bez gramáže
update public.foods
   set baleni_g = case kategorie
     when 'maso_ryby'        then 500
     when 'mlecne_vyrobky'   then 250
     when 'ovoce_zelenina'   then 500
     when 'peckoviny_obily'  then 500
     when 'suchary_testoviny' then 300
     when 'napoje'           then 500
     else 300
   end,
   baleni_label = coalesce(baleni_label, case kategorie
     when 'napoje'           then 'Láhev'
     when 'mlecne_vyrobky'   then 'Kelímek'
     else 'Balení'
   end)
 where baleni_g is null or baleni_g <= 0 or baleni_label is null;

-- 6) kontrakt: 100 % pokrytí – zákaz NULL/prázdné gramáže i labelu
alter table public.foods
  alter column baleni_g set not null,
  alter column baleni_label set not null;
alter table public.foods add constraint foods_baleni_g_chk check (baleni_g > 0);

-- 7) předvolby uživatele – oblíbené obchody + výchozí jednotka deníku
alter table public.profiles
  add column if not exists oblibene_obchody text[] not null default '{}',
  add column if not exists vychozi_jednotka text not null default 'g'
    check (vychozi_jednotka in ('g', 'baleni'));

-- 8) cíle rozšířené o vodu a vlákninu (volitelné – manuální přepis)
alter table public.nutrition_goals
  add column if not exists voda_ml smallint check (voda_ml between 0 and 8000),
  add column if not exists vlaknina_g smallint check (vlaknina_g between 0 and 200);

-- 9) view: vystavit baleni_label katalogu
create or replace view public.aktualni_ceny as
select
  f.id as food_id,
  f.nazev,
  f.kategorie,
  f.bilkoviny,
  f.sacharidy,
  f.tuky,
  f.kalorie,
  f.bezna_cena,
  coalesce(nej.cena, f.bezna_cena) as aktualni_cena,
  nej.retailer_id,
  r.nazev as obchod,
  (nej.je_sleva
   and (nej.platnost_do is null or nej.platnost_do >= current_date)
   and nej.puv_ok) as sleva,
  nej.platnost_do,
  nej.zdroj as zdroj_ceny,
  nej.pozorovano_at,
  f.vytvoril,
  f.zdroj as zdroj_potraviny,
  f.alergeny,
  f.diety,
  f.ean,
  f.obrazek,
  coalesce(nej.baleni_g, f.baleni_g) as baleni_g,
  case when nej.puv_ok then nej.puvodni_cena end as puvodni_cena,
  case
    when nej.je_sleva and nej.puv_ok
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta,
  case when nej.puv_ok then nej.puvodni_zdroj end as puvodni_zdroj,
  f.alergeny_stopy,
  f.baleni_label
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g,
         po.puvodni_zdroj,
         (po.puvodni_cena is not null
          and po.puvodni_cena > 1.01 * po.cena
          and po.puvodni_cena <= 2.5 * po.cena
          and (f.bezna_cena is null or f.bezna_cena <= 0
               or po.puvodni_cena <= 2 * f.bezna_cena)) as puv_ok
  from public.price_observations po
  where po.food_id = f.id
    and not po.podezrele
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;

comment on column public.foods.baleni_g is
  'Typická gramáž/objem balení v g/ml – 100 % pokrytí; u váženého zboží typické balení.';
comment on column public.foods.baleni_label is
  'Popisek balení pro UI: Balení|Plechovka|Láhev|Kelímek|Kus|Sáček|Krabice.';
comment on column public.profiles.oblibene_obchody is
  'Oblíbené řetězce – priorita při párování slev a nákupních seznamů.';
comment on column public.profiles.vychozi_jednotka is
  'Výchozí jednotka pro zápis do deníku: g (gramy/ml) | baleni (celé balení/ks).';
comment on column public.nutrition_goals.voda_ml is 'Denní cíl příjmu vody v ml (volitelný).';
comment on column public.nutrition_goals.vlaknina_g is 'Denní cíl vlákniny v g (volitelný).';
