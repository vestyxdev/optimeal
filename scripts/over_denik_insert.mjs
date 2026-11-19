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
const u = await pool.query("select id from auth.users where email = 'kaja@demo.optimeal.cz'");
const uid = u.rows[0].id;
const r = await pool.query(
  "insert into public.diary_entries (user_id, nazev, typ_jidla, mnozstvi_g, kalorie, bilkoviny, sacharidy, tuky) values ($1,'Testovací rohlík','snidane',80,270,9,53,3) returning id, mnozstvi_g, zapsano_dne",
  [uid],
);
console.log(JSON.stringify(r.rows));
await pool.end();
