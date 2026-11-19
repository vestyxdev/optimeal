// Čerstvost pozorování per zdroj (retailer)
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
  select zdroj, count(*)::int as pocet, max(pozorovano_at) as posledni
  from public.price_observations
  where zdroj like 'scraper:%'
  group by zdroj order by zdroj
`);
for (const r of rows) console.log(`${r.zdroj.padEnd(18)} ${String(r.pocet).padStart(4)}  ${r.posledni}`);
await pool.end();
