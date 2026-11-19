-- 0039_denik.sql – Jídelní deník (záznam snědených jídel)
-- ============================================================
-- Uživatel zapisuje, co skutečně snědl: potravina + množství + typ
-- jídla + den/čas. Výživové hodnoty se snapshotují na 100 g
-- (robustní vůči pozdějším změnám katalogu – smazání potraviny
-- záznam nerozbije, jen ztratí FK).
-- ============================================================

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,

  nazev text not null,
  obrazek text,

  -- snidane | svacina | obed | odpoledne | vecere | ostatni
  typ_jidla text not null check (typ_jidla in
    ('snidane', 'svacina', 'obed', 'odpoledne', 'vecere', 'ostatni')),

  mnozstvi_g numeric(8, 1) not null check (mnozstvi_g > 0 and mnozstvi_g <= 10000),

  -- snapshot výživových hodnot NA 100 g v okamžiku zápisu
  kalorie numeric(7, 2) not null default 0 check (kalorie >= 0),
  bilkoviny numeric(6, 2) not null default 0 check (bilkoviny >= 0),
  sacharidy numeric(6, 2) not null default 0 check (sacharidy >= 0),
  tuky numeric(6, 2) not null default 0 check (tuky >= 0),

  -- den záznamu (čas zůstává v zapsano_at; den je přesně to, co
  -- uživatel vidí a čeho se součty týkají – česká časová zóna)
  zapsano_dne date not null default ((now() at time zone 'Europe/Prague')::date),
  zapsano_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

comment on table public.diary_entries is
  'Jídelní deník – záznamy snědených jídel. Makra jsou snapshot na 100 g.';

create index idx_diary_entries_uzivatel_den
  on public.diary_entries (user_id, zapsano_dne);

alter table public.diary_entries enable row level security;

-- každý vidí a spravuje jen svůj deník (stejný vzor jako meal_plans)
create policy "denik_vse" on public.diary_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
