-- ============================================================
-- OptiMeal – migrace č. 1: základní schéma (fáze 2 – jádro výživy)
-- Postgres (Supabase). Rozšiřuje auth.users o profil, přidává
-- katalog potravin s cenami, plány jídelníčku a nákupní seznamy.
-- Identifikátory jsou anglické (kód), obsah a data české.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- PROFIL UŽIVATELE (1:1 s auth.users)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  jmeno text,
  -- tělesné údaje pro výpočet cílů (TDEE)
  vaha_kg numeric(5, 1) check (vaha_kg > 30 and vaha_kg < 400),
  vyska_cm smallint check (vyska_cm > 100 and vyska_cm < 250),
  vek_roku smallint check (vek_roku > 10 and vek_roku < 110),
  pohlavi text check (pohlavi in ('m', 'z')),
  aktivita text check (aktivita in ('sedava', 'mirna', 'aktivni', 'velmi')),
  cil_tela text check (cil_tela in ('zhubnout', 'udrzet', 'zhodnotit')),
  telo_tuk_procento numeric(4, 1) check (telo_tuk_procento >= 3 and telo_tuk_procento <= 60),
  -- rozpočet a preference
  tydenny_rozpocet_kc numeric(9, 2),
  pocet_jidel_denne smallint not null default 4 check (pocet_jidel_denne between 2 and 8),
  dieta text[] not null default '{}',
  alergie text[] not null default '{}',
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now()
);

comment on table public.profiles is 'Profil uživatele: tělesné údaje, cíl, rozpočet, preference.';

-- ============================================================
-- AKTIVNÍ VÝŽIVOVÉ CÍLE (výpočet z profilu nebo ručně)
-- ============================================================

create table public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kalorie smallint not null check (kalorie between 800 and 5000),
  bilkoviny smallint not null check (bilkoviny between 20 and 400),
  sacharidy smallint not null check (sacharidy between 0 and 700),
  tuky smallint not null check (tuky between 10 and 250),
  -- 'auto' = spočítáno z profilu (TDEE), 'manual' = ruční zásah
  zdroj text not null default 'auto' check (zdroj in ('auto', 'manual')),
  aktivni boolean not null default true,
  vytvoreno timestamptz not null default now()
);

-- jen jedna aktivní sada cílů na uživatele
create unique index ux_nutrition_goals_aktivni
  on public.nutrition_goals (user_id) where aktivni;

comment on table public.nutrition_goals is 'Aktivní denní cíle uživatele (kalorie + makra).';

-- ============================================================
-- KATALOG POTRAVIN (globální, sdílený)
-- Hodnoty vždy za 100 g – snadné porovnávání „výhodnosti".
-- ============================================================

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  nazev text not null unique,
  kategorie text not null default 'ostatni' check (
    kategorie in ('maso_ryby', 'mlecne_vyrobky', 'ovoce_zelenina', 'peckoviny_obily', 'suchary_testoviny', 'ostatni')
  ),
  bilkoviny numeric(6, 2) not null check (bilkoviny >= 0),
  sacharidy numeric(6, 2) not null check (sacharidy >= 0),
  tuky numeric(6, 2) not null check (tuky >= 0),
  kalorie numeric(8, 2) not null check (kalorie >= 0),
  -- běžná cena Kč / 100 g
  bezna_cena numeric(8, 2) not null check (bezna_cena >= 0),
  ean text,
  -- původ záznamu: 'manual' | 'seed-v1' | 'openfoodfacts' | 'uzivatel'
  zdroj text not null default 'manual',
  schvaleno boolean not null default true,  -- false = čeká na schválení
  vytvoreno timestamptz not null default now()
);

comment on table public.foods is 'Katalog potravin s výživovými hodnotami (vždy za 100 g).';

-- ============================================================
-- OBCHODY (retailery)
-- ============================================================

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  nazev text not null unique,
  aktivni boolean not null default true,
  poznamka text
);

-- ============================================================
-- CENOVÁ POZOROVÁNÍ (neměnná historie – nikdy nepřepisujeme)
-- Každé pozorování = jeden záznam (potravina × obchod × čas).
-- „Aktuální cena" = poslední pozorování dle view níže.
-- ============================================================

