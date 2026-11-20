-- ============================================================
-- 0052: puvodni_plausible – zpřísnění sanity pravidel pro
--       „původní" ceny (pack-mismatch artefakty Kupi detailů)
-- ------------------------------------------------------------
-- Reálný případ: Kupi „běžně stojí 179,90 Kč" patřilo většímu
-- balení; normalizace přes obs.baleni_g (200 g) vyrobila
-- puvodni 90 Kč/100g = „180 Kč za 200 g Granko" → falešná
-- sleva 70 %. Cap 4× to propustil (3,3×).
--
-- Nová pravidla pro platnou původní cenu (všechna najednou):
--   1) puvodni > 1.01 × aktualni        (reálná sleva)
--   2) puvodni ≤ 2.5 × aktualni         (max ~60 % – víc je v
--      českém potravinářském letáku téměř vždy artefakt balení)
--   3) puvodni ≤ 2 × bezna_cena         („běžná" cena nemůže být
--      2× typická tržní cena – zabíjí pack-mismatch normalizace)
--
-- Nevyhovující řádky dostanou puvodni_cena = NULL (poctivá
-- obyčejná cena), pozorování samo zůstává – jeho cena je reálná.
-- Trigger hlídá INSERT i UPDATE (obohaceni_puvodni PATCHuje
-- puvodni dodatečně – bez UPDATE triggeru by se artefakty
-- vracely při každém obohacení).
-- ============================================================

-- Trigger – platnost původní ceny při každém zápisu/úpravě.
create or replace function public._obs_puvodni_sanity()
returns trigger
language plpgsql
as $$
declare
  bz numeric;
begin
  if new.puvodni_cena is null then
    return new;
  end if;
  select bezna_cena into bz from public.foods where id = new.food_id;
  if new.puvodni_cena <= 0
     or new.cena is null or new.cena <= 0
     or new.puvodni_cena <= 1.01 * new.cena
     or new.puvodni_cena > 2.5 * new.cena
     or (bz is not null and bz > 0 and new.puvodni_cena > 2 * bz) then
    new.puvodni_cena := null;
    new.puvodni_zdroj := null;
  end if;
  return new;
end;
$$;

drop trigger if exists obs_puvodni_sanity on public.price_observations;
create trigger obs_puvodni_sanity
  before insert or update of cena, puvodni_cena, puvodni_zdroj
  on public.price_observations
  for each row execute function public._obs_puvodni_sanity();

-- Backfill – zneplatnit existující artefakty (globálně, všechny).
update public.price_observations po
   set puvodni_cena = null,
       puvodni_zdroj = null
  from public.foods f
 where po.food_id = f.id
   and po.puvodni_cena is not null
   and (po.puvodni_cena <= 1.01 * po.cena
        or po.puvodni_cena > 2.5 * po.cena
        or (f.bezna_cena is not null and f.bezna_cena > 0
            and po.puvodni_cena > 2 * f.bezna_cena));

-- View: puv_ok počítá lateral jednou – čistší než 4× inline.
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
  case when nej.puv_ok then nej.puvodni_zdroj end as puvodni_zdroj
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
