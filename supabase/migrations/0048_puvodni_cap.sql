-- ============================================================
-- 0048: strop na původní cenu – artefakty špatné velikosti balení
-- ------------------------------------------------------------
-- Obohacení z kupi.cz detailu („běžně stojí X Kč") sem tam čte
-- běžnou cenu většího balení (multipack) a přiřadí ji k nabídce
-- menšího balení → původní cena je pak např. 9× akční (Bueno 43 g
-- „~~216 Kč~~" místo ~50 Kč). Skutečné letákové slevy bývají do
-- ~70 %; „původní" cena nad 4× akční je artefakt normalizace.
-- View proto puvodni_cena zveřejní jen do 4× aktuální ceny –
-- frontend pak u takové položky ukáže „běžně ~X" z mediánu
-- reálných pozorování místo vymyšlené přeškrtnuté ceny.
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
  coalesce(nej.cena, f.bezna_cena) as aktualni_cena,
  nej.retailer_id,
  r.nazev as obchod,
  (nej.je_sleva and (nej.platnost_do is null or nej.platnost_do >= current_date)) as sleva,
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
  end as sleva_procenta
from public.foods f
left join lateral (
  select po.cena, po.puvodni_cena, po.retailer_id, po.je_sleva,
         po.platnost_do, po.zdroj, po.pozorovano_at, po.baleni_g
  from public.price_observations po
  where po.food_id = f.id
    and (po.je_sleva = false or po.platnost_do is null or po.platnost_do >= current_date)
  order by
    (po.je_sleva and (po.platnost_do is null or po.platnost_do >= current_date)) desc,
    (po.cena < f.bezna_cena) desc,
    po.pozorovano_at desc
  limit 1
) nej on true
left join public.retailers r on r.id = nej.retailer_id
where f.schvaleno;
