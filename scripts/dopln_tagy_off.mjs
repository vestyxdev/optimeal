// dopln_tagy_off.mjs – dohledá chybějící alergeny/diety přes OpenFoodFacts
// API podle EAN (pro položky bez tagů; OFF allergens+traces+analysis+labels
// je autoritativnější než jmenná heuristika z dopln_tagy.mjs).
// ADITIVNÍ: pouze přidává tagy; ~1 dotaz/s (OFF fair use); obnovitelné
// přes stavový soubor (bezpečné přerušit a spustit znovu).
// Použití: node scripts/dopln_tagy_off.mjs [--dry] [--limit N]
import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb", password: heslo,
  database: "postgres", ssl: { rejectUnauthorized: false }, max: 2,
});

const DRY = process.argv.includes("--dry");
const STOPY = process.argv.includes("--stopy");
const LIM = +(process.argv.find((a) => a.startsWith("--limit"))?.split("=")[1] ?? 0);
const STATE = STOPY
  ? "scripts/.dopln_stopy_off.state.json"
  : "scripts/.dopln_tagy_off.state.json";

/** OFF alergeny → naše EU-14 klíče (kopie z ingest_off.mjs). */
const MAPA_ALERGENU = {
  "en:gluten": "lepek", "en:crustaceans": "korisi", "en:eggs": "vejce",
  "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
  "en:milk": "mleko", "en:nuts": "orisky", "en:celery": "skorocel",
  "en:mustard": "horcice", "en:sesame-seeds": "sezam",
  "en:sulphur-dioxide-and-sulphites": "sulfit", "en:lupin": "lupina",
  "en:molluscs": "vodnany",
};

function tagyZ(prod) {
  const mapuj = (t) => t.map((x) => MAPA_ALERGENU[x]).filter(Boolean);
  const ingredience = new Set(mapuj(prod.allergens_tags ?? []));
  // stopy ⊆ alergeny – co je ingredience, není „jen stopa"
  const stopy = new Set(mapuj(prod.traces_tags ?? []).filter((t) => !ingredience.has(t)));
  const alergeny = new Set([...ingredience, ...stopy]);
  const anal = new Set(prod.ingredients_analysis_tags ?? []);
  const labels = new Set(prod.labels_tags ?? []);
  const diety = new Set();
  if (anal.has("en:vegan") || labels.has("en:vegan")) { diety.add("vegansky"); diety.add("vegetariansky"); }
  else if (anal.has("en:vegetarian") || labels.has("en:vegetarian")) diety.add("vegetariansky");
  if (labels.has("en:gluten-free") && !alergeny.has("lepek")) diety.add("bezlepkovy");
  return { alergeny, stopy, diety };
}

const hotovo = new Set();
try {
  for (const ean of JSON.parse(fs.readFileSync(STATE, "utf8"))) hotovo.add(ean);
} catch { /* nový běh */ }

const { rows } = await pool.query(
  STOPY
    ? // --stopy: zpětně doplnit alergeny_stopy u všech EAN řádků,
      //   které ještě stopová data nemají (starší backfill sloučil
      //   traces do alergeny bez rozlišení)
      `select id, nazev, ean, alergeny, diety from public.foods
       where ean is not null
         and cardinality(alergeny_stopy) = 0
       order by id`
    : `select id, nazev, ean, alergeny, diety from public.foods
       where ean is not null
         and (cardinality(alergeny) = 0 or cardinality(diety) = 0)
       order by id`,
);
const fronta = rows.filter((r) => !hotovo.has(r.ean)).slice(0, LIM || undefined);
console.log(`K dotázání: ${fronta.length} EAN (celkem ${rows.length}, hotovo ${hotovo.size})`);

let nalezeno = 0, aktualizovano = 0, chyby = 0, poRade = 0;
const statAlg = new Map(), statDiet = new Map();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

for (const [i, row] of fronta.entries()) {
  if (i > 0) await sleep(1200);
  let prod = null, vyrizeno = false;
  // 429/5xx/timeout → backoff a retry; definitivní odpověď (200 i 404) = hotovo
  for (let pokus = 0; pokus < 3 && !vyrizeno; pokus++) {
    if (pokus > 0) await sleep(8000 * pokus);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${row.ean}.json?fields=code,allergens_tags,traces_tags,ingredients_analysis_tags,labels_tags`,
        { headers: { "User-Agent": "OptiMeal/1.0 (optimeal; contact via github)" },
          signal: AbortSignal.timeout(15_000) });
      if (res.status === 429 || res.status >= 500) { chyby++; continue; }
      vyrizeno = true;
      if (res.ok) {
        const j = await res.json();
        if (j.status === 1) prod = j.product;
      }
    } catch { chyby++; }
  }
  if (!vyrizeno) {
    if (++poRade >= 15) {
      console.error("OFF opakovaně nedostupné – ukončuji; postup je uložen, spusťte později.");
      break;
    }
  } else {
    poRade = 0;
    hotovo.add(row.ean);
  }
  if (prod) {
    nalezeno++;
    const { alergeny, stopy, diety } = tagyZ(prod);
    if (STOPY) {
      // doplň stopové pole; alergeny se UNIONí se stopami –
      // invariant stopy ⊆ alergeny musí platit (varování konzervativní)
      if (stopy.size > 0) {
        const alg = [...new Set([...(row.alergeny ?? []), ...stopy])];
        if (!DRY) {
          await pool.query(
            "update public.foods set alergeny_stopy=$2, alergeny=$3 where id=$1",
            [row.id, [...stopy], alg],
          );
        }
        for (const a of stopy) statAlg.set(a, (statAlg.get(a) ?? 0) + 1);
        aktualizovano++;
      }
    } else {
      const noveAlg = [...alergeny].filter((a) => !(row.alergeny ?? []).includes(a));
      const noveDiet = [...diety].filter((d) => !(row.diety ?? []).includes(d));
      const noveStopy = [...stopy];
      if (noveAlg.length > 0 || noveDiet.length > 0 || noveStopy.length > 0) {
        const alg = [...new Set([...(row.alergeny ?? []), ...noveAlg])];
        const diet = [...new Set([...(row.diety ?? []), ...noveDiet])];
        for (const a of noveAlg) statAlg.set(a, (statAlg.get(a) ?? 0) + 1);
        for (const d of noveDiet) statDiet.set(d, (statDiet.get(d) ?? 0) + 1);
        if (!DRY) {
          await pool.query(
            "update public.foods set alergeny=$2, alergeny_stopy=$3, diety=$4 where id=$1",
            [row.id, alg, noveStopy, diet],
          );
        }
        aktualizovano++;
      }
    }
  }
  // checkpoint podle iterace – i při nízkém výnosu je postup trvale uložen
  if ((i + 1) % 50 === 0) {
    fs.writeFileSync(STATE, JSON.stringify([...hotovo]));
    console.log(`  …${i + 1}/${fronta.length} | nalezeno ${nalezeno} | aktualizováno ${aktualizovano}`);
  }
}

fs.writeFileSync(STATE, JSON.stringify([...hotovo]));
console.log(`\nHotovo: ${fronta.length} dotázáno | OFF našlo ${nalezeno} | doplněno tagů u ${aktualizovano} | chyby sítě ${chyby}`);
console.log("alergeny:", [...statAlg.entries()].map(([k, n]) => `${k}+${n}`).join("  ") || "—");
console.log("diety:", [...statDiet.entries()].map(([k, n]) => `${k}+${n}`).join("  ") || "—");
console.log(DRY ? "DRY-RUN – bez --dry se zapíše." : "");
await pool.end();
