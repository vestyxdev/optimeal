-- 0067: Server-side prohlížení katalogu – stránkování + filtry + řazení.
-- Při 20k+ potravinách po OFF sklizni je full preload do klienta neúnosný;
-- tato RPC vrací jednu stránku + celkový počet. Security invoker: RLS
-- pohledu aktualni_ceny zůstává v platnosti.

create or replace function public.katalog_stranka(
  p_dotaz text default null,
  p_kategorie text default null,
  p_jen_slevy boolean default false,
  p_zero boolean default false,
  p_protein boolean default false,
  p_razeni text default 'relevance',
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  food_id uuid, nazev text, kategorie text,
  bilkoviny numeric, sacharidy numeric, tuky numeric, kalorie numeric,
  bezna_cena numeric, aktualni_cena numeric, obchod text,
  sleva boolean, platnost_do timestamptz, zdroj_ceny text,
  pozorovano_at timestamptz, vytvoril uuid, zdroj_potraviny text,
  alergeny text[], alergeny_stopy text[], diety text[], ean text,
  obrazek text, baleni_g numeric, baleni_label text,
  puvodni_cena numeric, sleva_procenta numeric, puvodni_zdroj text,
  vlaknina numeric, znacka text,
  celkem bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with vstup as (
    select
      nullif(btrim(p_dotaz), '') as dotaz,
      nullif(regexp_replace(coalesce(p_dotaz, ''), '[\s-]', '', 'g'), '') as ean_dotaz
  ),
  filtr as (
    select ac.*,
      case
        when vstup.dotaz is null then 0
        when public.om_norm(ac.nazev) ilike public.om_norm(vstup.dotaz) || '%' then 3
        when public.om_norm(ac.nazev) ilike '% ' || public.om_norm(vstup.dotaz) || '%' then 2
        when public.om_norm(ac.nazev) ilike '%' || public.om_norm(vstup.dotaz) || '%' then 1
        else 0
      end as rank_shody,
      case when vstup.dotaz is not null
        then similarity(public.om_norm(ac.nazev), public.om_norm(vstup.dotaz))
        else 0
      end as sim
    from aktualni_ceny ac, vstup
    where
      (p_kategorie is null or ac.kategorie = p_kategorie)
      and (not p_jen_slevy or ac.sleva)
      and (not p_zero or ac.nazev ~* 'zero|bez cukru|sugar\s?free|neochucen')
      and (not p_protein or ac.bilkoviny >= 15)
      and (
        -- při hledání je záměr uživatele důležitější než heuristika
        vstup.dotaz is not null
        -- procházení bez dotazu: nepotraviny (drogerie/kosmetika z feedů)
        -- schovat, kromě vejce s omega-3. PG regex nemá lookahead –
        -- plet(?!ýn) řeší samostatná větev.
        or not (
          ac.nazev ~* 's[ée]rum|pleťov|kosmeti|šampon|m[ýy]dl|dezinfek|parf[ée]m|toaletn|prac[íi]\s|detergent|dopln[ěe]k stravy|tableta|kapsl|vitam[íi]n|probiotik|kolagen|omega.?3|hořčík|magnez|veterin[áa]r|granule pro|krmiv|pipet|antiparazit|odčerv|substr[aá]t|hnojiv|podest[ýy]l|pokojov[ée] rostlin|tr[áa]vn[íi]k|zahradni[čc]|insekticid|pesticid'
          or (ac.nazev ~* 'plet' and ac.nazev !~* 'pletýn')
        )
        or ac.nazev ~* 'vejc'
      )
      and (
        vstup.dotaz is null
        or public.om_norm(ac.nazev) ilike '%' || public.om_norm(vstup.dotaz) || '%'
        or public.om_norm(ac.nazev) % public.om_norm(vstup.dotaz)
        or (vstup.ean_dotaz ~ '^\d{4,14}$' and ac.ean is not null and ac.ean like '%' || vstup.ean_dotaz || '%')
      )
  )
  select
    f.food_id, f.nazev, f.kategorie, f.bilkoviny, f.sacharidy, f.tuky, f.kalorie,
    f.bezna_cena, f.aktualni_cena, f.obchod, f.sleva, f.platnost_do, f.zdroj_ceny,
    f.pozorovano_at, f.vytvoril, f.zdroj_potraviny, f.alergeny, f.alergeny_stopy,
    f.diety, f.ean, f.obrazek, f.baleni_g, f.baleni_label, f.puvodni_cena,
    f.sleva_procenta, f.puvodni_zdroj, f.vlaknina, f.znacka,
    count(*) over() as celkem
  from filtr f
  order by
    -- relevance při hledání: rank shody, pak trigramová podobnost
    case when p_razeni = 'relevance' then -f.rank_shody end asc nulls last,
    case when p_razeni = 'relevance' then -f.sim end asc nulls last,
    -- potraviny bez nutric nakonec (kromě řazení na výživu – tam je to jedno)
    case when p_razeni not in ('bilkoviny', 'kcal') then (f.kalorie <= 0)::int end asc nulls last,
    case when p_razeni = 'cena'
      then f.aktualni_cena * coalesce(nullif(f.baleni_g, 0), 1000) / 100 end asc nulls last,
    case when p_razeni = 'jednotkova' then f.aktualni_cena end asc nulls last,
    case when p_razeni = 'sleva' then coalesce(f.sleva_procenta, -1) end desc nulls last,
    case when p_razeni = 'bilkovinyCena'
      then case when f.aktualni_cena > 0 then f.bilkoviny / f.aktualni_cena end end desc nulls last,
    case when p_razeni = 'bilkoviny' then f.bilkoviny end desc nulls last,
    case when p_razeni = 'kcal' then f.kalorie end asc nulls last,
    f.nazev asc
  limit p_limit
  offset p_offset;
$$;

comment on function public.katalog_stranka is
  'Stránkované prohlížení katalogu: trigram+substring hledání, kategorie, slevy, čipy, řazení. Vrací celkem pro stránkování.';

grant execute on function public.katalog_stranka(text, text, boolean, boolean, boolean, text, int, int) to anon, authenticated;
