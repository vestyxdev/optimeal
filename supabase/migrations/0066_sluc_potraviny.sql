-- 0066: Atomické sloučení duplicitních potravin.
-- Převede všechny FK odkazy z "loser" na "keeper" a loser smaže.
-- Spouští dedupe job (service role); anon/authenticated nemají přístup.

create or replace function public.sluc_potraviny(keeper uuid, loser uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prevedeno jsonb := '{}'::jsonb;
  v_n integer;
begin
  if keeper = loser then
    raise exception 'keeper a loser jsou stejna potravina';
  end if;
  if not exists (select 1 from foods where id = keeper) then
    raise exception 'keeper % neexistuje', keeper;
  end if;
  if not exists (select 1 from foods where id = loser) then
    raise exception 'loser % neexistuje', loser;
  end if;

  -- Cenová pozorování: nejdřív zahodit loserovo kopie, které kolidují
  -- s keeperovými (stejný retailer + čas → unique constraint)
  delete from price_observations po
  using price_observations kp
  where po.food_id = loser and kp.food_id = keeper
    and po.retailer_id is not distinct from kp.retailer_id
    and po.pozorovano_at = kp.pozorovano_at;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{price_observations_kolidujici}', to_jsonb(v_n));

  update price_observations set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{price_observations}', to_jsonb(v_n));

  -- Deník
  update diary_entries set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{diary_entries}', to_jsonb(v_n));

  -- Recepty
  update recipe_ingredients set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{recipe_ingredients}', to_jsonb(v_n));

  -- Nákupní seznamy
  update shopping_list_items set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{shopping_list_items}', to_jsonb(v_n));

  -- Spíž a stálice
  update pantry_items set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{pantry_items}', to_jsonb(v_n));

  update pinned_staples set food_id = keeper where food_id = loser;
  get diagnostics v_n = row_count;
  v_prevedeno := jsonb_set(v_prevedeno, '{pinned_staples}', to_jsonb(v_n));

  -- Doplnění chybějících údajů keepera z losera (jen prázdné hodnoty)
  update foods set
    ean = coalesce(foods.ean, l.ean),
    znacka = coalesce(foods.znacka, l.znacka),
    vlaknina = coalesce(foods.vlaknina, l.vlaknina),
    obrazek = coalesce(foods.obrazek, l.obrazek),
    baleni_g = coalesce(foods.baleni_g, l.baleni_g),
    alergeny = case
      when foods.alergeny is null or array_length(foods.alergeny, 1) is null then l.alergeny
      else foods.alergeny
    end
  from (select * from foods where id = loser) l
  where foods.id = keeper;

  delete from foods where id = loser;

  return v_prevedeno;
end;
$$;

comment on function public.sluc_potraviny is
  'Atomicky sloučí loser potravinu do keepera: převede FK odkazy, doplní chybějící údaje, loser smaže.';

revoke execute on function public.sluc_potraviny(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sluc_potraviny(uuid, uuid) to service_role;
