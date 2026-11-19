// Detail potraviny 098235 Mini Original
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
const { rows } = await pool.query(
  `select id, nazev, ean, kategorie, zdroj, schvaleno, baleni_g, kalorie
   from public.foods where nazev ~ '^[0-9]{4,}' order by nazev`
);
for (const r of rows) console.log(JSON.stringify(r));
await pool.end();
