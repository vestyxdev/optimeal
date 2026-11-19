import pg from "pg";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"));
} catch {}
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
const { rows } = await pool.query(
  "select nazev, typ_jidla, mnozstvi_g, kalorie, bilkoviny, zapsano_dne from public.diary_entries order by created_at desc limit 5",
);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
