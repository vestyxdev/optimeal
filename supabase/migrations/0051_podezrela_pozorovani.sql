-- ============================================================
-- 0051: podezrela_pozorovani – outlier guard proti špatnému
--       spárování nabídky na potravinu
-- ------------------------------------------------------------
-- Ceny jsou vždy reálné hodnoty z obchodu, ale matcher občas
-- přiřadí nabídku k špatné potravině (např. generickou "Mléko"
-- k multipacku / prémiovému produktu za 272 Kč/l). Takové řádky
-- poznáme robustně: cena pozorování se liší o >3× (nahoru) nebo
-- <0,25× (dolů) od mediánu posledního pozorování na obchod téže
-- potraviny – ale jen když existují aspoň 3 obchody (jinak je
-- medián nedůvěryhodný a raději nezasahujeme).
--
-- Flag je nedestruktivní (auditovatelné), view i Cenovka taková
-- pozorování ignorují → potravina padá zpět na zbývající reálné
-- ceny / bezna_cena. Trigger hlídá všechny budoucí zápisy
-- (PostgREST, obohaceni, ruční inserty) – zmizí i poslední
-- podezřelá řádka, nic se nerozbije: lateral vrátí jen null.
-- ============================================================

alter table public.price_observations
  add column if not exists podezrele boolean not null default false;

comment on column public.price_observations.podezrele is
  'Outlier vůči per-food mediánu posledních pozorování na obchod
   (>3× nebo <0,25×, potřeba ≥3 obchodů) – pravděpodobně špatně
   spárovaná nabídka. View/Cenovka ji ignorují.';

-- Backfill – medián z posledního pozorování na (food, retailer)
with posledni as (
  select distinct on (food_id, retailer_id)
         food_id, retailer_id, cena
    from public.price_observations
   order by food_id, retailer_id, pozorovano_at desc
),
baseline as (
  select food_id,
         percentile_cont(0.5) within group (order by cena) as med,
         count(*) as n_obchodu
    from posledni
   group by food_id
)
update public.price_observations po
   set podezrele = true
  from baseline b
 where po.food_id = b.food_id
   and b.n_obchodu >= 3
   and (po.cena > 3 * b.med or po.cena < 0.25 * b.med);

-- Trigger pro budoucí zápisy – stejné pravidlo, baseline jen
-- z nepodezřelých řádků (flagované nemůžou kazit medián).
create or replace function public._obs_podezrele()
returns trigger
language plpgsql
as $$
declare
  med numeric;
  n   int;
begin
  if new.cena is null or new.cena <= 0 then
    return new;
  end if;
  select percentile_cont(0.5) within group (order by t.cena),
         count(*)
    into med, n
    from (
      select distinct on (retailer_id) cena
        from public.price_observations
       where food_id = new.food_id
         and not podezrele
       order by retailer_id, pozorovano_at desc
    ) t;
  if n >= 3 and (new.cena > 3 * med or new.cena < 0.25 * med) then
    new.podezrele := true;
  end if;
  return new;
end;
$$;

drop trigger if exists obs_podezrele on public.price_observations;
create trigger obs_podezrele
  before insert on public.price_observations
  for each row execute function public._obs_podezrele();

-- View: podezřelá pozorování nikdy nesmí ven (ani jako „nejlevnější").
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
   and nej.puvodni_cena is not null
   and nej.puvodni_cena > 0
   and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
   and nej.puvodni_cena >= 1.01 * coalesce(nej.cena, f.bezna_cena)) as sleva,
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
  case
    when nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
    then nej.puvodni_cena
  end as puvodni_cena,
  case
    when nej.je_sleva
         and (nej.platnost_do is null or nej.platnost_do >= current_date)
         and nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
         and coalesce(nej.cena, f.bezna_cena) < nej.puvodni_cena
    then round(
      greatest(0, 1 - coalesce(nej.cena, f.bezna_cena)
        / nullif(nej.puvodni_cena, 0)) * 100
    )
    else null
  end as sleva_procenta,
  case
    when nej.puvodni_cena is not null and nej.puvodni_cena > 0
         and nej.puvodni_cena <= 4 * coalesce(nej.cena, f.bezna_cena)
    then nej.puvodni_zdroj
  end as puvodni_zdroj
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g,
         po.puvodni_zdroj
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
