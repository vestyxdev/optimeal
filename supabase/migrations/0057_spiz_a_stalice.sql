-- 0057: Spíž („mám doma") + Moje stálice (pinned staples)
--
-- pantry_items: potraviny, které uživatel má doma → nákupní seznamy
-- je z účtu vynechávají (ruční položky bez food_id se drží podle názvu).
-- pinned_staples: pár sledovaných stálic → dashboard widget „v akci".

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete cascade,
  nazev text not null,
  created_at timestamptz not null default now(),
  unique (user_id, nazev)
);

comment on table public.pantry_items is
  'Spíž – potraviny, které uživatel má doma (vynechávají se z účtu nákupu).';

alter table public.pantry_items enable row level security;

drop policy if exists "pantry select own" on public.pantry_items;
create policy "pantry select own" on public.pantry_items
  for select using (auth.uid() = user_id);
drop policy if exists "pantry insert own" on public.pantry_items;
create policy "pantry insert own" on public.pantry_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "pantry delete own" on public.pantry_items;
create policy "pantry delete own" on public.pantry_items
  for delete using (auth.uid() = user_id);

create table if not exists public.pinned_staples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, food_id)
);

comment on table public.pinned_staples is
  'Moje stálice – připnuté potraviny ke sledování slev na dashboardu.';

alter table public.pinned_staples enable row level security;

drop policy if exists "staples select own" on public.pinned_staples;
create policy "staples select own" on public.pinned_staples
  for select using (auth.uid() = user_id);
drop policy if exists "staples insert own" on public.pinned_staples;
create policy "staples insert own" on public.pinned_staples
  for insert with check (auth.uid() = user_id);
drop policy if exists "staples delete own" on public.pinned_staples;
create policy "staples delete own" on public.pinned_staples
  for delete using (auth.uid() = user_id);
