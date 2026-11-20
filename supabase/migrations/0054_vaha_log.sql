-- ============================================================
-- 0054: vaha_log – automatická historie váhy pro adaptivní TDEE
-- ------------------------------------------------------------
-- Přesnost kalorického plánu: naměřený TDEE z energie zapsané
-- v deníku a reálné změny váhy (příjem − Δkg×7700/dny) je přesnější
-- než odhad z násobiče aktivity. Historie váhy se plní sama –
-- trigger na profiles.vaha_kg zaznamená každou změnu váhy.
-- ============================================================

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vaha_kg numeric(5, 1) not null check (vaha_kg > 30 and vaha_kg < 400),
  zapsano_at timestamptz not null default now()
);

comment on table public.weight_logs is
  'Historie váhy uživatele – plní se triggerem při změně profiles.vaha_kg.';

create index if not exists idx_weight_logs_uzivatel_cas
  on public.weight_logs (user_id, zapsano_at);

alter table public.weight_logs enable row level security;

create policy "vaha_log_vse" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- zalogovat váhu při vzniku profilu a při každé změně vaha_kg
create or replace function public.log_vaha_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.vaha_kg is distinct from old.vaha_kg then
    if new.vaha_kg is not null then
      insert into public.weight_logs (user_id, vaha_kg)
      values (new.id, new.vaha_kg);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_vaha_log on public.profiles;
create trigger trg_profiles_vaha_log
  after insert or update of vaha_kg on public.profiles
  for each row execute function public.log_vaha_profil();

-- zpětně doplnit první bod pro existující profily s vyplněnou váhou
insert into public.weight_logs (user_id, vaha_kg)
select p.id, p.vaha_kg
from public.profiles p
where p.vaha_kg is not null
  and not exists (
    select 1 from public.weight_logs w where w.user_id = p.id
  );
