// Zrcadlí matcher z scraper/db.py a spočítá, které nabídky se NESPÁRUJÍ.
// Výstup: top nespárované "potravinové" názvy podle četnosti → kandidáti
// na seed obecných potravin.
import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";

const HESLO = readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(\S+)/)?.[1] ?? process.env.SUPABASE_DB_PASSWORD;
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb", password: HESLO, database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Zrcadlo cesky_stem ze scraper/normalizace.py
const KONCOVKY = [
  "ici", "ice", "eci", "ech", "ich", "umi", "ami", "imi", "emi",
  "eti", "ata", "etu", "ova", "ove", "ovy", "ovi", "ek", "ik",
  "ec", "ky", "ka", "ko", "ci", "ce", "ku", "ke", "ov", "ou",
  "em", "um", "im", "at", "et", "u", "y", "e", "a", "i", "o",
].sort((a, b) => b.length - a.length);
const stem = (t) => {
  let s = t;
  while (s.length > 3) {
    const k = KONCOVKY.find((x) => s.endsWith(x) && s.length - x.length >= 3);
    if (!k) break;
    s = s.slice(0, -k.length);
  }
  return s;
};
const stemNazev = (nazev) => norm(nazev).split(" ").map(stem).join(" ");

// Ratcliff–Obershelp (stejně jako difflib.SequenceMatcher.ratio)
function matchBlocks(a, b) {
  let celkem = 0;
  const stack = [[0, a.length, 0, b.length]];
  while (stack.length) {
    const [a0, a1, b0, b1] = stack.pop();
    let bi = -1, bj = -1, bn = 0;
    for (let i = a0; i < a1; i++) for (let j = b0; j < b1; j++) {
      let k = 0; while (a[i + k] === b[j + k] && i + k < a1 && j + k < b1) k++;
      if (k > bn) { bn = k; bi = i; bj = j; }
    }
    if (!bn) continue;
    celkem += bn;
    stack.push([a0, bi, b0, bj], [bi + bn, a1, bj + bn, b1]);
  }
  return celkem;
}
const ratio = (a, b) => (a.length + b.length) ? (2 * matchBlocks(a, b)) / (a.length + b.length) : 1;

const { rows: foods } = await pool.query("select id, nazev from public.foods");
const normFoods = foods.map((f) => {
  const fn = norm(f.nazev);
  const fstem = fn.split(" ").map(stem).join(" ");
  return { id: f.id, fn, ft: fn.split(" "), fstem, fst: new Set(fstem.split(" ")) };
});
const presne = new Map(normFoods.map((f) => [f.fn, f.id]));

function match(nazev) {
  const cil = norm(nazev);
  if (presne.has(cil)) return presne.get(cil);
  const cilT = new Set(cil.split(" "));
  if (!cilT.size) return null;
  const cilStem = stemNazev(nazev);
  const cilStemT = new Set(cilStem.split(" "));
  let nejSkore = 0;
  for (const f of normFoods) {
    // prefilter: bez společného (kmenového) tokenu difflib nikdy nedosáhne 0.8
    if (!f.ft.some((w) => cilT.has(w)) && ![...f.fst].some((w) => cilStemT.has(w))) continue;
    const fts = new Set(f.ft);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let skore = 0;
    if (f.ft.length >= 1 && [...fts].every((w) => cilT.has(w))) skore = 0.90 + 0.01 * f.ft.length;
    else if (f.fst.size >= 1 && [...f.fst].every((w) => cilStemT.has(w))) skore = 0.89 + 0.01 * f.fst.size;
    else if (f.fn.length >= 4 && new RegExp(`\\b${esc(f.fn)}\\b`).test(cil)) skore = 0.88;
    else if (f.fstem.length >= 4 && new RegExp(`\\b${esc(f.fstem)}\\b`).test(cilStem)) skore = 0.87;
    else if (cil.length >= 4 && new RegExp(`\\b${esc(cil)}\\b`).test(f.fn)) skore = 0.85;
    else {
      const cl = cil.split(" ");
      let best = ratio(cil, f.fn);
      if (cl.length >= f.ft.length && f.ft.length)
        for (let i = 0; i <= cl.length - f.ft.length; i++)
          best = Math.max(best, ratio(f.fn, cl.slice(i, i + f.ft.length).join(" ")));
      if (best >= 0.8) skore = best;
    }
    if (skore > nejSkore) nejSkore = skore;
  }
  return nejSkore >= 0.8 ? 1 : null;
}

