/**
 * spust_migrace.mjs – připojí se k Supabase Postgres a pustí
 * migrační + seed soubory v správném pořadí.
 *
 * Použití: node scripts/spust_migrace.mjs "<heslo-k-db>"
 * Heslo se NEUKLÁDÁ – jde jen jako argument procesu.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SLOZKA = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const HESLO = process.argv[2];

if (!HESLO) {
  console.error("Pouzití: node scripts/spust_migrace.mjs \"<heslo>\"");
  process.exit(1);
}

const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${PROJECT_REF}`,
  password: HESLO,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

/** SQL soubor rozdělí na samostatné příkazy (hlavičky funkcí nemají středníky navíc) */
async function pustSoubor(soubor, popis) {
  const sql = readFileSync(resolve(SLOZKA, soubor), "utf8");
  console.log(`▶ ${popis} (${soubor}, ${sql.length} znaků)…`);
  let klient;
  try {
    klient = await pool.connect();
    // celý soubor najednou – Postgres zvládne více příkazů v jednom query
    await klient.query(sql);
    console.log(`✔ ${popis} – hotovo`);
  } catch (e) {
    console.error(`✘ ${popis} CHYBA: ${e.message}`);
    console.error(e.stack);
    throw e;
  } finally {
    if (klient) klient.release();
  }
}

async function overeni() {
  console.log("\n▶ Ověření schématu…");
  const { rows } = await pool.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `);
  console.log("Tabulky:", rows.map((r) => r.table_name).join(", "));

  const { rows: potraviny } = await pool.query(
    "select count(*)::int as pocet from public.foods",
  );
  console.log("Potraviny v katalogu:", potraviny[0].pocet);

  const { rows: slevy } = await pool.query(
    "select count(*)::int as pocet from public.price_observations where je_sleva",
  );
  console.log("Aktivní slevy:", slevy[0].pocet);

  const { rows: politiky } = await pool.query(`
    select count(*)::int as pocet from pg_policies where schemaname = 'public'
  `);
  console.log("RLS politiky:", politiky[0].pocet);
}

try {
  // všechny migrace ve složce supabase/migrations, abecedně podle názvu
  const migrace = readdirSync(resolve(SLOZKA, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const soubor of migrace) {
    await pustSoubor(`supabase/migrations/${soubor}`, `Migrace ${soubor}`);
  }
  // seedy – idempotentní INSERT ON CONFLICT DO NOTHING
  await pustSoubor("supabase/seed.sql", "Seed (potraviny + ceny)");
  await pustSoubor("supabase/seed_recepty.sql", "Seed (recepty)");
  await overeni();
  console.log("\n✅ Databáze je připravená.");
} catch {
  console.error("\n❌ Migrace selhala – viz chyba výše.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
