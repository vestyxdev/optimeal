-- ============================================================
-- 0011: unikátní index na foods.ean pro hromadný ingest (OFF)
-- - EAN je podnikový klíč pro deduplikaci při importu katalogu
-- - částečný index: NULL eany (uživatelské potraviny) se neomezují
-- ============================================================

create unique index if not exists ux_foods_ean
  on public.foods (ean)
  where ean is not null;
