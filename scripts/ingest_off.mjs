/**
 * ingest_off.mjs — hromadný import katalogu z Open Food Facts (CZ)
 * ---------------------------------------------------------------
 * Páruje produkty dostupné na českém trhu na tabulku public.foods:
 *   - název (cs priorita), makra /100 g, EAN, obrázek, alergeny, diety
 *   - kategorie mapovaná z OFF categories_tags do našich 6 skupin
 *   - deduplikace: EAN (unikátní index 0011) → normalizovaný název
 *   - bezna_cena = 0 (OFF ceny nemá – ceny doplní scraper/Open Prices)
 *
 * Běží neomezeně dlouho: stránkuje po KATEGORIÍCH (OFF hluboké
 * stránkování umí max ~10k výsledků na dotaz). Stav ukládá do
 * scripts/_ingest_off_state.json – skript lze kdykoli restartovat.
 *
 * Použití: node scripts/ingest_off.mjs [--limit N] [--delay MS]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SLOZKA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = resolve(SLOZKA, "scripts/_ingest_off_state.json");

try {
  process.loadEnvFile(resolve(SLOZKA, ".env.local"));
} catch { /* heslo může přijít i z prostředí */ }

const ARGS = process.argv.slice(2);
const PROJECT_REF = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const HESLO = process.env.SUPABASE_DB_PASSWORD ?? (ARGS[0] && !ARGS[0].startsWith("-") ? ARGS[0] : undefined);
if (!HESLO) {
  console.error("Chybí SUPABASE_DB_PASSWORD (.env.local) nebo heslo jako argument.");
  process.exit(1);
}
const argNum = (jmeno, vychozi) => {
  const i = ARGS.indexOf(jmeno);
  return i >= 0 && ARGS[i + 1] ? Number(ARGS[i + 1]) : vychozi;
};
const LIMIT = argNum("--limit", Infinity); // celkový strop vložených
const DELAY = argNum("--delay", 1300);     // ms mezi požadavky (slušnost vůči OFF)
const PAGE_SIZE = 100;

/* ============================================================
 * OFF API – stránkování po kategoriích
 * ============================================================ */

const OFF_API = "https://world.openfoodfacts.org/cgi/search.pl";
const UA = "OptiMeal/2.0 (+https://github.com/vestyxdev/optimeal; katalog)";

/** Kategorie OFF, kterými pokrýváme celý český trh (každá < ~10k). */
const OFF_KATEGORIE = [
  "dairies", "milks", "cheeses", "yogurts", "butters", "fermented-milk-products", "creams", "desserts",
  "meats", "poultries", "meat-products", "sausages", "fishes", "seafood", "frozen-meats",
  "fruits", "vegetables", "fresh-fruits", "fresh-vegetables", "frozen-fruits", "frozen-vegetables",
  "breads", "pastries", "breakfast-cereals", "cereals-and-their-products", "flours", "rices", "grains",
  "pastas", "noodles", "biscuits-and-cakes", "biscuits", "wafers", "crackers", "cakes",
  "snacks", "chips-and-fries", "nuts", "seeds", "dried-fruits", "cereal-bars", "mueslis",
  "beverages", "waters", "fruit-juices", "sodas", "plant-milks", "teas", "coffees", "energy-drinks",
  "canned-foods", "legumes", "sauces", "soups", "spreads", "jams", "honeys",
  "chocolates", "confectioneries", "sweets", "ice-creams-and-sorbets",
  "oils", "fats", "vinegars", "spices", "condiments", "ready-meals", "frozen-ready-made-meals",
  "baby-foods", "protein-foods", "food-supplements", "sugar", "sweeteners",
];

const FIELDS = [
  "code", "product_name", "product_name_cs", "brands",
  "nutriments", "nutrition_data_per",
  "allergens_tags", "ingredients_analysis_tags", "labels_tags",
  "categories_tags", "image_url", "image_small_url", "image_front_url", "image_front_small_url",
  "quantity", "completeness", "unique_scans_n",
].join(",");

