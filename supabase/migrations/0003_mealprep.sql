-- ============================================================
-- 0003: MEALPREP PLÁNY
-- ------------------------------------------------------------
-- meal_plans.typ rozšířen o 'mealprep' – uložený mealprep obsahuje
-- vybrané recepty × porce + konsolidovaný nákupní seznam (JSONB).
-- ============================================================

alter table public.meal_plans
  drop constraint meal_plans_typ_check;

alter table public.meal_plans
  add constraint meal_plans_typ_check
  check (typ in ('den', 'tyden', 'mealprep'));
