-- ============================================================
-- 0056: top_akce_pozorovano – stáří ceny i na veřejné landing
-- ------------------------------------------------------------
-- Veřejný výpis slev (landing) dosud vracel jen cenu/slevu/
-- platnost. Bez pozorovano_at se i týden stará letáková cena
-- tvářila jako živá – landing přidává sloupec, frontend pak
-- ukáže „cena z …" stejně jako přihlášené plochy.
-- ============================================================

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
  pozorovano_at timestamptz
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
    ac.pozorovano_at
  from public.aktualni_ceny ac
  where ac.sleva
  order by ac.sleva_procenta desc nulls last, ac.pozorovano_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;

comment on function public.top_akce(int) is
  'Veřejný top-N aktivních slev pro landing page – ověřené slevy (zdrojová původní cena) se stářím pozorování, max 24 řádků.';

revoke all on function public.top_akce(int) from public;
grant execute on function public.top_akce(int) to anon, authenticated;
