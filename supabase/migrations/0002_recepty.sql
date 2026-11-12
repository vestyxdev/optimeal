-- ============================================================
-- 0002: RECEPTY
-- ------------------------------------------------------------
-- Recepty + suroviny (gramáže na porci). Globální recepty
-- (user_id NULL, schválené) čtou všichni, vlastní si každý
-- spravuje sám (RLS). Ceny a výživové hodnoty se NEUKLÁDAJÍ –
-- vždy se počítají živě z aktuálních cen (view aktualni_ceny),
-- takže recept odráží dnešní slevy.
-- ============================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  -- NULL = globální recept (kurátor/seed), jinak vlastní recept uživatele
  user_id uuid references auth.users (id) on delete cascade,
  nazev text not null,
  popis text,
  kategorie text not null default 'hlavni' check (
    kategorie in ('snidane', 'polevka', 'hlavni', 'svacina', 'desert')
  ),
  porce smallint not null default 2 check (porce between 1 and 12),
  cas_minuty smallint check (cas_minuty > 0 and cas_minuty <= 600),
  -- kroky postupu oddělené novým řádkem
  postup text not null default '',
  zdroj text not null default 'manual',
  schvaleno boolean not null default true,
  vytvoreno timestamptz not null default now()
);

create index ix_recipes_kategorie on public.recipes (kategorie);
create index ix_recipes_user on public.recipes (user_id);

comment on table public.recipes is 'Recepty: globální (user_id null) i vlastní uživatele.';

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id),
  gramy_na_porce numeric(6, 1) not null check (gramy_na_porce > 0 and gramy_na_porce <= 2000),
  poznamka text,
  unique (recipe_id, food_id)
);

create index ix_recipe_ingredients_recept on public.recipe_ingredients (recipe_id);
create index ix_recipe_ingredients_food on public.recipe_ingredients (food_id);

comment on table public.recipe_ingredients is 'Suroviny receptu – gramáž vždy na 1 porci.';

-- ============================================================
-- RLS
-- ============================================================

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- čtení: globální schválené recepty vidí všichni, vlastní vidí autor
create policy "recepty_cteni" on public.recipes
  for select using (
    (user_id is null and schvaleno)
    or user_id = auth.uid()
  );

create policy "recepty_suroviny_cteni" on public.recipe_ingredients
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and ((r.user_id is null and r.schvaleno) or r.user_id = auth.uid())
    )
  );

-- zápis: jen vlastní recepty
create policy "recepty_zapis_vlastni" on public.recipes
  for insert with check (user_id = auth.uid());

create policy "recepty_uprava_vlastni" on public.recipes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recepty_smazani_vlastni" on public.recipes
  for delete using (user_id = auth.uid());

create policy "suroviny_zapis_vlastni" on public.recipe_ingredients
  for insert with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  );

create policy "suroviny_uprava_vlastni" on public.recipe_ingredients
  for update using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  );

create policy "suroviny_smazani_vlastni" on public.recipe_ingredients
  for delete using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  );
