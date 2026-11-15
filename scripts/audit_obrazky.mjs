#!/usr/bin/env node
/**
 * audit_obrazky.mjs – ověří obrázky seed/manuálních potravin.
 *
 * Starý backfill přiřazoval obrazek podle EAN/názvu – u kolizí
 * (Brambory ↔ Chléb) skončila u potraviny cizí fotka. Skript
 * z URL obrázku vytáhne OFF kód produktu, dotáže se na jeho
 * jméno a pokud se neshoduje s naším názvem, obrázek i EAN
 * vyčistí (raději placeholder než špatná fotka).
 *
 *   node scripts/audit_obrazky.mjs          # jen report
 *   node scripts/audit_obrazky.mjs --fix    # report + opravy v DB
 */
import pg from "pg";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(join(ROOT, ".env.local")); } catch { /* noop */ }

const FIX = process.argv.includes("--fix");
const HESLO = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? process.env.SUPABASE_DB_PASSWORD;
if (!HESLO) { console.error("Chybí heslo (arg nebo SUPABASE_DB_PASSWORD)"); process.exit(1); }

const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: HESLO,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** OFF image URL → kód produktu (images/products/859/400/764/2735/...). */
function kodZObrazku(url) {
  const m = String(url).match(/products\/(\d{3})\/(\d{3})\/(\d{3})\/(\d{4,})\//);
  return m ? m.slice(1).join("") : null;
}

/** Přísná shoda: jeden název obsahuje druhý (i bez mezer), nebo ≥60% společných slov. */
function podobne(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const naBez = na.replace(/\s/g, "");
  const nbBez = nb.replace(/\s/g, "");
  if (naBez.includes(nbBez) || nbBez.includes(naBez)) return true;
  const sa = new Set(na.split(" "));
  const sb = nb.split(" ");
  const spolecna = sb.filter((w) => sa.has(w)).length;
  return spolecna / sb.length >= 0.6;
}

async function jmenoProduktu(kod, pokus = 0) {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${kod}.json?fields=product_name,product_name_cs,generic_name`,
      { headers: { "User-Agent": "OptiMeal/1.0 (audit obrazku)" } },
    );
    if ((r.status === 429 || r.status >= 500) && pokus < 4) {
      await sleep(4000 * (pokus + 1));
      return jmenoProduktu(kod, pokus + 1);
    }
    if (!r.ok) return null;
    const j = await r.json();
    const p = j.product ?? {};
    return p.product_name_cs || p.product_name || p.generic_name || null;
  } catch {
    if (pokus < 4) { await sleep(3000 * (pokus + 1)); return jmenoProduktu(kod, pokus + 1); }
    return null;
  }
}

async function main() {
  const { rows } = await pool.query(
    "select id, nazev, ean, obrazek from public.foods where zdroj <> 'openfoodfacts' and obrazek is not null order by nazev",
  );
  console.log(`Kontroluji ${rows.length} seed/manuálních obrázků…`);

  // kolize: stejná fotka u více potravin = určitě špatně u některé
  const poObrazku = new Map();
  rows.forEach((r) => poObrazku.set(r.obrazek, [...(poObrazku.get(r.obrazek) ?? []), r.nazev]));

  let ok = 0, spatne = 0, neovereno = 0;
  for (const r of rows) {
    const kod = kodZObrazku(r.obrazek);
    const sdilena = (poObrazku.get(r.obrazek) ?? []).length > 1;
    if (!kod) {
      neovereno++;
      console.log(`  ? ${r.nazev} – URL bez kódu, nelze ověrit`);
      continue;
    }
    const off = await jmenoProduktu(kod);
    await sleep(800);
    if (off === null) {
      neovereno++;
      console.log(`  ? ${r.nazev} – OFF nenašel ${kod}${sdilena ? " (SDÍLENÁ FOTKA)" : ""}`);
      continue;
    }
    if (sdilena && !podobne(r.nazev, off)) {
      // sdílená fotka + cizí jméno = jistá korupce (Brambory→chléb)
      spatne++;
      console.log(`  ✗ ${r.nazev}  →  OFF: „${off}" (SDÍLENÁ FOTKA – čistím)`);
      if (FIX) {
        await pool.query("update public.foods set obrazek = null, ean = null where id = $1", [r.id]);
      }
    } else if (!podobne(r.nazev, off)) {
      // nesdílená + cizojazyčné jméno = pravděpodobně OK fotka jiného produktu, jen nahlásit
      neovereno++;
      console.log(`  ~ ${r.nazev}  →  OFF: „${off}" (jazyková neshoda – pravděpodobně OK)`);
    } else {
      ok++;
    }
  }
  console.log(`\nVýsledek: ${ok} OK, ${spatne} špatných, ${neovereno} neověřených${FIX ? " – opraveno" : " (spusť --fix pro opravu)"}`);
  await pool.end();
}

main().catch(async (e) => { console.error("Fatální chyba:", e.message); await pool.end(); process.exit(1); });