create table public.price_observations (
  id bigint generated always as identity primary key,
  food_id uuid not null references public.foods (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  -- cena Kč / 100 g (normalizovaná na jednotnou referenci)
  cena numeric(8, 2) not null check (cena >= 0),
  je_sleva boolean not null default false,
  -- do kdy sleva platí (null = běžná cena / bez omezení)
  platnost_do date,
  -- původ: 'manual' | 'seed-v1' | 'letak' | 'scraper'
  zdroj text not null default 'manual',
  pozorovano_at timestamptz not null default now(),
  unique (food_id, retailer_id, pozorovano_at)
);

create index ix_price_obs_food on public.price_observations (food_id, pozorovano_at desc);
create index ix_price_obs_sleva on public.price_observations (je_sleva, platnost_do);

comment on table public.price_observations is 'Neměnná historie cen (normalizace Kč/100 g) s původem dat.';

-- ============================================================
-- VIEW: AKTUÁLNÍ CENY (poslední platné pozorování)
-- Vrácená cena už zahrnuje slevu, pokud platí – stejný kontrakt
-- jako „nacti_potraviny_se_slevami" v PHP verzi.
-- ============================================================

create or replace view public.aktualni_ceny as
select
  f.id as food_id,
  f.nazev,
  f.kategorie,
  f.bilkoviny,
  f.sacharidy,
  f.tuky,
  f.kalorie,
  f.bezna_cena,
  nej.cena as aktualni_cena,
  nej.retailer_id,
  r.nazev as obchod,
  (nej.je_sleva and (nej.platnost_do is null or nej.platnost_do >= current_date)) as sleva,
  nej.platnost_do,
  nej.zdroj as zdroj_ceny,
  nej.pozorovano_at
from public.foods f
left join lateral (
  select po.cena, po.retailer_id, po.je_sleva, po.platnost_do, po.zdroj, po.pozorovano_at
  from public.price_observations po
  where po.food_id = f.id
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    -- aktivní sleva má přednost; pak nejnovější pozorování
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;

-- ============================================================
-- JÍDELNÍČKY (plány)
-- `data` drží výstup generátoru (dny, jídla, nákup) jako JSONB –
-- plán lze později otevřít přesně tak, jak vznikl.
-- ============================================================

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  typ text not null check (typ in ('den', 'tyden')),
  cil_kalorie smallint not null check (cil_kalorie between 800 and 5000),
  cil_bilkoviny smallint not null check (cil_bilkoviny between 20 and 400),
  cil_sacharidy smallint not null check (cil_sacharidy between 0 and 700),
  cil_tuky smallint not null check (cil_tuky between 10 and 250),
  data jsonb not null,
  vytvoreno timestamptz not null default now()
);

create index ix_meal_plans_user on public.meal_plans (user_id, vytvoreno desc);

comment on table public.meal_plans is 'Uložené jídelníčky (denní i týdenní) jako JSONB.';

-- ============================================================
-- NÁKUPNÍ SEZNAMY
-- ============================================================

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nazev text not null default 'Nákupní seznam',
  -- volitelný zdroj: seznam vygenerovaný z plánu
  plan_id uuid references public.meal_plans (id) on delete set null,
  hotovo boolean not null default false,
  vytvoreno timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  nazev text not null,
  gramy integer not null default 0 check (gramy >= 0),
  cena_za_100g numeric(8, 2),
  obchod text,
  je_sleva boolean not null default false,
  koupeno boolean not null default false,
  -- ručně přidaná položka (není z katalogu)
  vlastni boolean not null default false,
  kategorie text not null default 'ostatni'
);

create index ix_shopping_items_list on public.shopping_list_items (list_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Pravidla: uživatel vidí/řídí JEN svoje řádky; katalog potravin,
-- obchodů a cen je čitelný pro přihlášené; zápis do katalogu
-- pouze service_role (scraper/admin – přes server klíč).
-- ============================================================

alter table public.profiles enable row level security;
alter table public.nutrition_goals enable row level security;
alter table public.foods enable row level security;
alter table public.retailers enable row level security;
alter table public.price_observations enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- --- profiles: vlastní profil ---
create policy "vlastni_profil_cteni" on public.profiles
  for select using (auth.uid() = id);
create policy "vlastni_profil_uprava" on public.profiles
  for update using (auth.uid() = id);
create policy "vlastni_profil_vlozeni" on public.profiles
  for insert with check (auth.uid() = id);

-- --- nutrition_goals: vlastní cíle ---
create policy "vlastni_cile_vse" on public.nutrition_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- foods: čtení pro přihlášené, zápis jen service_role ---
create policy "katalog_cteni" on public.foods
  for select to authenticated using (true);

-- --- retailers: čtení pro přihlášené ---
create policy "obchody_cteni" on public.retailers
  for select to authenticated using (true);

-- --- price_observations: čtení pro přihlášené ---
create policy "ceny_cteni" on public.price_observations
  for select to authenticated using (true);

-- --- meal_plans: vlastní plány ---
create policy "plany_vse" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- shopping_lists: vlastní seznamy ---
create policy "seznamy_vse" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- shopping_list_items: přes vlastníka seznamu ---
create policy "polozky_vlastniho_seznamu" on public.shopping_list_items
  for all using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.list_id and sl.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.list_id and sl.user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTOMATICKÉ VYTVOŘENÍ PROFILU PO REGISTRACI
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, jmeno)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'jmeno', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- AUTOMATICKÁ AKTIVACE JEDNOHO CÍLE (jen jeden aktivní)
-- Při vložení aktivního cíle deaktivujeme ostatní.
-- ============================================================

create or replace function public.aktivuj_jeden_cil()
returns trigger
language plpgsql
as $$
begin
  if new.aktivni then
    update public.nutrition_goals
    set aktivni = false
    where user_id = new.user_id and id <> new.id and aktivni;
  end if;
  return new;
end;
$$;

create trigger trg_aktivuj_jeden_cil
  before insert or update on public.nutrition_goals
  for each row execute function public.aktivuj_jeden_cil();
