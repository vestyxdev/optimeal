-- ============================================================
-- 0047: smazání seedových cen + čistý přepočet běžných cen
-- ------------------------------------------------------------
-- 1) price_observations se zdrojem seed-* jsou vymyšlené ceny
--    z dob prototypu (fake slevy Billa/Kaufland/Tesco + "běžné"
--    ceny = ručně psaná bezna_cena). Zobrazovaly se jako reálné
--    pozorované ceny → mažeme. seed.sql už je znovu nevkládá.
-- 2) bezna_cena přepočet znovu – medián čistě z reálných obs
--    (předchozí přepočet v 0045 zahrnoval i seedové ceny).
-- 3) top_akce nově vrací i bezna_cena – landing karta tak může
--    u slevy bez zdrojové původní ceny ukázat "běžně ~X" místo
--    ničeho (medián reálných pozorování, ne placeholder).
-- ============================================================

delete from public.price_observations
where zdroj in ('seed-v1', 'seed-v2');

with posledni as (
  select distinct on (food_id, retailer_id)
    food_id, cena, je_sleva
  from public.price_observations
  where cena > 0
  order by food_id, retailer_id, pozorovano_at desc
),
mediany as (
  select
    food_id,
    percentile_cont(0.5) within group (order by cena)
      filter (where not je_sleva) as med_neakcni,
    percentile_cont(0.5) within group (order by cena) as med_vse
  from posledni
  group by food_id
)
update public.foods f
set bezna_cena = round(coalesce(m.med_neakcni, m.med_vse)::numeric, 2)
from mediany m
where f.id = m.food_id
  and coalesce(m.med_neakcni, m.med_vse) is not null;

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
  baleni_g numeric,
  bezna_cena numeric
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
    ac.baleni_g,
    ac.bezna_cena
  from public.aktualni_ceny ac
  where ac.sleva
  order by ac.sleva_procenta desc nulls last, ac.pozorovano_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;

comment on function public.top_akce(int) is
  'Veřejný top-N aktivních slev pro landing page – jen projekce letákových dat, max 24 řádků.';

revoke all on function public.top_akce(int) from public;
grant execute on function public.top_akce(int) to anon, authenticated;
