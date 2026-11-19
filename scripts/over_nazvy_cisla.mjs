// Kolik potravin má název začínající číslicí (EAN-zbytek)?
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import pg from "pg";

process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"));
const pool = new pg.Pool({
  host: `aws-0-eu-west-2.pooler.supabase.com`,
  port: 6543,
  user: `postgres.${process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb"}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
const { rows } = await pool.query(`
  select count(*)::int as pocet from public.foods where nazev ~ '^[0-9]'
`);
const { rows: vzorky } = await pool.query(`
  select nazev from public.foods where nazev ~ '^[0-9]' order by nazev limit 15
`);
console.log("počet:", rows[0].pocet);
for (const v of vzorky) console.log(" -", v.nazev);
await pool.end();