const NEJIDLA = /jar |persil|savo |domestos|cif |vanish|somat|finish |fairy|silan|coccolino|avivaz|aviváž|sampon|šampon|deodorant|kartacek|kartáček|zubni |zubní |pastu|pasta na|mydlo|mýdlo|sprch|wc |toalet|utierk|utěrk|pelisek|pelíšek|hracka|hračka|baterie|zarovka|žárovka|kosmet|krem |krém |svicka|svíčka|vlocka|vlas |vlasy|nozick|pelech|granule|konzerva pro|krmivo|whiskas|pedigree|felix|purina|chappi|kitekat|friskies|pro psy|pro kocky|kockam|poop|podlozk|pampers|plen|ubrousk|alobal|folii|folie|sacek|sáček|mikroten|taska|taška|nadobi|nádobí|susenka prani|vosk|mrazak|signal |elmex|meridol|listerine|nivea|dove |rexona|balea|mixa |fa |old spice|gillette|orospol|ajomat|pearls|colgate|blend|ariel|lenor|prilosek|ornament|dekora|vanoce|darek|dárek|ornament|detergent|o.?myv|praci |praní |praní|osvezova|osvěžova|neutraliz|impregna|cleaner|leštid|lesk na|hubka na|dratenka|drátěnk|hadrik|hadr |ubrousk|servit|klec |akvari|terrari|postel|polstar|polštář|prikryv|přikrýv|kabel|nabij|adapter|sluchat|reprodukt|power ?bank|usb |hdmi|LED |svitiln|termosk|lahev na|láhev na|hrnek|hrnek|panv|hrnec|talir|talíř|pribor|příbor|kuchyn|zahrad|kvetinac|květináč|substrat|pozdrav|pohledn|balici|balící|puzzled|spolecenska|společenská|detska kni|kniha|cteni|penal|penál|skolni|školní|seit|sešit|blok |tuzk|tužk|fixa |fixy |guma |pravitko|pravítko|kreid|kříd|nalepk|samolepk|samolepíc|balon|balón|party |karneval|maska |kostym|kostým/i;

const nabidky = JSON.parse(readFileSync("scripts/_kupi_nazvy.json", "utf8"));
const stat = new Map(); // nazev → {n, obchody:Set, ceny:[], puvodni:[]}
let sparovano = 0, nejidlo = 0;
for (const n of nabidky) {
  if (NEJIDLA.test(n.nazev)) { nejidlo++; continue; }
  const m = match(n.nazev);
  if (m) { sparovano++; continue; }
  const k = n.nazev.trim();
  const s = stat.get(k) ?? { n: 0, obchody: new Set(), ceny: [], puvodni: [], jednotky: new Set() };
  s.n++; s.obchody.add(n.obchod); if (n.c100) s.ceny.push(n.c100);
  if (n.pct && n.c100) s.puvodni.push(Math.round(n.c100 / (1 - n.pct / 100) * 100) / 100);
  if (n.jednotka) s.jednotky.add(n.jednotka);
  stat.set(k, s);
}
// kandidáti na import: nejčastější nespárované (jen potraviny – NEJIDLA už odfiltrováno)
const kandidati = [...stat.entries()]
  .sort((a, b) => b[1].n - a[1].n)
  .slice(0, 150)
  .map(([nazev, s]) => ({
    nazev,
    cetnost: s.n,
    obchody: [...s.obchody],
    median_c100: s.ceny.sort((a, b) => a - b)[Math.floor(s.ceny.length / 2)] ?? null,
    median_bezna: s.puvodni.sort((a, b) => a - b)[Math.floor(s.puvodni.length / 2)] ?? null,
    jednotky: [...s.jednotky],
  }));
writeFileSync("scripts/_nesparovano.json", JSON.stringify(kandidati, null, 1));

const top = [...stat.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 200);
console.log(`Spárováno: ${sparovano}, ne-jídlo: ${nejidlo}, nespárováno unikátních: ${stat.size}\n`);
for (const [nazev, s] of top) {
  const med = s.ceny.sort((a, b) => a - b)[Math.floor(s.ceny.length / 2)] ?? 0;
  const medP = s.puvodni.sort((a, b) => a - b)[Math.floor(s.puvodni.length / 2)] ?? "";
  console.log(`${String(s.n).padStart(3)}× ${[...s.obchody].join(",").padEnd(35)} ${med} Kč/100g (běžná ~${medP}) ${[...s.jednotky].join("|")} – ${nazev}`);
}
await pool.end();
