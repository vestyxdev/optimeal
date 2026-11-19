-- ============================================================
-- 0049: sleva = jen zdrojem ověřená sleva
-- ------------------------------------------------------------
-- Položka se za slevu považuje (a v UI dostane badge/přeškrtnutí/
-- zařazení do slevových sekcí) jen když má ověřenou původní cenu:
-- letákové % nebo přeškrtnutá cena, e-shopová was-price, Kupi
-- „běžně stojí" – a zároveň nesmí být artefaktem (nad 4× akční,
-- viz 0048) a musí znamenat aspoň ~1 % slevu.
-- Nabídka z letáku bez zveřejněné původní ceny se tak zobrazuje
-- jako obyčejná aktuální cena – žádný „Sleva" badge, žádný odhad.
-- top_akce se vrací na 8 sloupců (bezna_cena už nikdo nepotřebuje).
-- ============================================================

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
   and nej.puvodni_cena is not null
   and nej.puvodni_cena > 0
   and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
   and nej.puvodni_cena >= 1.01 * coalesce(nej.cena, f.bezna_cena)) as sleva,
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
  case
    when nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
    then nej.puvodni_cena
  end as puvodni_cena,
  case
    when nej.je_sleva
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
         and nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
         and coalesce(nej.cena, f.bezna_cena) < nej.puvodni_cena
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g
  from public.price_observations po
  where po.food_id = f.id
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;

drop function if exists public.top_akce(int);

create or replace function public.top_akce(p_limit int default 12)
returns table (
  nazev text,
  obchod text,
  cena numeric,
  puvodni_cena numeric,
  sleva_procenta numeric,
  platnost_do date,
  obrazek text,
  baleni_g numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ac.nazev,
    ac.obchod,
    ac.aktualni_cena,
    ac.puvodni_cena,
    ac.sleva_procenta,
    ac.platnost_do,
    ac.obrazek,
    ac.baleni_g
  from public.aktualni_ceny ac
  where ac.sleva
  order by ac.sleva_procenta desc nulls last, ac.pozorovano_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;

comment on function public.top_akce(int) is
  'Veřejný top-N aktivních slev pro landing page – jen ověřené slevy (zdrojová původní cena), max 24 řádků.';

revoke all on function public.top_akce(int) from public;
grant execute on function public.top_akce(int) to anon, authenticated;
