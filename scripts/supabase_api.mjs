/**
 * supabase_api.mjs – správa databáze přes oficiální Management API.
 *
 * Použití: node scripts/supabase_api.mjs "<PAT>" <prikaz> [soubor]
 * Příkazy:
 *   migrace            – všechny migrace z supabase/migrations + seedy
 *   overeni            – jen kontrolní dotazy
 *   soubor <cesta.sql> – spustí libovolný SQL soubor
 * PAT získáš na https://supabase.com/dashboard/account/tokens
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PAT = process.argv[2] ?? process.env.SUPABASE_PAT;
const PRIKAZ = process.argv[3] ?? "migrace";
const REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const SLOZKA = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (!PAT) {
  console.error("Použití: node scripts/supabase_api.mjs \"<PAT>\" <prikaz>");
  process.exit(1);
}

const API = "https://api.supabase.com/v1";

/** Spustí SQL přes Management API a vypíše výsledek. */
async function sql(dotaz, popis) {
  console.log(`▶ ${popis}`);
  const odpoved = await fetch(`${API}/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: dotaz }),
  });
  const data = await odpoved.json().catch(() => odpoved.text());
  if (!odpoved.ok) {
    console.error(`✘ ${popis} CHYBA (${odpoved.status}):`, JSON.stringify(data).slice(0, 500));
    throw new Error(popis);
  }
  console.log(`✔ ${popis} – hotovo`);
  return data;
}

try {
  if (PRIKAZ === "migrace") {
    // všechny migrace z supabase/migrations abecedně + oba seedy
    const migrace = readdirSync(resolve(SLOZKA, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const soubor of migrace) {
      const obsah = readFileSync(resolve(SLOZKA, `supabase/migrations/${soubor}`), "utf8");
      await sql(obsah, `Migrace ${soubor}`);
    }
    await sql(readFileSync(resolve(SLOZKA, "supabase/seed.sql"), "utf8"), "Seed (potraviny + ceny)");
    await sql(readFileSync(resolve(SLOZKA, "supabase/seed_recepty.sql"), "utf8"), "Seed (recepty)");
  }

  if (PRIKAZ === "soubor") {
    const cesta = process.argv[4];
    if (!cesta) {
      console.error("Použití: node scripts/supabase_api.mjs \"<PAT>\" soubor <relativni/cesta.sql>");
      process.exit(1);
    }
    const obsah = readFileSync(resolve(SLOZKA, cesta), "utf8");
    await sql(obsah, `SQL soubor ${cesta}`);
  }

  if (PRIKAZ === "migrace" || PRIKAZ === "overeni") {
    console.log("\n▶ Ověření…");
    const tabulky = await sql(
      `select table_name from information_schema.tables where table_schema='public' order by table_name`,
      "Tabulky",
    );
    console.log("Tabulky:", tabulky.map((r) => r.table_name).join(", "));

    const potraviny = await sql("select count(*)::int pocet from public.foods", "Počet potravin");
    console.log("Potraviny:", potraviny[0].pocet);

    const slevy = await sql(
      "select count(*)::int pocet from public.price_observations where je_sleva",
      "Aktivní slevy",
    );
    console.log("Slevy:", slevy[0].pocet);

    const politiky = await sql(
      "select count(*)::int pocet from pg_policies where schemaname='public'",
      "RLS politiky",
    );
    console.log("RLS politiky:", politiky[0].pocet);

    const aktualni = await sql(
      "select nazev, aktualni_cena, sleva, obchod from aktualni_ceny where sleva order by nazev limit 10",
      "Aktuální slevy (view)",
    );
    for (const r of aktualni) console.log(`  ${r.nazev}: ${r.aktualni_cena} Kč (${r.obchod})`);
  }

  console.log("\n✅ Hotovo.");
} catch {
  console.error("\n❌ Selhalo – viz chyba výše.");
  process.exitCode = 1;
}
