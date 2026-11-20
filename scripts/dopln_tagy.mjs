// dopln_tagy.mjs – doplní foods.alergeny/diety podle NÁZVU pro položky,
// které scraper nechal bez tagů (jen ~28 % katalogu má OFF allergens_tags).
// ADITIVNÍ: nikdy neodebírá existující tagy, jen přidává.
//   alergeny – přes nazevNasvedcujeAlergenu z generátoru (stejná síť jako
//     ve filtrujPotraviny, včetně „bez X" námitek a vynechaných frází).
//   diety  – vegetariansky pro rostlinné/mléčné/vaječné názvy bez masa,
//     vegansky jen pro jednoznačné rostlinné názvy; bezlepkovy se
//     nedokazuje názvem → záměrně se nedoplňuje.
// Použití: node scripts/dopln_tagy.mjs          … dry-run (jen náhled)
//          node scripts/dopln_tagy.mjs --apply  … zapíše do foods
import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: heslo,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const { ALERGEN_Z_NAZVU, ALERGEN_FRAZE_VYNECH, nazevNasvedcujeAlergenu } =
  await import("../src/lib/generator/generator.ts");

/* --- maso/ryba/živočišné + hotová jídla (maso nemusí být v názvu) --- */
const NENI_VEG_RE =
  /maso|masn|ku[řr]e|hov[ěe]z|vep[řr]|[ůu]zenin|[šs]unk|sal[áa]m|p[áa]rek|p[áa]rky|slanin|ryb|losos|tu[ňn][áa]k|tuna|sardink|sardel|makrel|kapr\b|pstruh|cand[áa]t|[šs]tik|[úu]ho[řr]|tresk|halibut|pangas|an[čc]ovi[čc]k|anchov|krevet|krab|langust|humr|kor[ýy][šs]|m[ěe]kk[ýy][šs]|[úu]st[řr]ic|mu[šs]l|chobotnic|s[éeé]pi|olih|kalam[áa]r|klob[áa]s|krvav|j[áa]trov|dr[šs]ť|želatin|žel[ée]|gelee|aspik|s[áa]dlo|l[ůu]j|hus[íi]|kachn|kr[ůu]t|telec|jehn[ěe][čc]|skopov|zaje[čc]|bažant|divo[čc][áa]k|kanec|mortadela|pepperoni|chorizo|bacon|jerky|biltong|kebab|gyros|tatarák|steak|fil[ée]|\br[ií]zek|karban|masox|bujon.*(hov[ěe]z|ku[řr]e)|pol[ée]vk.*(hov[ěe]z|ku[řr]e|masn)|lunch|dinner|menu\b|\bmeal\b|ready\b|hotov[ée]\s|instantn/i;

/* --- rostlinné pozitivní názvy (bezpečné i pro vegana) ---
   Záměrně BEZ složených výrobků (kaše, müsli, pečivo, pomazánky,
   čokoláda, kakao, „cukrárna" atd.) – mléko/vejce/med v nich
   název neprokáže, a BEZ müsli/granoly (často med). */
const ROSTLINNE_RE =
  /zelenin|ovoc|mrk[ev]|brambor|raj[čc]|okurk|paprik|brokolic|kv[ěe]t[áa]k|cuket|zel[íi]|hl[áa]vkov|[šs]pen[áa]t|houb|[žž]ampion|jablko|jable[čc]|hru[šs]k|ban[áa]n(?!ov)|pomeran[čc]|citron|limet|jahod|malin|bor[ůu]vk|ryb[íi]z|angre[šs]t|brosk|meru[ňn]|[šs]vest|t[řr]e[šs][ňn]|vi[šs][ňn]|hroz[íi]n|hrozink|meloun|ananas|mango|kiwi|avok[áa]d|mandarink|grep\b|d[ýy][ňn]|m[áa]k\b|sezam|slune[čc]nic|ln[ěe]n|chia\b|konopn|quino|pohank|r[ýy]ž|amarant|tapiok|kuskus|cous ?cous|bulgur|polent|bat[áa]t|maniok|j[áa]hl|jagl|[čc]o[čc]k|cizrn|fazol|hrach|urid|lentil|s[óo]j|soja|tofu|tempeh|edamame|o[řr]ech|o[řr][íi][šs]k|mandl|l[íi]sk|ke[šs]u|pist[áa]c|pekan|makadam|para ?o[řr]ech|vla[šs]sk\w*\s+o[řr]ech|o[řr]ech\w*\s+vla[šs]sk|vla[šs][áa]k|ara[šs][íi]d|peanut|rozink|su[šs]en(é|ého|á|ých)?\s?(ovoce|raj[čc]|meru[ňn]|šípk|brusink|hrozink)|kuku[řr]ic|celer|petržel|kapust|[řr]epa\b|[čc]erven[áa].?[řr]ep|p[oó]r|oliv|brusink|sem[íi]n|semen|kl[íi][čc]k|tahini|hummus|ag[áa]v|džus|juice|[šs][ťt][áa]v(?!n)|mošt|ocet|cukr(?![aáoóeéě])|s[ůu]l\b|ko[řr]en[íi]|pep[řr]\b|km[íi]n|major[áa]n|sko[řr]ic|vanilk|bazalk|oreg[áa]n|tymi[áa]n|rozmar[ýy]n|pa[žz]itk|bobkov|kurkum|z[áa]zvor|[šs]krob|psyllium|koprov|kop[áa]r|levandul|m[áa]ta|he[řr]m[áa]n|[šs][íi]pk|lipov|medu[ňn]k|kop[řr]iv|přesli[čc]k|vlo[čc]k|oves|ovsen|[žz]itn|p[šs]en|je[čc]men|špald|spelt|triti/i;

