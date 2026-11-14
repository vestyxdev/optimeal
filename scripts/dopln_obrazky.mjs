/**
 * dopln_obrazky.mjs – doplní foods.obrazek z OpenFoodFacts.
 *
 * Pro každou potravinu bez obrázku zkusí OFF search podle názvu
 * a uloží image_small_url prvního použitelného výsledku.
 * Zdvořilý: ~2 dotazy/s, User-Agent s kontaktem.
 *
 * Použití: node scripts/dopln_obrazky.mjs "<heslo-k-db>"
 */

import pg from "pg";

const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const HESLO = process.argv[2];
if (!HESLO) {
  console.error('Použití: node scripts/dopln_obrazky.mjs "<heslo>"');
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

async function hledejNaDomene(nazev, host) {
  const url =
    `https://${host}/cgi/search.pl?search_terms=` +
    encodeURIComponent(nazev) +
    "&search_simple=1&action=process&json=1&page_size=5&fields=image_small_url,image_front_small_url,product_name";
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  for (const p of j.products ?? []) {
    const img = p.image_small_url ?? p.image_front_small_url;
    if (img) return img;
  }
  return null;
}

async function hledejObrazek(nazev) {
  // nejdřív globální index, pak český (tam je víc CZ produktů s českými názvy)
  return (await hledejNaDomene(nazev, "world.openfoodfacts.org")) ?? (await hledejNaDomene(nazev, "cz.openfoodfacts.org"));
}

const { rows: potraviny } = await pool.query(
  "select id, nazev from public.foods where obrazek is null order by nazev",
);
console.log(`${potraviny.length} potravin bez obrázku`);

let doplneno = 0;
for (const f of potraviny) {
  try {
    const img = await hledejObrazek(f.nazev);
    if (img) {
      await pool.query("update public.foods set obrazek = $1 where id = $2", [img, f.id]);
      doplneno++;
      console.log(`✔ ${f.nazev}`);
    } else {
      console.log(`– ${f.nazev} (OFF nic nenašel)`);
    }
  } catch (e) {
    console.log(`✘ ${f.nazev}: ${e.message}`);
  }
  await ceka(450);
}

console.log(`\n✅ Doplněno ${doplneno}/${potraviny.length} obrázků`);
await pool.end();
