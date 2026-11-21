-- 0058: UPDATE politiky pro spíž a stálice
--
-- 0057 nasadila jen SELECT/INSERT/DELETE. Aplikace zapisuje přes
-- upsert(onConflict) = INSERT ... ON CONFLICT DO UPDATE, což vyžaduje
-- UPDATE politiku – bez ní každé opětovné přidání stejné položky do
-- spíže nebo opětovné připnutí stálice končí 42501 (RLS deny).
-- Betroffen: pridejDoSpize, prepnoutStalici, migrujSpizAStaliceHosta.

drop policy if exists "pantry update own" on public.pantry_items;
create policy "pantry update own" on public.pantry_items
  for update using (auth.uid() = user_id);

drop policy if exists "staples update own" on public.pinned_staples;
create policy "staples update own" on public.pinned_staples
  for update using (auth.uid() = user_id);
