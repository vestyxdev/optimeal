-- ============================================================
-- 0053: cilova_vaha_tempo – cílová váha a tempo pro průvodce cíli
-- ------------------------------------------------------------
-- Průvodce (Cal AI styl) počítá plán z cílové váhy a tempa
-- kg/týden. Ukládáme je na profilu, aby se při přepočtu
-- předvyplnily – a aby bylo jasné, k čemu aktivní cíle patří.
-- ============================================================

alter table public.profiles
  add column if not exists cilova_vaha_kg numeric
    check (cilova_vaha_kg is null or (cilova_vaha_kg >= 30 and cilova_vaha_kg <= 300)),
  add column if not exists tempo_kg_tydne numeric
    check (tempo_kg_tydne is null or (tempo_kg_tydne > 0 and tempo_kg_tydne <= 1.5));
