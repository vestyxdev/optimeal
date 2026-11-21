// oprav_fantom_kalorie_off.mjs – opraví „fantomové kalorie" (deklarované
// kcal vs. makra se liší >35 %) překlíknutím čerstvých dat z OFF podle EAN.
// Zapisuje POUZE když je OFF odpověď vnitřně konzistentní (off kcal vs
// odhad z maker ≤ 35 %), jinak řádku nechává (nemáme jiný zdroj).
// Resumable přes state soubor. Použití:
//   node scripts/oprav_fantom_kalorie_off.mjs [--dry] [--limit=N]
import pg from "pg";
import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const LIM = +(process.argv.find((a) => a.startsWith("--limit"))?.split("=")[1] ?? 0);
const STATE = "scripts/.oprav_fantom.state.json";

const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb", password: heslo,
  database: "postgres", ssl: { rejectUnauthorized: false }, max: 2,
});

const { rows } = await pool.query(`
  select id, nazev, ean, kalorie, bilkoviny, sacharidy, tuky
  from public.foods
  where ean is not null and schvaleno
    and kalorie is not null and bilkoviny is not null
    and sacharidy is not null and tuky is not null
    and abs(kalorie - (bilkoviny*4 + sacharidy*4 + tuky*9)) > greatest(60, kalorie*0.25)
  order by id`);

const hotovo = new Set();
try { for (const e of JSON.parse(fs.readFileSync(STATE, "utf8"))) hotovo.add(e); } catch {}
const fronta = rows.filter((r) => !hotovo.has(r.ean)).slice(0, LIM || undefined);
console.log(`K dotázání: ${fronta.length} EAN (celkem ${rows.length}, hotovo ${hotovo.size})`);

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const cislo = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? +Number(v).toFixed(1) : null);

let opraveno = 0, nekonzistentni = 0, stejne = 0, nenalezeno = 0, chyby = 0;
for (const [i, row] of fronta.entries()) {
  if (i > 0) await sleep(1200);
  let prod = null;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${row.ean}.json?fields=code,nutriments`,
      { headers: { "User-Agent": "OptiMeal/2.0 (github.com/vestyxdev/optimeal)" },
        signal: AbortSignal.timeout(15_000) },
    );
    if (res.status === 429 || res.status >= 500) { chyby++; await sleep(8000); continue; }
    if (res.ok) { const j = await res.json(); if (j.status === 1) prod = j.product; }
    else if (res.status === 404) { /* nenalezeno */ } else { chyby++; continue; }
  } catch { chyby++; continue; }
  hotovo.add(row.ean);
  if (!prod?.nutriments) { nenalezeno++; continue; }

  const n = prod.nutriments;
  const kcal = n["energy-kcal_100g"] != null
    ? Number(n["energy-kcal_100g"])
    : n.energy_100g != null ? Number(n.energy_100g) / 4.184 : NaN;
  const b = cislo(n.proteins_100g), s = cislo(n.carbohydrates_100g), t = cislo(n.fat_100g);
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 950 || b === null || s === null || t === null) {
    nenalezeno++;
    continue;
  }
  const odhad = 4 * b + 4 * s + 9 * t;
  const zaklad = Math.max(kcal, odhad);
  const offOk = zaklad > 30 && Math.abs(kcal - odhad) / zaklad <= 0.35;
  if (!offOk) { nekonzistentni++; continue; }
  const lisi =
    Math.abs(kcal - +row.kalorie) > 1 || b !== +row.bilkoviny ||
    s !== +row.sacharidy || t !== +row.tuky;
  if (!lisi) { stejne++; continue; }
  if (!DRY) {
    await pool.query(
      "update public.foods set kalorie=$2, bilkoviny=$3, sacharidy=$4, tuky=$5 where id=$1",
      [row.id, Math.round(kcal), b, s, t],
    );
  }
  opraveno++;
  if (opraveno <= 15 || opraveno % 25 === 0) {
    console.log(`  ${row.nazev}: ${row.kalorie}→${Math.round(kcal)} kcal | B ${row.bilkoviny}→${b} S ${row.sacharidy}→${s} T ${row.tuky}→${t}`);
  }
  if ((i + 1) % 25 === 0) {
    fs.writeFileSync(STATE, JSON.stringify([...hotovo]));
    console.log(`  …${i + 1}/${fronta.length} | opraveno ${opraveno} | nekonzistentní OFF ${nekonzistentni} | stejné ${stejne} | nenalezeno ${nenalezeno}`);
  }
}
fs.writeFileSync(STATE, JSON.stringify([...hotovo]));
console.log(`\nHotovo: ${fronta.length} dotázáno | opraveno ${opraveno} | OFF nekonzistentní ${nekonzistentni} | stejné ${stejne} | nenalezeno ${nenalezeno} | chyby ${chyby}`);
console.log(DRY ? "DRY-RUN – bez --dry se zapíše." : "");
await pool.end();
