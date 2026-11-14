/**
 * dopln_ean.mjs – doplní foods.ean z OpenFoodFacts.
 *
 * Pro každou potravinu bez EAN zkusí OFF search podle názvu
 * (world → cz doména) a uloží čárový kód prvního použitelného
 * výsledku. Zlepšuje lokální lookup při skenování i scraper
 * matching (EAN-first).
 *
 * Použití: node scripts/dopln_ean.mjs "<heslo-k-db>"
 */

import pg from "pg";

const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const HESLO = process.argv[2];
if (!HESLO) {
  console.error('Použití: node scripts/dopln_ean.mjs "<heslo>"');
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

const UA = "OptiMeal/1.0 (optimeal-woad.vercel.app)";
const ceka = (ms) => new Promise((r) => setTimeout(r, ms));
const EAN = /^\d{8,14}$/;

async function hledejNaDomene(nazev, host) {
  const url =
    `https://${host}/cgi/search.pl?search_terms=` +
    encodeURIComponent(nazev) +
    "&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name";
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    for (const p of j.products ?? []) {
      if (typeof p.code === "string" && EAN.test(p.code)) return p.code;
    }
  } catch {
    /* cz doména občas vrací HTML místo JSON */
  }
  return null;
}

const { rows: potraviny } = await pool.query(
  "select id, nazev from public.foods where ean is null order by nazev",
);
console.log(`${potraviny.length} potravin bez EAN`);

let doplneno = 0;
for (const f of potraviny) {
  const ean =
    (await hledejNaDomene(f.nazev, "world.openfoodfacts.org")) ??
    (await hledejNaDomene(f.nazev, "cz.openfoodfacts.org"));
  if (ean) {
    await pool.query("update public.foods set ean = $1 where id = $2", [ean, f.id]);
    doplneno++;
    console.log(`✔ ${f.nazev} → ${ean}`);
  } else {
    console.log(`– ${f.nazev}`);
  }
  await ceka(450);
}

console.log(`\n✅ Doplněno ${doplneno}/${potraviny.length} EAN kódů`);
await pool.end();
