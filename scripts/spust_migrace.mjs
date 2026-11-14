/**
 * spust_migrace.mjs – připojí se k Supabase Postgres a pustí
 * migrační + seed soubory v správném pořadí.
 *
 * Použití: node scripts/spust_migrace.mjs "<heslo-k-db>"
 * Heslo se NEUKLÁDÁ – jde jen jako argument procesu.
 *
 * Idempotentní: aplikované migrace se zapisují do public.om_migrace
 * a při dalším běhu se přeskakují. Migrace aplikované ještě před
 * zavedením tracking tabulky se poznají podle "already exists" chyby
 * a označí za aplikované (produktivní DB vzniklá ručně).
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

/** Tracking tabulka – které soubory už byly aplikovány. */
async function pripravTracking(klient) {
  await klient.query(`
    create table if not exists public.om_migrace (
      nazev text primary key,
      spusteno timestamptz not null default now()
    )
  `);
  const { rows } = await klient.query("select nazev from public.om_migrace");
  return new Set(rows.map((r) => r.nazev));
}

/** Chyby, které znamenají "migrace už byla aplikovaná mimo tracking". */
const UZ_EXISTUJE = /already exists|existuje|duplicate key|duplicate_object/i;

/** Pustí jeden SQL soubor v transakci; po úspěchu ho zapíše do om_migrace. */
async function pustMigraci(klient, soubor, nazev, aplikovane) {
  if (aplikovane.has(nazev)) {
    console.log(`⏭ ${nazev} – už aplikováno`);
    return;
  }
  const sql = readFileSync(resolve(SLOZKA, soubor), "utf8");
  console.log(`▶ ${nazev} (${sql.length} znaků)…`);
  try {
    await klient.query("begin");
    await klient.query(sql);
    await klient.query("insert into public.om_migrace(nazev) values ($1)", [nazev]);
    await klient.query("commit");
    console.log(`✔ ${nazev} – hotovo`);
  } catch (e) {
    await klient.query("rollback").catch(() => {});
    if (UZ_EXISTUJE.test(e.message)) {
      console.log(`~ ${nazev} – objekty už existují (aplikováno dříve), označuji`);
      await klient.query(
        "insert into public.om_migrace(nazev) values ($1) on conflict do nothing",
        [nazev],
      );
      return;
    }
    console.error(`✘ ${nazev} CHYBA: ${e.message}`);
    throw e;
  }
}

async function pustSoubor(soubor, popis) {
  const sql = readFileSync(resolve(SLOZKA, soubor), "utf8");
  console.log(`▶ ${popis} (${soubor}, ${sql.length} znaků)…`);
  await pool.query(sql);
  console.log(`✔ ${popis} – hotovo`);
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
  const klient = await pool.connect();
  try {
    const aplikovane = await pripravTracking(klient);
    const migrace = readdirSync(resolve(SLOZKA, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const soubor of migrace) {
      await pustMigraci(klient, `supabase/migrations/${soubor}`, soubor, aplikovane);
    }
  } finally {
    klient.release();
  }
  // seedy – vždy, samy jsou idempotentní (on conflict do nothing)
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
