-- ============================================================
-- 0016: veřejné top akce pro landing page
-- ------------------------------------------------------------
-- Letákové ceny jsou veřejná marketingová data obchodů – stejně je
-- najde každý na kupi.cz. Funkce vrací jen úzkou projekci (název,
-- obchod, ceny, % slevy, platnost, obrázek, balení) – žádná data
-- uživatelů ani ID entit. Limit je tvrdě seříznut na 24, takže
-- funkce neslouží jako obejití RLS pro dump celého katalogu.
-- security definer: čte aktualni_ceny i pro role anon.
-- ============================================================

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
  'Veřejný top-N aktivních slev pro landing page – jen projekce letákových dat, max 24 řádků.';

revoke all on function public.top_akce(int) from public;
grant execute on function public.top_akce(int) to anon, authenticated;
