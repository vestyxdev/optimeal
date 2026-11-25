-- 0063: rozšíření retailérů (typ/slug/logo), značka+vláknina potravin,
--       produkt_url pozorování, trigramové vyhledávání (pg_trgm + unaccent)
-- Mapování na cílové schéma: retailers≈stores, foods≈products,
-- price_observations≈store_products (rozšiřujeme stávající, žádné paralelní tabulky).

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- immutable normalizační funkce pro indexy a RPC (lower + unaccent)
create or replace function public.om_norm(t text)
returns text language sql immutable strict parallel safe as $$
  -- schema-kvalifikace nutná: indexový výraz se re-parsuje bez session search_path
  select lower(public.unaccent($1))
$$;

-- trigram GIN index – „kureci prsa“ najde „Kuřecí prsa“ i bez diakritiky, ms čas
create index if not exists ix_foods_nazev_trgm
  on public.foods using gin (public.om_norm(nazev) gin_trgm_ops);

-- ── retailers: typ/slug/logo ────────────────────────────────────────────
alter table public.retailers
  add column if not exists slug text,
  add column if not exists typ text not null default 'supermarket'
    check (typ in ('supermarket', 'hypermarket', 'online', 'health_food', 'drugstore', 'velkoobchod')),
  add column if not exists logo_url text;

create unique index if not exists ux_retailers_slug on public.retailers (slug) where slug is not null;

-- kompletní české řetězce – idempotentní upsert dle názvu
insert into public.retailers (nazev, slug, typ) values
  ('Lidl',          'lidl',          'supermarket'),
  ('Kaufland',      'kaufland',      'hypermarket'),
  ('Albert',        'albert',        'supermarket'),
  ('Billa',         'billa',         'supermarket'),
  ('Tesco',         'tesco',         'supermarket'),
  ('Penny',         'penny',         'supermarket'),
  ('Globus',        'globus',        'hypermarket'),
  ('Makro',         'makro',         'velkoobchod'),
  ('COOP',          'coop',          'supermarket'),
  ('Hruška',        'hruska',        'supermarket'),
  ('Flop',          'flop',          'supermarket'),
  ('CBA',           'cba',           'supermarket'),
  ('Rohlík.cz',     'rohlik',        'online'),
  ('Košík.cz',      'kosik',         'online'),
  ('dm drogerie',   'dm',            'drugstore'),
  ('Rossmann',      'rossmann',      'drugstore'),
  ('Aktin/Vilgain', 'vilgain',       'health_food'),
  ('Grizly',        'grizly',        'health_food'),
  ('Country Life',  'country-life',  'health_food')
on conflict (nazev) do update set
  slug = excluded.slug,
  typ = excluded.typ;

-- ── foods: značka (privátní labely: Pilos, K-Classic, Clever, dmBio…) + vláknina ──
alter table public.foods
  add column if not exists znacka text,
  add column if not exists vlaknina numeric(6, 2) check (vlaknina >= 0);

-- ── price_observations: produkt_url (zdrojový odkaz položky v e-shopu) ──
alter table public.price_observations
  add column if not exists produkt_url text;

-- ── RPC: serverové trigramové hledání (diakritika-insenzitivní) ─────────
create or replace function public.hledej_potraviny(dotaz text, max_vysledku int default 30)
returns table (
  food_id uuid,
  nazev text,
  kategorie text,
  kalorie numeric,
  bilkoviny numeric,
  sacharidy numeric,
  tuky numeric,
  vlaknina numeric,
  znacka text,
  baleni_g numeric,
  baleni_label text,
  ean text,
  podobnost real
)
language sql stable security invoker set search_path = public as $$
  select
    f.id, f.nazev, f.kategorie, f.kalorie, f.bilkoviny, f.sacharidy, f.tuky,
    f.vlaknina, f.znacka, f.baleni_g, f.baleni_label, f.ean,
    similarity(public.om_norm(f.nazev), public.om_norm(dotaz)) as podobnost
  from public.foods f
  where f.schvaleno
    and length(trim(dotaz)) >= 2
    and (
      public.om_norm(f.nazev) % public.om_norm(dotaz)
      or public.om_norm(f.nazev) like '%' || public.om_norm(dotaz) || '%'
    )
  order by
    -- prefix shoda > podobnost > abeceda
    (public.om_norm(f.nazev) like public.om_norm(dotaz) || '%') desc,
    podobnost desc,
    f.nazev
  limit greatest(1, least(max_vysledku, 100))
$$;

revoke all on function public.hledej_potraviny(text, int) from public;
grant execute on function public.hledej_potraviny(text, int) to anon, authenticated;

comment on function public.hledej_potraviny(text, int) is
  'Trigramové fulltext hledání potravin – diakritika-insenzitivní (unaccent+lower), prefix shody první.';
