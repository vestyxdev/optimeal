import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const db = new pg.Pool({host:"aws-0-eu-west-2.pooler.supabase.com",port:6543,user:"postgres.gduquvqofcohbjzzsicb",password:process.env.SUPABASE_DB_PASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});

// baseline = medián posledního pozorování na (food, retailer)
const {rows:rozsah} = await db.query(`
with posledni as (
  select distinct on (food_id, retailer_id) food_id, retailer_id, cena
  from price_observations
  order by food_id, retailer_id, pozorovano_at desc
),
baseline as (
  select food_id, percentile_cont(0.5) within group (order by cena) as med, count(*) n
  from posledni group by food_id
)
select b.n as n_obchodu,
       count(*) filter (where po.cena > 3*b.med) as nad3x,
       count(*) filter (where po.cena < 0.25*b.med) as pod4x,
       count(*) as obs
from price_observations po join baseline b on b.food_id=po.food_id
group by b.n order by b.n`);
console.log("=== outliery dle počtu obchodů s baseline:");
rozsah.forEach(r=>console.log(`  ${r.n_obchodu} obchodů: ${r.obs} obs, >3×: ${r.nad3x}, <0.25×: ${r.pod4x}`));

const {rows:ukazky} = await db.query(`
with posledni as (
  select distinct on (food_id, retailer_id) food_id, retailer_id, cena
  from price_observations
  order by food_id, retailer_id, pozorovano_at desc
),
baseline as (
  select food_id, percentile_cont(0.5) within group (order by cena) as med, count(*) n
  from posledni group by food_id
)
select f.nazev, po.cena::float, round(b.med::numeric,2)::float med, b.n, r.nazev obchod
from price_observations po
join baseline b on b.food_id=po.food_id
join foods f on f.id=po.food_id
left join retailers r on r.id=po.retailer_id
where b.n>=3 and (po.cena > 3*b.med or po.cena < 0.25*b.med)
order by abs(ln(po.cena/b.med)) desc limit 30`);
console.log("=== nejhorší outliery (>=3 obchodů):");
ukazky.forEach(r=>console.log(`  ${r.nazev} | ${r.cena} vs med ${r.med} | ${r.obchod} | ${r.n} obchodů`));

// kolik obs by zůstalo u foodů, kde je to jediný zdroj ceny?
const {rows:jediny} = await db.query(`
with posledni as (
  select distinct on (food_id, retailer_id) food_id, retailer_id, cena
  from price_observations
  order by food_id, retailer_id, pozorovano_at desc
),
baseline as (
  select food_id, percentile_cont(0.5) within group (order by cena) as med, count(*) n
  from posledni group by food_id
)
select count(distinct po.food_id)::int n_food
from price_observations po
join baseline b on b.food_id=po.food_id
where b.n>=3 and (po.cena > 3*b.med or po.cena < 0.25*b.med)`);
console.log("=== potraviny s aspoň 1 outlierem:", jediny[0].n_food);
await db.end();