async function fetchStrana(kategorie, strana, pokus = 0) {
  const params = new URLSearchParams({
    action: "process",
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: "Czechia",
    tagtype_1: "categories",
    tag_contains_1: "contains",
    tag_1: kategorie,
    sort_by: "unique_scans_n",
    page_size: String(PAGE_SIZE),
    page: String(strana),
    fields: FIELDS,
    json: "1",
  });
  try {
    const r = await fetch(`${OFF_API}?${params}`, { headers: { "User-Agent": UA } });
    if (r.status === 429 || r.status >= 500) {
      if (pokus < 5) {
        const wait = 5000 * (pokus + 1) + Math.random() * 3000;
        console.log(`  ⏳ HTTP ${r.status} – čekám ${Math.round(wait / 1000)}s (pokus ${pokus + 1})`);
        await sleep(wait);
        return fetchStrana(kategorie, strana, pokus + 1);
      }
      throw new Error(`HTTP ${r.status} po 5 pokusech`);
    }
    if (!r.ok) return { products: [], count: 0 };
    return await r.json();
  } catch (e) {
    if (pokus < 5 && !/HTTP \d+ po/.test(e.message)) {
      await sleep(4000 * (pokus + 1));
      return fetchStrana(kategorie, strana, pokus + 1);
    }
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
 * Normalizace
 * ============================================================ */

const stripDiakritika = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normalizovaný klíč pro deduplikaci názvů. */
const klicNazvu = (s) => stripDiakritika(s.toLowerCase().replace(/\s+/g, " ").trim());

/** Promo a balíčkový šum z názvů. */
function cistiNazev(s) {
  if (!s) return "";
  let n = s
    .replace(/\b(akce|sleva|ak[cč]n[ií]|výhodn[ée]|balen[ií]|novinka)\b[:\s!%-]*/gi, " ")
    .replace(/\s+-\s*\d+\s?%/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[.,\-–\s]+|[.,\-–\s]+$/g, "")
    .trim();
  if (n.length > 120) n = n.slice(0, 120).trim();
  return n;
}

/** EAN – necháme jen platně vypadající kódy (8/12/13/14 číslic). */
function normalizujEan(code) {
  if (!code) return null;
  const c = String(code).replace(/\s+/g, "");
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(c) ? c : null;
}

/** OFF alergeny → naše EU-14 klíče. */
const MAPA_ALERGENU = {
  "en:gluten": "lepek", "en:crustaceans": "korisi", "en:eggs": "vejce",
  "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
  "en:milk": "mleko", "en:nuts": "orisky", "en:celery": "skorocel",
  "en:mustard": "horcice", "en:sesame-seeds": "sezam",
  "en:sulphur-dioxide-and-sulphites": "sulfit", "en:lupin": "lupina",
  "en:molluscs": "vodnany",
};

/** OFF categories_tags → naše 6 kategorií (první specifičtější vyhrává). */
const MAPA_KATEGORII = [
  [/meat|poultrie|sausage|fish|seafood|salami|ham|pate/, "maso_ryby"],
  [/dair|milk|cheese|yogurt|butter|cream|kefir|quark|egg/, "mlecne_vyrobky"],
  [/fruit|vegetable|salad|potato|mushroom/, "ovoce_zelenina"],
  [/bread|cereal|flour|rice|grain|oat|muesli|breakfast|bakery|roll|bun/, "peckoviny_obily"],
  [/pasta|noodle|biscuit|wafer|cracker|cookie|gnocchi|dumpling/, "suchary_testoviny"],
];

function kategorieZ(cats = []) {
  const joined = cats.join(" ").toLowerCase();
  for (const [re, kat] of MAPA_KATEGORII) if (re.test(joined)) return kat;
  return "ostatni";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Jeden OFF produkt → náš řádek foods (nebo null = přeskočit). */
function mapuj(p) {
  const surove = p.product_name_cs || p.product_name || "";
  const nazev = cistiNazev(surove);
  if (nazev.length < 2) return null;

  const n = p.nutriments ?? {};
  // energy_100g je v kJ! energy-kcal_100g je kcal – prioritně kcal, jinak přepočet
  let kalorie = num(n["energy-kcal_100g"]);
  if (kalorie === null && num(n.energy_100g) !== null) kalorie = num(n.energy_100g) / 4.184;
  const bilkoviny = num(n.proteins_100g) ?? 0;
  const sacharidy = num(n.carbohydrates_100g) ?? 0;
  const tuky = num(n.fat_100g) ?? 0;
  if (kalorie === null || kalorie <= 0) return null;
  if (bilkoviny === 0 && sacharidy === 0 && tuky === 0) return null;
  if (kalorie > 950) return null; // > 900 kcal/100g = chyba v datech (max ~olej)

  const ean = normalizujEan(p.code);
  const alergeny = [...new Set((p.allergens_tags ?? [])
    .map((t) => MAPA_ALERGENU[t])
    .filter(Boolean))];

  const anal = new Set(p.ingredients_analysis_tags ?? []);
  const labels = new Set(p.labels_tags ?? []);
  const diety = [];
  if (anal.has("en:vegan")) diety.push("vegansky", "vegetariansky");
  else if (anal.has("en:vegetarian")) diety.push("vegetariansky");
  if (labels.has("en:gluten-free") && !alergeny.includes("lepek")) diety.push("bezlepkovy");

  return {
    nazev,
    kategorie: kategorieZ(p.categories_tags),
    bilkoviny: Math.min(bilkoviny, 100),
    sacharidy: Math.min(sacharidy, 100),
    tuky: Math.min(tuky, 100),
    kalorie: Math.min(Math.round(kalorie * 100) / 100, 950),
    bezna_cena: 0,
    ean,
    zdroj: "openfoodfacts",
    schvaleno: true,
    alergeny,
    diety,
    obrazek: p.image_front_small_url || p.image_small_url || p.image_front_url || p.image_url || null,
  };
}

/* ============================================================
 * DB – dedupe + batch upsert
 * ============================================================ */

const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${PROJECT_REF}`,
  password: HESLO,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  max: 4,
});

async function nactiExistujici() {
  const { rows } = await pool.query("select nazev, ean from public.foods");
  return { nazvy: new Set(rows.map((r) => klicNazvu(r.nazev))), eany: new Set(rows.map((r) => r.ean).filter(Boolean)) };
}

async function vlozDavku(radky) {
  if (radky.length === 0) return 0;
  const cols = ["nazev", "kategorie", "bilkoviny", "sacharidy", "tuky", "kalorie", "bezna_cena", "ean", "zdroj", "schvaleno", "alergeny", "diety", "obrazek"];
  const vals = [];
  const params = [];
  radky.forEach((r, i) => {
    const o = i * cols.length;
    vals.push(`(${cols.map((_, j) => `$${o + j + 1}`).join(",")})`);
    params.push(r.nazev, r.kategorie, r.bilkoviny, r.sacharidy, r.tuky, r.kalorie,
      r.bezna_cena, r.ean, r.zdroj, r.schvaleno, r.alergeny, r.diety, r.obrazek);
  });
  // EAN konflikt = aktualizace dat (novější OFF info); jiný konflikt (název) = přeskoč
  const q = `
    insert into public.foods (${cols.join(",")})
    values ${vals.join(",")}
    on conflict (ean) where ean is not null do update set
      bilkoviny = excluded.bilkoviny, sacharidy = excluded.sacharidy,
      tuky = excluded.tuky, kalorie = excluded.kalorie,
      alergeny = excluded.alergeny, diety = excluded.diety,
      obrazek = coalesce(excluded.obrazek, foods.obrazek),
      kategorie = excluded.kategorie
  `;
  const res = await pool.query(q, params);
  return res.rowCount ?? 0;
}

/* ============================================================
 * Hlavní smyčka – obnovitelná
 * ============================================================ */

function nactiStav() {
  if (existsSync(STATE)) {
    try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { /* poškozený state → nový běh */ }
  }
  return { hotoveKategorie: [], strana: {}, vlozeno: 0, preskoceno: 0, duplicity: 0, bezEan: 0 };
}

function ulozStav(s) {
  writeFileSync(STATE, JSON.stringify(s, null, 1));
}

async function main() {
  const stav = nactiStav();
  const exist = await nactiExistujici();
  console.log(`Katalog: ${exist.nazvy.size} názvů / ${exist.eany.size} EANů v DB`);
  console.log(`Obnovuji běh: ${stav.hotoveKategorie.length} kategorií hotovo, ${stav.vlozeno} vloženo`);

  const davka = [];
  const flush = async () => {
    if (davka.length === 0) return;
    const n = await vlozDavku(davka.splice(0, davka.length));
    stav.vlozeno += n;
  };

  for (const kat of OFF_KATEGORIE) {
    if (stav.vlozeno >= LIMIT) break;
    if (stav.hotoveKategorie.includes(kat)) continue;

    let strana = stav.strana[kat] ?? 1;
    let prazdne = 0;
    console.log(`\n== ${kat} (od strany ${strana}) ==`);

    while (prazdne < 2 && stav.vlozeno < LIMIT) {
      const data = await fetchStrana(kat, strana);
      const produkty = data.products ?? [];
      const celkem = data.count ?? 0;
      if (produkty.length === 0) { prazdne++; strana++; continue; }
      prazdne = 0;

      let noveVdavce = 0;
      for (const p of produkty) {
        const radek = mapuj(p);
        if (!radek) { stav.preskoceno++; continue; }
        if (radek.ean && exist.eany.has(radek.ean)) { stav.duplicity++; continue; }
        if (exist.nazvy.has(klicNazvu(radek.nazev))) {
          // kolize jména s jiným produktem – zkus disambiguovat značkou
          const zn = (p.brands ?? "").split(",")[0].trim();
          if (zn) {
            const s = `${radek.nazev} (${zn})`;
            if (!exist.nazvy.has(klicNazvu(s)) && s.length <= 120) { radek.nazev = s; }
            else { stav.duplicity++; continue; }
          } else { stav.duplicity++; continue; }
        }
        if (radek.ean) exist.eany.add(radek.ean); else stav.bezEan++;
        exist.nazvy.add(klicNazvu(radek.nazev));
        davka.push(radek);
        noveVdavce++;
      }

      if (davka.length >= 400) await flush();
      stav.strana[kat] = strana + 1;
      ulozStav(stav);
      console.log(`  strana ${strana}: ${produkty.length} produktů (${noveVdavce} nových), celkem v kat. ~${celkem}, vloženo ${stav.vlozeno}, dupl. ${stav.duplicity}, přeskoč. ${stav.preskoceno}`);
      strana++;
      await sleep(DELAY + Math.random() * 700);
      if (strana > 100) break; // bezpečnost: OFF hluboké stránkování stejně končí ~10k
    }

    if (prazdne >= 2 || strana > 100) {
      stav.hotoveKategorie.push(kat);
      delete stav.strana[kat];
      await flush();
      ulozStav(stav);
      console.log(`== ${kat} hotovo ==`);
    }
    if (stav.vlozeno >= LIMIT) break;
  }

  await flush();
  ulozStav(stav);
  const { rows } = await pool.query("select count(*)::int c from public.foods");
  console.log(`\n✅ Konec. Katalog celkem: ${rows[0].c} potravin | nově: ${stav.vlozeno}, duplicity: ${stav.duplicity}, přeskočeno: ${stav.preskoceno}, bez EAN: ${stav.bezEan}`);
}

try {
  await main();
} catch (e) {
  console.error(`\n❌ Ingest selhal: ${e.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
