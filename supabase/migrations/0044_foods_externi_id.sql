-- foods.externi_id – ID produktu u zdrojového eshopu (Rohlík productId,
-- Košík id). Umožní zpětné obohacení nutričních hodnot přímo ze stránek
-- zdroje – spolehlivější než OFF (privátní značky v OFF nejsou).

alter table public.foods
  add column if not exists externi_id text;

create index if not exists foods_externi_id_idx
  on public.foods (externi_id)
  where externi_id is not null;

comment on column public.foods.externi_id is
  'ID produktu u zdrojového eshopu (rohlik productId / kosik id)';

-- Backfill z URL obrázku: cdn.rohlik.cz/images/grocery/products/{id}/…
-- nese productId přímo – pokryje 100 % rohlikových položek bez crawl.
update public.foods
set externi_id = substring(obrazek from 'products/(\d+)/')
where externi_id is null
  and obrazek ~ 'products/\d+/'
  and zdroj = 'eshop:rohlík.cz';
