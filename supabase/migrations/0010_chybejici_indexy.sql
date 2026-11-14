-- ============================================================
-- 0010: chybějící indexy (audit fáze 3 – databáze)
-- - shopping_lists.user_id: RLS `seznamy_vse` filtruje každý
--   dotaz podle auth.uid() – bez indexu sekvenční scan
-- - shopping_lists.plan_id: FK při smazání plánu (ON DELETE
--   SET NULL) kontroluje všechny řádky
-- - foods.ean: dohledávání podle čárového kódu při skenování
-- - foods.vytvoril: RLS politiky uprava/smazání filtrují
--   podle autora
-- ============================================================

create index if not exists ix_shopping_lists_user
  on public.shopping_lists (user_id, vytvoreno desc);

create index if not exists ix_shopping_lists_plan
  on public.shopping_lists (plan_id)
  where plan_id is not null;

create index if not exists ix_foods_ean
  on public.foods (ean)
  where ean is not null;

create index if not exists ix_foods_vytvoril
  on public.foods (vytvoril)
  where vytvoril is not null;
