-- ============================================================
-- 0060: RLS HARDENING – om_migrace tracker + security_invoker view
-- ------------------------------------------------------------
-- a) public.om_migrace (tracking tabulka scripts/spust_migrace.mjs,
--    vzniká mimo migrační řetěz na produkci) měla přes default
--    privileges PLNÉ granty pro anon+authenticated a žádné RLS –
--    každý anonymní klient ji mohl přes PostgREST číst i PŘEPSAT
--    (poisoned tracker → runner by přeskočil nebo zopakoval
--    migrace). Odebrání grantů + zapnutí RLS bez politik =
--    pro klienty neviditelná; runner se připojuje rolí postgres
--    (BYPASSRLS) a pracuje dál.
-- b) aktualni_ceny jako security-definer view obchází RLS volajícího.
--    Podkladové tabulky čtou anon i authenticated (politiky true),
--    takže security_invoker = true vrací identické řádky – ale
--    odstraní Supabase lint a připraví view na případný budoucí
--    sloupec/join nad soukromými daty.
-- c) search_path na triggery – aktivuj_jeden_cil a trigger funkce
--    běží jako invoker; explicitní search_path je prevence proti
--    závislosti na nastavení spojení.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'om_migrace' and c.relkind = 'r') then
    execute 'revoke all on public.om_migrace from anon, authenticated, public';
    execute 'alter table public.om_migrace enable row level security';
  end if;
end
$$;

alter view public.aktualni_ceny set (security_invoker = true);

-- aktivuj_jeden_cil: doplnit search_path (security-invoker trigger
-- funkce; explicitní cesta zabraňuje překvapení při netypickém
-- nastavení search_path spojení)
create or replace function public.aktivuj_jeden_cil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.aktivni then
    update public.nutrition_goals
    set aktivni = false
    where user_id = new.user_id and id <> new.id and aktivni;
  end if;
  return new;
end;
$$;
