// Zjistí, jestli suroviny receptů mají food_id v aktualni_ceny
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import pg from "pg";

process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"));
const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const pool = new pg.Pool({
  host: `aws-0-eu-west-2.pooler.supabase.com`,
  port: 6543,
  user: `postgres.${PROJECT_REF}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const { rows } = await pool.query(`
  select r.id as recept_id, r.nazev as recept, ri.food_id, f.nazev as food, f.schvaleno,
         exists(select 1 from public.aktualni_ceny ac where ac.food_id = ri.food_id) as v_cenach
  from public.recipes r
  join public.recipe_ingredients ri on ri.recipe_id = r.id
  left join public.foods f on f.id = ri.food_id
  order by r.nazev, ri.food_id
`);
for (const r of rows) console.log(`${r.recept_id.slice(0,8)} | ${r.recept.padEnd(38)} | food=${r.food ? r.food.padEnd(28) : 'MISSING'.padEnd(28)} | schvaleno=${r.schvaleno} | v_cenach=${r.v_cenach}`);
await pool.end();
