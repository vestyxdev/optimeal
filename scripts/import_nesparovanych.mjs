// Import nespárovaných kupi nabídek do foods.
//
// Pro každý nespárovaný název (z _analyza_shod.mjs → _nesparovano.json)
// najde produkt na Open Food Facts → vezme výživu + EAN + obrázek,
// ale jako foods.nazev uloží NÁZEV Z NABÍDKY (klíč pro budoucí párování).
// Cena: median běžné (přeškrtnuté) ceny přes řetězce, jinak median akční.
//
// Použití: node scripts/import_nesparovanych.mjs [--dry]
import pg from "pg";
import { readFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const HESLO = readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(\S+)/)?.[1] ?? process.env.SUPABASE_DB_PASSWORD;
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb", password: HESLO, database: "postgres",
  ssl: { rejectUnauthorized: false },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KATEGORIE = [
  [/vepr|kurec|hovez|kachn|hus|krut|ryb|tunak|losos|kapr|pstruh|krevet|sunka|salam|prosciutto|myslivecka|park|uzen|file|rizek|pecene|kli[zz]ka|mlet[eé] maso|maso/i, "maso_ryby"],
  [/mlek|jogurt|syr|smetan|masl|tvaroh|kefir|pribinac|bobik|termix|dezert|pudink|zmrzlin|actimel|danone|salko/i, "mlecne_vyrobky"],
  [/banan|jablk|pomeran|citron|mandarink|kiwi|hrozn|broskv|merun|svest|blum|rajc|okurk|paprik|cibul|cesnek|mrkev|petrzel|celer|brokolic|kvetak|zeli|salat|kedlubn|redkv|brambor|dyne|avokad|meloun|jahod|malin|boruv|gre|limet|ananas|mang/i, "ovoce_zelenina"],
  [/chleb|rohlik|housk|croissant|donut|koblih|kolac|knedlik|peciv|baget|veka|toast|strudl|livanec|bucht/i, "peckoviny_obily"],
  [/testovin|ryze|spaget|musli|cereal|kornflejk|ovesn|kuskus|pohank|mouka|cukr|jisk|nudl|penne|fusilli|rissot|luncheable|quentin/i, "suchary_testoviny"],
];
const kategorie = (nazev) => KATEGORIE.find(([re]) => re.test(nazev))?.[1] ?? "ostatni";

