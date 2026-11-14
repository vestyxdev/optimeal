-- ============================================================
-- 0007: ČTENÍ KATALOGU PRO ANONYMA + PŘÍSNÉ GRANTY RPC
-- a) foods/retailers/price_observations čitelné i anonymům –
--    data jsou záměrně veřejná (view aktualni_ceny je anon
--    stejně ukazuje). Bez toho join foods z recipe_ingredients
--    vrací nepřihlášeným NULL a recepty nemají suroviny.
-- b) delete_own_account(): odebrat EXECUTE i roli anon
--    (grant z 0004 stačil jen na 'public', ne explicitní anon).
-- ============================================================

drop policy if exists "katalog_cteni" on public.foods;
create policy "katalog_cteni" on public.foods
  for select to anon, authenticated using (true);

drop policy if exists "obchody_cteni" on public.retailers;
create policy "obchody_cteni" on public.retailers
  for select to anon, authenticated using (true);

drop policy if exists "ceny_cteni" on public.price_observations;
create policy "ceny_cteni" on public.price_observations
  for select to anon, authenticated using (true);

revoke all on function public.delete_own_account() from anon, public;
grant execute on function public.delete_own_account() to authenticated;
