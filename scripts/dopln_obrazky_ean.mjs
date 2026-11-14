/**
 * dopln_obrazky_ean.mjs – doplní foods.obrazek přes Product API podle EAN.
 *
 * Potraviny, které mají ean ale nemají obrazek, se dotáží OFF
 * product API přímo na čárový kód – přesnější než hledání jménem.
 *
 * Použití: node scripts/dopln_obrazky_ean.mjs "<heslo-k-db>"
 */

import pg from "pg";

const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const HESLO = process.argv[2];
if (!HESLO) {
  console.error('Použití: node scripts/dopln_obrazky_ean.mjs "<heslo>"');
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

const { rows: potraviny } = await pool.query(
  "select id, nazev, ean from public.foods where ean is not null and obrazek is null order by nazev",
);
console.log(`${potraviny.length} potravin s EAN bez obrázku`);

let doplneno = 0;
for (const f of potraviny) {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${f.ean}?fields=image_small_url,image_front_small_url,image_url`,
      { headers: { "User-Agent": UA } },
    );
    const j = r.ok ? await r.json() : null;
    const img = j?.product?.image_small_url ?? j?.product?.image_front_small_url ?? j?.product?.image_url ?? null;
    if (img) {
      await pool.query("update public.foods set obrazek = $1 where id = $2", [img, f.id]);
      doplneno++;
      console.log(`✔ ${f.nazev}`);
    } else {
      console.log(`– ${f.nazev}`);
    }
  } catch (e) {
    console.log(`✘ ${f.nazev}: ${e.message}`);
  }
  await ceka(450);
}

console.log(`\n✅ Doplněno ${doplneno}/${potraviny.length} obrázků přes EAN`);
await pool.end();