/* --- mléko/vejce/med – vegetariánské, ne veganské --- */
const MLAKO_VAJECE_MED_RE =
  /ml[eé]k|s[ýy]r|tvaroh|jogurt|zakysan|smetan|m[áa]sl|kef[íi]r|skyr|mozzarell|eidam|gouda|parmez|parmesan|\bniv|hermel|emental|balk[áa]nsk|ricott|mascarpone|puding|zmrzlin|nanuk|[čc]okol[áa]d|srv[áa]tk|whey|kazein|kasein|casein|laktoz|bechamel|feta\b|bryndz|parenic|camembert|cheddar|brie\b|lu[čc]in|lip[áa]nek|vejce|vaje[čc]n|vajec|vaj[íi][čc]|vaj\b|[žz]loutk|majon[eé]z|mayo\b|egg\b|tiramisu|medov|med\b|vosk|propolis/i;

/* --- kompozitní názvy bez masa = vegetariánské (chléb, těstoviny,
   müsli, kaše, pečivo…) – mléko/vejce/med smí, maso/želatinu ne.
   Záměrně BEZ želé/gelee (želatina!) a paštik/terrin (maso). --- */
const VEG_KOMPOZIT_RE =
  /chl[éeé]b(?!íč)|rohl[íi]k|housk|baget|t[ěe]stovin|nudl|[šs]paget|lasagn|penne|fusill|farfalle|tagliatell|rigatoni|gnocchi|makaron|knedl|mouk|múk|strouhan|panko|tarhoň|pern[íi]k|kol[áa][čc]|bucht|croissant|koblih|su[šs]enk|pizza|tortill|wrap\b|kn[äa]ck|crispbread|crackers?|[šs]trúdl|strudl|[čc]ere[áa]l|kaše|pe[čc]iv|toust|lineck|vanilkov|pomaz[áa]n|keks|oplatk|oblátk|vafle|wafl|dort|z[áa]kusk|puding|bonb|karamel|halva|lokum|marcip[áa]n|dražé|nanuk|zmrzlin|sirup|džem|marmel|kompot|nug[áa]t|nougat|pralin|kakaov|kakao\b|energ[íi]ck|ty[čc]ink|protein|müsli|musli|granola/i;

/* --- kompozitní pečivo/hotovky/tyčinky – mléko, vejce, máslo nebo
   med v nich název neprokáže → nemůžou být „dokazatelně" veganské.
   Vegetariánské být můžou (přes VEG_KOMPOZIT). --- */
const NEVEGAN_KOMPOZIT_RE =
  /cake|brioche|plumcake|kol[áa][čc]|bucht|croissant|donut|muffin|cupcake|brownie|su[šs]enk|keks|vafle|wafl|oplatk|oblátk|lineck|vanilkov|tart|str[úu]dl|pizza|tortill|wrap\b|baget|toust|toast|sendvi[čc]|burger|chl[éeé]b(?!íč)|rohl[íi]k|housk|knedl|t[ěe]stovin|nudl|[šs]paget|pasta\b|gnocchi|lasagn|pe[čc]iv|snack\b|müsli|musli|granola|kaše|[čc]ere[áa]l|puding|dort|z[áa]kusk|pomaz[áa]n|p[íi]roh|z[áa]vin|mazanec|v[áa]no[čc]k|frg[áa]l|medovn[íi]k|pern[íi]k|koblih|vdol|trdeln[íi]k|laskonk|kremrol|pi[šs]kot|b[áa]bovk|dražé|nanuk|zmrzlin|mousse|ty[čc]ink|crackers?|crispbread|kn[äa]ck|topink|crouton|topink/i;