function gramaje(jednotka) {
  const m = (jednotka ?? "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  const g = { kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 }[m[2]] * v;
  const mul = (jednotka.match(/(\d+)\s*[x×]/) ?? [])[1];
  const out = g * (mul ? +mul : 1);
  return out >= 2 && out <= 20000 ? Math.round(out) : null;
}

const normTok = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();

// vedoucí obecná slova („Energetický nápoj Red Bull" → „Red Bull")
const GENERICKA = /^(bylinn[yý]|energetick[yý]|lik[eé]r[a-z]*|whisk?ey|whisky|vodka|gin|rum|brandy|fernet|aperitiv|sekt|v[ií]n[a-z]*|pivo|cider|mlet[aá]|instantn[ií]|k[aá]v[a-z]*|[cč]okol[aá]d[a-z]*|bonboni[eé]ra|[cč]aje|ty[cč]inka|[zž]v[yý]ka[cč]ky|oplatky|chipsy|snack|zmrzlina|miner[aá]ln[ií]|p[rř][ií]rodn[ií]|ochucen[aá]|voda|d[zž]us|n[aá]poj|nektar|sirup|limon[aá]da|s[yý]r|dezert|p[rř][ií]krm|cere[aá]lie|kapsle|sal[aá]t|cukr|mouka|tuk|margar[ií]n[a-z]*|olivy|d[zž]em|povidla|j[ií][sš]ka|majoneza|tatarka|tatarka|om[aá][cč]ka|kukurice|sterilovan[aá]|sushi|pizza|mra[zž]en[aá]|knedl[ií]ky|ryb[ií]|kobliha|kapsa|kol[aá][cč]|pasty|dezinfek[cč]n[ií]|univerz[aá]ln[ií]|[cč]isti[cč]|kojeneck[aá]|v[yý][zž]iva|d[ée]tsk[yý]|nealkoholick[yý]|ochucen[eé]|original|exclusive|tradi[cč]n[ií]|standard|v[yý]b[ěe]rov[yý]|vaje[cč]n[yý]|sva[rř]en[eé]|mra[zž]en[eé]|p[rř]edsma[zž]en[eé]|[uú]zen[yý]|mra[zž]en[aá])\s+/i;

function jadroNazvu(nazev) {
  // odsekne vedoucí obecná slova až po ~3 průchody; zbytek = „brand core"
  let s = nazev.trim();
  for (let i = 0; i < 4; i++) {
    const n = s.replace(GENERICKA, "").trim();
    if (n === s) break;
    s = n;
  }
  return s || nazev;
}

function podobnyNazev(nabidka, offNazev) {
  // OFF jméno musí sdílet ≥1 „významný" token (≥4 znaky) s nabídkou
  if (!offNazev) return false;
  const a = new Set(normTok(nabidka).split(" ").filter((w) => w.length >= 4));
  const b = new Set(normTok(offNazev).split(" ").filter((w) => w.length >= 4));
  return [...a].some((w) => b.has(w) || [...b].some((x) => x.startsWith(w) || w.startsWith(x)));
}

// obecné potraviny, které OFF zná pod anglickým názvem
const ALIASY = new Map(Object.entries({
  "Citrony": "lemon", "Banány": "bananas", "Pomeranče": "orange",
  "Jablka Golden Delicious": "golden delicious apple", "Jablka červená Gala": "gala apple",
  "Petržel": "parsley", "Celer bulva": "celeriac", "Kedlubna bílá": "kohlrabi",
  "Ředkvičky svazek": "radish", "Blumy modré": "plums", "Dýně Hokkaidó": "hokkaido pumpkin",
  "Husa": "goose", "Kachna mražená": "duck", "Kachna Vodňanská kachna": "duck",
  "Kuřecí prsní řízky": "chicken breast", "Vepřový bok s kostí": "pork ribs",
  "Hovězí přední bez kosti - kližka": "beef", "Okurka salátová - hadovka": "cucumber",
  "Okurky Znojmia": "gherkins", "Donut": "donut", "Kobliha s náplní": "filled doughnut",
  "Kapsa s náplní": "pastry", "Rybí filé mražené Nowaco": "frozen fish fillet",
  "Citrony": "lemon", "Mandarinky": "mandarin", "Kiwi": "kiwi",
}).map(([k, v]) => [normTok(k), v]));

async function offHledej(nazev) {
  const jadro = jadroNazvu(nazev);
  const dotazy = [...new Set([
    jadro,
    jadro.split(" ").slice(0, 2).join(" "),
    jadro.split(" ")[0],
    ALIASY.get(normTok(nazev)),
  ])].filter(Boolean);
  for (const q of dotazy) {
    try {
      const r = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,product_name_cs,generic_name_cs,nutriments,image_url`,
        { headers: { "User-Agent": "OptiMeal/1.0 (import katalogu)" } },
      );
      if (!r.ok) continue;
      const j = await r.json();
      for (const p of j.products ?? []) {
        const n = p.nutriments ?? {};
        const kcal = n["energy-kcal_100g"] ?? (n["energy-kj_100g"] ? n["energy-kj_100g"] / 4.184 : null);
        // kcal + ≥2 makra stačí – OFF chybějící makra (lihoviny: tuky/bilk. = 0)
        // neuvádí nulou, ale klíč úplně vynechává
        const pritomna = [n.proteins_100g, n.carbohydrates_100g, n.fat_100g].filter((v) => v != null).length;
        if (kcal == null || pritomna < 2) continue;
        const offNazev = p.product_name_cs || p.product_name || p.generic_name_cs || null;
        if (!podobnyNazev(nazev, offNazev) && !podobnyNazev(q, offNazev)) continue;
        return {
          ean: p.code ?? null,
          obrazek: p.image_url ?? null,
          kalorie: Math.round(kcal * 100) / 100,
          bilkoviny: n.proteins_100g ?? 0,
          sacharidy: n.carbohydrates_100g ?? 0,
          tuky: n.fat_100g ?? 0,
          off_nazev: offNazev,
        };
      }
    } catch { /* další dotaz */ }
    await sleep(400);
  }
  return null;
}

// názvy, u kterých OFF systematicky vrací nesouvisející produkty
// (jednoslovný token jako „relax/stock/jack" matchuje kdeco) – nikdy neimportuj
const ZAKAZANE = new Set([
  "cider frisco", "republica exclusive bozkov", "whiskey jameson",
  "rum reserva exclusiva diplomatico", "whiskey honey jack daniel's",
  "rum bumbu", "zmrzlina v kelimku manhattan nestle", "paprika mix",
  "fernet stock", "stara myslivecka", "citrony", "dzus hello",
  "brandy 5 metaxa", "syr krolewski milkpol", "celer bulva",
  "dyne hokkaido", "instantni kavy jacobs", "instantni kava jacobs kronung",
]);

const NEJIDLA = /lego|orchidej|poinsettia|my[čc]k|prac[ií]|sanytol|parodontax|pasty na zuby|zubn[ií]|whiskas|pedigree|felix|purina|kapsl?e? pro (ko[čc]k|ps)|dezinfek[cč]n[ií]|[cč]isti[cč]|krmivo|lovela|perwoll|woolite|jar |platinum|persil|ariel|lenor|silan|domestos|savo |kostým|hra[čc]k|dárek|detská kni|se[šs]it|tužk|fix[ya]|sv[íi][čc]ka|hrnek|láhev na|ta[šs]ka|kv[ěe]tin[áa][čc]|akvári|pelech|podložk|doplňky stravy do/i;
const kandidati = JSON.parse(readFileSync("scripts/_nesparovano.json", "utf8"))
  .filter((k) => k.median_c100 > 0 && !NEJIDLA.test(k.nazev) && !ZAKAZANE.has(normTok(k.nazev)));

console.log(`Importuji ${kandidati.length} kandidátů${DRY ? " (DRY)" : ""}…`);
let ok = 0, offMiss = 0, dup = 0;
for (const k of kandidati) {
  const off = await offHledej(k.nazev);
  await sleep(600);
  if (!off) { offMiss++; console.log(`  ✗ OFF nemá: ${k.nazev}`); continue; }
  const radek = {
    nazev: k.nazev.slice(0, 200),
    kategorie: kategorie(k.nazev),
    bilkoviny: off.bilkoviny, sacharidy: off.sacharidy, tuky: off.tuky, kalorie: off.kalorie,
    bezna_cena: k.median_bezna ?? k.median_c100,
    ean: off.ean, obrazek: off.obrazek,
    baleni_g: k.jednotky.map(gramaje).find((g) => g) ?? null,
    zdroj: "openfoodfacts", schvaleno: true,
  };
  if (DRY) { ok++; console.log(`  ~ ${radek.nazev} → ${radek.kategorie}, ${radek.kalorie} kcal (${off.off_nazev})`); continue; }
  try {
    await pool.query(
      `insert into public.foods (nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, ean, obrazek, baleni_g, zdroj, schvaleno)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (nazev) do nothing`,
      [radek.nazev, radek.kategorie, radek.bilkoviny, radek.sacharidy, radek.tuky, radek.kalorie, radek.bezna_cena, radek.ean, radek.obrazek, radek.baleni_g, radek.zdroj, radek.schvaleno],
    );
    ok++;
    console.log(`  ✔ ${radek.nazev} [${radek.kategorie}] ${radek.kalorie}kcal ← ${off.off_nazev ?? off.ean}`);
  } catch (e) {
    if (/duplicate|unique/i.test(e.message)) { dup++; } else console.log(`  ✗ ${k.nazev}: ${e.message}`);
  }
}
console.log(`\nHotovo: ${ok} vloženo, ${dup} duplicit, ${offMiss} bez OFF shody`);
await pool.end();
