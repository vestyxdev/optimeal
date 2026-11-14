#!/usr/bin/env node
/**
 * backfill_baleni.mjs – doplní foods.baleni_g u existujícího katalogu.
 *
 * Dvě fáze:
 *  1) ZDARMA – parsování gramáže z názvu („TUC 100 g“, „2×250 g“, „1 kg",
 *     „0,5 l“). Pokryje velkou část bez jediného requestu.
 *  2) OFF API – pro zbylé řádky s EAN se dotáže product/{ean}.json
 *     na product_quantity/quantity. Zdvihavě ~1,3 req/s s retry.
 *
 * Idempotentní – běží jen nad baleni_g IS NULL, klidně se přeruší
 * a znovu spustí.
 *
 *   node scripts/backfill_baleni.mjs            # obě fáze
 *   node scripts/backfill_baleni.mjs --nazvy    # jen parsování názvů
 */
import pg from "pg";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(ROOT, ".env.local"));
} catch { /* .env.local nemusí existovat */ }

const JEN_NAZVY = process.argv.includes("--nazvy");
const HESLO = process.argv.slice(2).find((a) => !a.startsWith("-"))
  ?? process.env.SUPABASE_DB_PASSWORD;
if (!HESLO) {
  console.error("Chybí heslo: node scripts/backfill_baleni.mjs <heslo> nebo SUPABASE_DB_PASSWORD v .env.local");
  process.exit(1);
}
const PROJECT_REF = "gduquvqofcohbjzzsicb";
const UA = "OptiMeal/1.0 (katalog potravin; kontakt: optimeal-app)";

const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${PROJECT_REF}`,
  password: HESLO,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gramáž z názvu: „400 g", „1 kg", „0,5 l", „500 ml", „2×250 g". */
function gramazZNazvu(nazev) {
  const s = String(nazev);
  const multi = s.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|cl)\b/i);
  const m = multi ?? s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|cl)\b/i);
  if (!m) return null;
  const ks = multi ? Number(multi[1]) : 1;
  const val = Number(String(m[multi ? 2 : 1]).replace(",", "."));
  const jednotka = m[multi ? 3 : 2].toLowerCase();
  const nasobek = jednotka === "kg" || jednotka === "l" ? 1000 : jednotka === "cl" ? 10 : 1;
  const g = ks * val * nasobek;
  return g >= 2 && g <= 20000 ? Math.round(g) : null;
}

async function main() {
  const { rows } = await pool.query(
    "select id, nazev, ean from public.foods where baleni_g is null order by nazev",
  );
  console.log(`Bez baleni_g: ${rows.length} položek`);

  /* --- fáze 1: názvy --- */
  let zNazvu = 0;
  const davky = [];
  for (const r of rows) {
    const g = gramazZNazvu(r.nazev);
    if (g) davky.push({ id: r.id, g });
  }
  for (let i = 0; i < davky.length; i += 200) {
    const cast = davky.slice(i, i + 200);
    const vals = cast.map((_, j) => `($${j * 2 + 1}::uuid, $${j * 2 + 2}::numeric)`).join(",");
    const params = cast.flatMap((c) => [c.id, c.g]);
    const res = await pool.query(
      `update public.foods f set baleni_g = v.g
       from (values ${vals}) as v(id, g) where f.id = v.id and f.baleni_g is null`,
      params,
    );
    zNazvu += res.rowCount ?? 0;
  }
  console.log(`Fáze 1 (názvy): doplněno ${zNazvu} z ${rows.length}`);

  if (JEN_NAZVY) {
    console.log("Hotovo – pouze fáze názvů.");
    await pool.end();
    return;
  }

  /* --- fáze 2: OFF API podle EAN --- */
  const { rows: zbyvajici } = await pool.query(
    "select id, ean from public.foods where baleni_g is null and ean is not null order by nazev",
  );
  console.log(`Fáze 2 (OFF API): ${zbyvajici.length} EANů k dotazení`);

  let doplneno = 0;
  let bezDat = 0;
  let chyby = 0;
  for (let i = 0; i < zbyvajici.length; i++) {
    const { id, ean } = zbyvajici[i];
    try {
      const g = await dotazBaleni(ean);
      if (g) {
        await pool.query("update public.foods set baleni_g = $2 where id = $1", [id, g]);
        doplneno++;
      } else {
        bezDat++;
      }
    } catch {
      chyby++;
    }
    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${zbyvajici.length} – doplněno ${doplneno}, bez dat ${bezDat}, chyb ${chyby}`);
    }
    await sleep(750 + Math.random() * 500);
  }
  console.log(`Hotovo: API doplnilo ${doplneno}, bez dat ${bezDat}, chyb ${chyby}`);
  await pool.end();
}

async function dotazBaleni(ean, pokus = 0) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_quantity,quantity`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429 || r.status >= 500) {
      if (pokus < 4) {
        await sleep(4000 * (pokus + 1) + Math.random() * 2000);
        return dotazBaleni(ean, pokus + 1);
      }
      return null;
    }
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== 1 || !j.product) return null;
    const q = Number(j.product.product_quantity);
    if (Number.isFinite(q) && q >= 2 && q <= 20000) return q;
    return gramazZNazvu(j.product.quantity ?? "");
  } catch {
    if (pokus < 4) {
      await sleep(3000 * (pokus + 1));
      return dotazBaleni(ean, pokus + 1);
    }
    return null;
  }
}

main().catch(async (e) => {
  console.error("Fatální chyba:", e.message);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
