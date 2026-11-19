/**
 * Audit cen – kontrola korektnosti všech cen v aktualni_ceny.
 *
 * Všechny ceny jsou v Kč / 100 g (i bezna_cena i pozorování).
 * Kontroly:
 *   1) globální meze <0,3 nebo >300 Kč/100 g
 *   2) meze podle kategorie (maso dražší než rohlík…)
 *   3) sleva bez %, sleva ≥75 %, nebo puvodni_cena < aktualni
 *   4) chybějící bezna_cena (0/null)
 *   5) podezřelé odchylky od mediánu kategorie (>8× nebo <1/8)
 *
 *   node scripts/over_ceny.mjs           → report
 *   node scripts/over_ceny.mjs --json    → strojový výstup
 */
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));

const MEZE = {
  maso_ryby: [6, 120],
  mlecne_vyrobky: [1.5, 80],
  ovoce_zelenina: [0.8, 45],
  peckoviny_obily: [0.8, 25],
  suchary_testoviny: [0.8, 40],
  ostatni: [0.4, 300],
};

const db = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const { rows } = await db.query(`
  select
    ac.food_id as id, ac.nazev, ac.kategorie,
    ac.bezna_cena::float as bezna,
    ac.aktualni_cena::float as aktualni,
    ac.obchod, ac.sleva, ac.zdroj_ceny
  from aktualni_ceny ac
`);

// konzistence samotných pozorování (view fallback na bezna_cenu
// není chyba dat, jen odhad – proto kontrola přímo na zdroji)
const { rows: obs } = await db.query(`
  select po.food_id as id, f.nazev, f.kategorie, po.cena::float as cena,
         po.puvodni_cena::float as puvodni, po.je_sleva,
         case when po.puvodni_cena > 0
              then round((1 - po.cena / po.puvodni_cena) * 100)
              end as pct,
         r.nazev as obchod
  from price_observations po
  join foods f on f.id = po.food_id
  left join retailers r on r.id = po.retailer_id
`);

// mediána kategorie z běžných cen (pozorování můžou být slevové anomálie)
const median = {};
const skupiny = {};
for (const r of rows) {
  if (r.bezna > 0) (skupiny[r.kategorie] ??= []).push(r.bezna);
}
for (const [k, v] of Object.entries(skupiny)) {
  v.sort((a, b) => a - b);
  median[k] = v[Math.floor(v.length / 2)];
}

const nalezy = [];
const f = (id, pravidlo, detail) =>
  nalezy.push({ id: String(id).slice(0, 8), ...pravidlo, ...detail });

for (const r of rows) {
  const [min, max] = MEZE[r.kategorie] ?? MEZE.ostatni;
  const meta = { nazev: r.nazev, kat: r.kategorie, cena: r.aktualni, bezna: r.bezna, obchod: r.obchod };

  if (!r.aktualni || r.aktualni <= 0) f(r.id, { typ: "chybí cena" }, meta);
  else if (r.aktualni < 0.3 || r.aktualni > 300)
    f(r.id, { typ: "mimo globální meze" }, meta);
  else if (r.aktualni < min || r.aktualni > max)
    f(r.id, { typ: "mimo meze kategorie" }, { ...meta, meze: `${min}–${max}` });

  if (r.bezna && median[r.kategorie]) {
    const pomer = r.bezna / median[r.kategorie];
    if (pomer > 8 || pomer < 0.125)
      f(r.id, { typ: "outlier vůči mediánu" }, { ...meta, median: median[r.kategorie], pomer: +pomer.toFixed(1) });
  }
}

// konzistence pozorování: původní cena a % slevy přímo na zdrojovém řádku
const beznaMap = new Map(rows.map((r) => [r.id, r.bezna]));
for (const o of obs) {
  const meta = { nazev: o.nazev, kat: o.kategorie, cena: o.cena, obchod: o.obchod };
  if (o.puvodni != null && o.puvodni < o.cena)
    f(o.id, { typ: "původní < aktuální (obs)" }, { ...meta, puvodni: o.puvodni });
  if (o.je_sleva && o.pct != null && (o.pct <= 0 || o.pct >= 75))
    f(o.id, { typ: "podezřelá % slevy" }, { ...meta, pct: o.pct });
  // cena pozorování nad odhadem běžné ceny >3× = podezření na jednotku
  const bezna = beznaMap.get(o.id);
  if (bezna && o.cena > bezna * 3 && o.cena > 20)
    f(o.id, { typ: "pozorování >3× běžné" }, { ...meta, bezna });
}

await db.end();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ celkem: rows.length, nalezy }, null, 1));
} else {
  const poType = {};
  for (const n of nalezy) (poType[n.typ] ??= []).push(n);
  console.log(`Celkem cen: ${rows.length} · nálezů: ${nalezy.length}\n`);
  for (const [typ, seznam] of Object.entries(poType)) {
    console.log(`== ${typ} (${seznam.length})`);
    for (const n of seznam.slice(0, 15)) {
      const extra = n.meze ? ` [meze ${n.meze}]` : n.pct != null ? ` [${n.pct}%]` : n.median ? ` [med ${n.median}, ${n.pomer}×]` : n.puvodni ? ` [puvodni ${n.puvodni}]` : "";
      console.log(`   ${n.nazev} | ${n.kat} | ${n.cena} Kč/100g | ${n.obchod ?? "běžná"}${extra}`);
    }
    if (seznam.length > 15) console.log(`   … a ${seznam.length - 15} dalších`);
  }
}
