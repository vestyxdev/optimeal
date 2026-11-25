-- 0064: view vystavuje vlakninu+znacku, mapovani privatnich labelu na retezce,
--       referencni bezna_cena z medianu realnych pozorovani
-- Pozor: CREATE OR REPLACE VIEW povoluje jen pripojeni sloupcu NA KONEC.

-- 1) view + vlaknina/znacka (append za baleni_label)
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
  coalesce(nej.cena, f.bezna_cena) as aktualni_cena,
  nej.retailer_id,
  r.nazev as obchod,
  (nej.je_sleva
   and (nej.platnost_do is null or nej.platnost_do >= current_date)
   and nej.puv_ok) as sleva,
  nej.platnost_do,
  nej.zdroj as zdroj_ceny,
  nej.pozorovano_at,
  f.vytvoril,
  f.zdroj as zdroj_potraviny,
  f.alergeny,
  f.diety,
  f.ean,
  f.obrazek,
  coalesce(nej.baleni_g, f.baleni_g) as baleni_g,
  case when nej.puv_ok then nej.puvodni_cena end as puvodni_cena,
  case
    when nej.je_sleva and nej.puv_ok
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta,
  case when nej.puv_ok then nej.puvodni_zdroj end as puvodni_zdroj,
  f.alergeny_stopy,
  f.baleni_label,
  f.vlaknina,
  f.znacka
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g,
         po.puvodni_zdroj,
         (po.puvodni_cena is not null
          and po.puvodni_cena > 1.01 * po.cena
          and po.puvodni_cena <= 2.5 * po.cena
          and (f.bezna_cena is null or f.bezna_cena <= 0
               or po.puvodni_cena <= 2 * f.bezna_cena)) as puv_ok
  from public.price_observations po
  where po.food_id = f.id
    and not po.podezrele
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;

-- security_invoker z 0060 – create or replace ho na nekterych verzich zahazuje,
-- pro jistotu znovu vynutit (anon cte view primo pres sve granty)
alter view public.aktualni_ceny set (security_invoker = true);

-- 2) privatni labely → retezec (Pilos=Lidl, K-Classic=Kaufland, Clever=Billa…)
create table if not exists public.znacky_mapovani (
  znacka text primary key,
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  zdroj text not null default 'manual',
  vytvoreno_at timestamptz not null default now()
);

alter table public.znacky_mapovani enable row level security;

create policy znacky_mapovani_cist_vsichni on public.znacky_mapovani
  for select to anon, authenticated using (true);

comment on table public.znacky_mapovani is
  'Mapování privátních labelů na řetězce – „Pilos" je jen v Lidlu, takže cena je relevantní jen tam.';

insert into public.znacky_mapovani (znacka, retailer_id)
select v.znacka, r.id
from (values
  -- Lidl
  ('Pilos', 'lidl'), ('Milbona', 'lidl'), ('Alesto', 'lidl'),
  ('Crownfield', 'lidl'), ('Bellarom', 'lidl'), ('Combino', 'lidl'),
  ('Freeway', 'lidl'), ('Cien', 'lidl'), ('Vitasia', 'lidl'), ('Ocean Sea', 'lidl'),
  -- Kaufland
  ('K-Classic', 'kaufland'), ('K-Bio', 'kaufland'), ('K-Favorites', 'kaufland'),
  -- Billa (Clever je Billa, ne Tesco!)
  ('Clever', 'billa'),
  -- Tesco
  ('Tesco Finest', 'tesco'), ('Tesco', 'tesco'),
  -- Albert
  ('Nature''s Promise', 'albert'), ('Albert Nature''s Promise', 'albert'),
  -- Penny
  ('Penny', 'penny'),
  -- dm / Rossmann
  ('dmBio', 'dm'), ('Balea', 'dm'), ('enerBiO', 'rossmann'),
  -- health food
  ('Vilgain', 'vilgain'), ('Grizly', 'grizly'), ('Country Life', 'country-life'),
  -- Globus
  ('Globus', 'globus')
) as v(znacka, slug)
join public.retailers r on r.slug = v.slug
on conflict (znacka) do update set retailer_id = excluded.retailer_id;

-- 3) referencni bezna_cena z medianu realnych pozorovani
-- Pozorovani jsou v Kc za baleni (stejne jednotky jako bezna_cena v katalogu),
-- takze median je automaticky ve spravnych jednotkach a opravi hrube odhady.
create or replace function public.obnov_referencni_ceny()
returns integer language sql security definer set search_path = public as $$
  with mediany as (
    select po.food_id,
           percentile_cont(0.5) within group (order by po.cena) as med
    from public.price_observations po
    where not po.podezrele
      and po.cena > 0
    group by po.food_id
    having count(*) >= 3
  ),
  upd as (
    update public.foods f
    set bezna_cena = round(m.med::numeric, 2)
    from mediany m
    where f.id = m.food_id
      and abs(f.bezna_cena - m.med) > 0.5 * greatest(f.bezna_cena, m.med)
    returning 1
  )
  select count(*)::integer from upd
$$;

-- hned jednou spustit; vraci pocet zmenenych radku (select pro migracni log)
select public.obnov_referencni_ceny() as cen_zmeneno;

comment on function public.obnov_referencni_ceny() is
  'Přepočet referencni bezna_cena z medianu realnych pozorovani (>=3 mereni, meni jen pri >50% odchylce). Spoustet periodicky ze scraperu.';
