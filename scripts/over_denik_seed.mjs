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
// seed: včera 1800 kcal, předevčírem 3600 kcal (nad cílem), dnes 540 kcal
const rows = [
  ["snidane", "Rohlík s máslem", 80, 320, 8, 50, 10, "2026-11-18"],
  ["obed", "Guláš s knedlíkem", 450, 320, 22, 40, 8, "2026-11-18"],
  ["vecere", "Šunkofleky", 300, 440, 18, 55, 16, "2026-11-18"],
  ["snidane", "Ovesná kaše", 250, 380, 13, 60, 8, "2026-11-17"],
  ["obed", "Svíčková", 400, 320, 20, 30, 12, "2026-11-17"],
  ["vecere", "Smažený sýr s hranolkami", 500, 420, 15, 40, 22, "2026-11-17"],
  ["snidane", "Kobliha", 90, 400, 5, 50, 20, "2026-11-19"],
];
for (const [typ, nazev, g, kcal, b, s, t, den] of rows) {
  await pool.query(
    "insert into public.diary_entries (user_id, nazev, typ_jidla, mnozstvi_g, kalorie, bilkoviny, sacharidy, tuky, zapsano_dne) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [uid, nazev, typ, g, kcal, b, s, t, den],
  );
}
console.log("seeded", rows.length);
await pool.end();
