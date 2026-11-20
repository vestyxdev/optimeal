import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const db = new pg.Pool({host:"aws-0-eu-west-2.pooler.supabase.com",port:6543,user:"postgres.gduquvqofcohbjzzsicb",password:process.env.SUPABASE_DB_PASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});

const {rows:a} = await db.query("select count(*)::int n from price_observations where podezrele");
console.log("=== podezrele obs:", a[0].n);

const {rows:b} = await db.query(`select f.nazev, po.cena::float, r.nazev obchod
  from price_observations po join foods f on f.id=po.food_id left join retailers r on r.id=po.retailer_id
  where po.podezrele order by po.cena desc limit 15`);
b.forEach(r=>console.log("  flag:", r.nazev, "|", r.cena, "Kč/100g |", r.obchod));

// Mléko – view teď musí ukázat rozumnou cenu
const {rows:c} = await db.query(`select nazev, aktualni_cena, obchod, baleni_g from aktualni_ceny where nazev='Mléko'`);
console.log("=== view Mléko:", JSON.stringify(c));

// kolik potravin ztratilo VŠECHNA pozorování (view padá na bezna_cena)
const {rows:d} = await db.query(`select count(distinct po.food_id)::int n
  from price_observations po
  where po.podezrele
    and not exists (select 1 from price_observations x where x.food_id=po.food_id and not x.podezrele)`);
console.log("=== potraviny, které přišly o všechna pozorování:", d[0].n);

// trigger funguje? testovací insert na potravinu s baseline (Mléko)
const {rows:m} = await db.query(`select id from foods where nazev='Mléko' limit 1`);
if (m[0]) {
  const {rows:r5} = await db.query(`insert into price_observations(food_id,retailer_id,cena,zdroj,pozorovano_at)
    select $1, retailer_id, 999, 'test:trigger', now() from price_observations where food_id=$1 limit 1
    returning podezrele`, [m[0].id]);
  console.log("=== trigger test (cena 999):", r5[0]);
  await db.query(`delete from price_observations where zdroj='test:trigger'`);
}
await db.end();