/* --- veganské negativum: živočišné nebo nedokazatelně rostlinné --- */
const NENI_VEGAN_RE = new RegExp(
  `(?:${NENI_VEG_RE.source})|(?:${MLAKO_VAJECE_MED_RE.source})|(?:${NEVEGAN_KOMPOZIT_RE.source})`, "i");

/* --- rostlinná „máslo" (arašídové, kešu, kakaové…) – pro vegan test
   stejné vynechání frází jako má alergenová síť --- */
const MASL_ROSTL_RE = ALERGEN_FRAZE_VYNECH.mleko;

const { rows } = await c.query("select id, nazev, alergeny, diety from public.foods order by id");
console.log(`Katalog: ${rows.length} položek\n`);

const zmeny = new Map(); // id -> { alg:[], diet:[] }
const statAlg = new Map(), statDiet = new Map();
const vzorkyAlg = new Map(), vzorkyDiet = new Map();

for (const r of rows) {
  const nazev = r.nazev ?? "";
  const alg = new Set(r.alergeny ?? []);
  const diet = new Set(r.diety ?? []);

  // alergeny dle názvu (jen přidat; síť respektuje „bez X" a fráze)
  for (const klic of Object.keys(ALERGEN_Z_NAZVU)) {
    if (!alg.has(klic) && nazevNasvedcujeAlergenu(nazev, klic)) {
      alg.add(klic);
      statAlg.set(klic, (statAlg.get(klic) ?? 0) + 1);
      if ((vzorkyAlg.get(klic)?.length ?? 0) < 6) {
        vzorkyAlg.set(klic, [...(vzorkyAlg.get(klic) ?? []), nazev]);
      }
    }
  }

  // diety: vegansky (čistě rostlinné), vegetariansky (+ mléko/vejce/kompozity)
  const nazevBezRostlMasla = nazev.replace(MASL_ROSTL_RE, " ");
  const neniVeg = NENI_VEG_RE.test(nazev);
  const rostl = ROSTLINNE_RE.test(nazev);
  const mlekovej = MLAKO_VAJECE_MED_RE.test(nazevBezRostlMasla);
  const kompozit = VEG_KOMPOZIT_RE.test(nazev);
  const noveDiet = new Set();
  if (!neniVeg) {
    if (rostl && !NENI_VEGAN_RE.test(nazevBezRostlMasla)) noveDiet.add("vegansky");
    if (rostl || mlekovej || kompozit) noveDiet.add("vegetariansky");
    if (noveDiet.has("vegansky")) noveDiet.add("vegetariansky");
  }
  for (const d of noveDiet) {
    if (!diet.has(d)) {
      diet.add(d);
      statDiet.set(d, (statDiet.get(d) ?? 0) + 1);
      if ((vzorkyDiet.get(d)?.length ?? 0) < 8) {
        vzorkyDiet.set(d, [...(vzorkyDiet.get(d) ?? []), nazev]);
      }
    }
  }

  if (alg.size !== (r.alergeny ?? []).length || diet.size !== (r.diety ?? []).length) {
    zmeny.set(r.id, { alg: [...alg], diet: [...diet] });
  }
}

console.log(`=== ALERGENY – nové tagy (${[...statAlg.values()].reduce((a, b) => a + b, 0)} celkem) ===`);
for (const [k, n] of [...statAlg.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${k}: +${n}  |  ${vzorkyAlg.get(k).join("; ")}`);
console.log(`\n=== DIETY – nové tagy (${[...statDiet.values()].reduce((a, b) => a + b, 0)} celkem) ===`);
for (const [k, n] of [...statDiet.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${k}: +${n}  |  ${vzorkyDiet.get(k).join("; ")}`);
console.log(`\nDotčených řádků: ${zmeny.size}/${rows.length}`);

if (!process.argv.includes("--apply")) {
  console.log("DRY-RUN – pro zápis spusť: node scripts/dopln_tagy.mjs --apply");
  await c.end();
  process.exit(0);
}

let hotovo = 0;
await c.query("begin");
try {
  for (const [id, v] of zmeny) {
    await c.query("update public.foods set alergeny = $2, diety = $3 where id = $1", [id, v.alg, v.diet]);
    hotovo++;
  }
  await c.query("commit");
} catch (e) {
  await c.query("rollback");
  throw e;
}
console.log(`✔ Zapsáno ${hotovo} řádků.`);
await c.end();
