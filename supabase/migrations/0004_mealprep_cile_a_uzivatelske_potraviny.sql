-- ============================================================
-- 0004: MEALPREP CÍLE + UŽIVATELSKÉ POTRAVINY + ÚČET
-- ------------------------------------------------------------
-- a) meal_plans: cílové hodnoty pro typ 'mealprep' jsou SOUČTY
--    za všechny porce (můžou přesáhnout denní limity). Sloupce
--    se rozšíří na integer a kontroly se rozdělí podle typu.
-- b) foods.vytvoril: vlastník uživatelské potraviny; RLS povolí
--    vkládat/upravovat/mazat jen vlastní (zdroj = 'uzivatel').
-- c) profiles: DELETE politika + RPC delete_own_account() pro
--    smazání účtu (kaskáda smaže profil, cíle, plány, seznamy).
-- d) index price_observations(retailer_id) pro scraper dotazy.
-- ============================================================

-- ---- a) meal_plans: širší meze pro mealprep součty -----------
alter table public.meal_plans
  alter column cil_kalorie type integer,
  alter column cil_bilkoviny type integer,
  alter column cil_sacharidy type integer,
  alter column cil_tuky type integer;

alter table public.meal_plans drop constraint meal_plans_cil_kalorie_check;
alter table public.meal_plans drop constraint meal_plans_cil_bilkoviny_check;
alter table public.meal_plans drop constraint meal_plans_cil_sacharidy_check;
alter table public.meal_plans drop constraint meal_plans_cil_tuky_check;

alter table public.meal_plans
  add constraint meal_plans_cile_check check (
    (typ = 'mealprep'
      and cil_kalorie between 0 and 200000
      and cil_bilkoviny between 0 and 20000
      and cil_sacharidy between 0 and 20000
      and cil_tuky between 0 and 10000)
    or (typ in ('den', 'tyden')
      and cil_kalorie between 800 and 5000
      and cil_bilkoviny between 20 and 400
      and cil_sacharidy between 0 and 700
      and cil_tuky between 10 and 250)
  );

-- ---- b) foods: vlastní potraviny uživatele -------------------
alter table public.foods
  add column if not exists vytvoril uuid references auth.users (id) on delete set null;

comment on column public.foods.vytvoril is
  'Autor uživatelské potraviny (zdroj = uzivatel); NULL = katalog.';

create policy "potraviny_vlozeni_vlastni" on public.foods
  for insert to authenticated
  with check (vytvoril = auth.uid() and zdroj = 'uzivatel');

create policy "potraviny_uprava_vlastni" on public.foods
  for update to authenticated
  using (vytvoril = auth.uid() and zdroj = 'uzivatel')
  with check (vytvoril = auth.uid() and zdroj = 'uzivatel');

create policy "potraviny_smazani_vlastni" on public.foods
  for delete to authenticated
  using (vytvoril = auth.uid() and zdroj = 'uzivatel');

-- ---- c) smazání účtu (GDPR) ----------------------------------
create policy "vlastni_profil_smazani" on public.profiles
  for delete using (auth.uid() = id);

-- Smaže auth.users řádek přihlášeného uživatele; kaskáda uklidí
-- profil, cíle, plány, seznamy i vlastní recepty/potraviny.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ---- d) index pro dotazy scraperu podle obchodu ---------------
create index if not exists ix_price_obs_retailer
  on public.price_observations (retailer_id, pozorovano_at desc);
