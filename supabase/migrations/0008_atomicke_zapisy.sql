-- ============================================================
-- 0008: ATOMICKÉ VÍCEKROKOVÉ ZÁPISY PŘES RPC
-- ------------------------------------------------------------
-- PostgREST nemá multi-table transakce – vkládání receptu +
-- surovin (nebo seznamu + položek, deaktivace + vložení cílů)
-- přes dva dotazy mohlo zanechat polovinu stavu. Tyto funkce
-- běží v jediné transakci, takže selhání jakékoli části vrátí
-- vše zpět.
--
-- SECURITY INVOKER záměrně: funkce běží pod volajícím, takže
-- auth.uid() je skutečný uživatel a RLS politiky platí dál.
-- Frontend zavolá rpc() první; když funkce není nasazená
-- (PGRST202), spadne zpět na kompenzovaný PostgREST zápis.
-- ============================================================

-- ---- a) vytvoření receptu + surovin ------------------------------
create or replace function public.uloz_recept(
  p_nazev text,
  p_popis text,
  p_kategorie text,
  p_porce smallint,
  p_cas_minuty smallint,
  p_postup text,
  p_suroviny jsonb  -- [{food_id, gramy_na_porce, poznamka}]
)
returns uuid
language plpgsql
security invoker set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.recipes
    (user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
  values
    (auth.uid(), p_nazev, p_popis, p_kategorie, p_porce, p_cas_minuty, p_postup, 'manual')
  returning id into v_id;

  insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
  select v_id,
         (s ->> 'food_id')::uuid,
         (s ->> 'gramy_na_porce')::numeric,
         s ->> 'poznamka'
  from jsonb_array_elements(coalesce(p_suroviny, '[]'::jsonb)) s;

  return v_id;
end;
$$;

-- ---- b) úprava receptu – hlavička + náhrada surovin ---------------
create or replace function public.uprav_recept(
  p_id uuid,
  p_nazev text,
  p_popis text,
  p_kategorie text,
  p_porce smallint,
  p_cas_minuty smallint,
  p_postup text,
  p_suroviny jsonb
)
returns void
language plpgsql
security invoker set search_path = public
as $$
begin
  update public.recipes
    set nazev = p_nazev,
        popis = p_popis,
        kategorie = p_kategorie,
        porce = p_porce,
        cas_minuty = p_cas_minuty,
        postup = p_postup
  where id = p_id;
  if not found then
    raise exception 'Recept nenalezen nebo k němu nemáte práva.';
  end if;

  delete from public.recipe_ingredients where recipe_id = p_id;

  insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce, poznamka)
  select p_id,
         (s ->> 'food_id')::uuid,
         (s ->> 'gramy_na_porce')::numeric,
         s ->> 'poznamka'
  from jsonb_array_elements(coalesce(p_suroviny, '[]'::jsonb)) s;
end;
$$;

-- ---- c) nákupní seznam + položky ---------------------------------
create or replace function public.uloz_nakupni_seznam(
  p_nazev text,
  p_plan_id uuid,
  p_polozky jsonb  -- [{food_id, nazev, gramy, cena_za_100g, obchod, je_sleva, kategorie}]
)
returns uuid
language plpgsql
security invoker set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.shopping_lists (user_id, nazev, plan_id)
  values (auth.uid(), p_nazev, p_plan_id)
  returning id into v_id;

  insert into public.shopping_list_items
    (list_id, food_id, nazev, gramy, cena_za_100g, obchod, je_sleva, kategorie)
  select v_id,
         (s ->> 'food_id')::uuid,
         s ->> 'nazev',
         round((s ->> 'gramy')::numeric)::integer,
         (s ->> 'cena_za_100g')::numeric,
         s ->> 'obchod',
         coalesce((s ->> 'je_sleva')::boolean, false),
         coalesce(s ->> 'kategorie', 'ostatni')
  from jsonb_array_elements(coalesce(p_polozky, '[]'::jsonb)) s;

  return v_id;
end;
$$;

-- ---- d) nová aktivní sada výživových cílů -------------------------
create or replace function public.uloz_cile(
  p_kalorie integer,
  p_bilkoviny integer,
  p_sacharidy integer,
  p_tuky integer,
  p_zdroj text
)
returns void
language plpgsql
security invoker set search_path = public
as $$
begin
  update public.nutrition_goals
    set aktivni = false
  where aktivni = true and user_id = auth.uid();

  insert into public.nutrition_goals
    (user_id, kalorie, bilkoviny, sacharidy, tuky, zdroj, aktivni)
  values
    (auth.uid(), p_kalorie, p_bilkoviny, p_sacharidy, p_tuky, p_zdroj, true);
end;
$$;

-- ---- granty (vzor z 0004/0007) -------------------------------------
revoke all on function public.uloz_recept(text, text, text, smallint, smallint, text, jsonb) from anon, public;
revoke all on function public.uprav_recept(uuid, text, text, text, smallint, smallint, text, jsonb) from anon, public;
revoke all on function public.uloz_nakupni_seznam(text, uuid, jsonb) from anon, public;
revoke all on function public.uloz_cile(integer, integer, integer, integer, text) from anon, public;

grant execute on function public.uloz_recept(text, text, text, smallint, smallint, text, jsonb) to authenticated;
grant execute on function public.uprav_recept(uuid, text, text, text, smallint, smallint, text, jsonb) to authenticated;
grant execute on function public.uloz_nakupni_seznam(text, uuid, jsonb) to authenticated;
grant execute on function public.uloz_cile(integer, integer, integer, integer, text) to authenticated;
