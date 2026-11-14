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

// Slova, která OFF při hledání spíš mate – zkusíme i zjednodušený dotaz.
const VYPUSTIT = /\b(baby|polotučn\w+|tučn\w+|odstředěn\w+|celozrnn\w+|přírodní|natural|konzerv\w+|filet|filety|čerstv\w+|mražen\w+|sušen\w+|jemn\w+|hrub\w+|instantn\w+|bez\s+\w+|\d+([,.]\d+)?\s*%|\d+\s*g)\b/giu;

// Anglické aliasy pro základní potraviny, které český název nenajde.
const ALIASY = {
  vejce: "eggs",
  špagety: "spaghetti",
  těstoviny: "whole wheat pasta",
  tofu: "tofu",
  špenát: "spinach",
  ořechy: "walnuts",
  treska: "cod fillet",
  jogurt: "greek yogurt",
  skyr: "skyr",
  rýže: "basmati rice",
  česnek: "garlic",
  quinoa: "quinoa",
  chléb: "wholemeal bread",
  fazole: "kidney beans",
  svíčková: "beef sirloin",
  hrách: "peas",
  krabí: "surimi",
  kuřecí: "chicken thighs",
  piškoty: "ladyfingers",
  "sojové mléko": "soy milk",
  rajče: "rajčata",
};

function variantyNazvu(nazev) {
  const zjednoduseny = nazev.replace(VYPUSTIT, " ").replace(/\s+/g, " ").trim();
  const varianty = [nazev];
  if (zjednoduseny && zjednoduseny.toLowerCase() !== nazev.toLowerCase())
    varianty.push(zjednoduseny);
  // přehozené pořadí slov („Chléb celozrnný" → „celozrnný chléb")
  const slova = nazev.split(/\s+/);
  if (slova.length === 2) varianty.push(`${slova[1]} ${slova[0]}`);
  const klic = Object.keys(ALIASY).find((k) => nazev.toLowerCase().includes(k));
  if (klic) varianty.push(ALIASY[klic]);
  return varianty;
}

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
  let ean = null;
  for (const dotaz of variantyNazvu(f.nazev)) {
    ean =
      (await hledejNaDomene(dotaz, "world.openfoodfacts.org")) ??
      (await hledejNaDomene(dotaz, "cz.openfoodfacts.org"));
    if (ean) break;
    await ceka(250);
  }
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
