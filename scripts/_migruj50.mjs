import { readFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env.local");
const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb"}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync("supabase/migrations/0050_puvodni_zdroj.sql", "utf8");
try {
  await pool.query("begin");
  await pool.query(sql);
  await pool.query(
    "insert into public.om_migrace(nazev) values ('0050_puvodni_zdroj.sql') on conflict do nothing",
  );
  await pool.query("commit");
  console.log("migrace OK");
  const { rows } = await pool.query(
    "select coalesce(puvodni_zdroj,'<null>') z, count(*)::int n from public.price_observations where puvodni_cena is not null group by 1 order by 2 desc",
  );
  console.log("provenance:", JSON.stringify(rows));
  const { rows: v } = await pool.query(
    "select count(*)::int slev, count(puvodni_zdroj)::int s_prov from public.aktualni_ceny where sleva",
  );
  console.log("view:", JSON.stringify(v));
} catch (e) {
  console.error("ERR", e.message);
  try { await pool.query("rollback"); } catch {}
  process.exitCode = 1;
} finally {
  await pool.end();
}
