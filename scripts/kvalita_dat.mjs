// kvalita_dat.mjs – report podezřelých zdrojových dat v katalogu pro
// ruční/automatickou opravu. Jen čte – nic nezapisuje.
//   1) „fantomové kalorie" u jídel: deklarované kcal vs. odhad z maker
//      (4B+4S+9T) se liší > 35 % → generátor položky z plánů vylučuje,
//      každá opravená řádka vrací reálnou potravinu do fondu.
//   2) dietní kontradikce: vegansky/vegetariansky tag u názvu, který
//      runtime veto (nazevVylucujeDietu) z plánu vyloučí – tag kazí
//      jen katalogovou kartu, patří opravit v DB.
//   3) chybějící „mleko" alergen u názvů, které jmenná síť
//      (nazevNasvedcujeAlergenu) pozná – runtime kryje, tag doplnit.
// Použití: node scripts/kvalita_dat.mjs [--csv] [--vse]  (--vse = i
//          nepotraviny/alkohol, jinak jen položky vhodné do plánu)
import pg from "pg";
import fs from "node:fs";

const CSV = process.argv.includes("--csv");
const VSE = process.argv.includes("--vse");
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new pg.Client({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: heslo,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const { rows } = await c.query(
  "select id, nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, alergeny, alergeny_stopy, diety from foods order by nazev",
);
await c.end();

const { nazevVylucujeDietu, nazevNasvedcujeAlergenu } = await import(
  "../src/lib/generator/generator.ts"
);

// zjevné ne-jídlo / alkohol / koření – fantom u nich nevadí (do plánu
// se stejně nedostanou jinými bany), report držíme u použitelných řádek
const NEJIDLO =
  /v[íi]no|prosecco|sekt\b|champagne|veltl|chardonn|sauvignon|riesling|ryzlink|merlot|pinot|syrah|shiraz|malbec|tempranillo|grenache|primitivo|cabernet|frankovka|muskat|muscat|p[áa]lava|bobul|bordeaux|chianti|rioja|cava\b|spumante|frizzante|moscato|gr[üu]ner|m[üu]ller|sommelier|vina[řr]n|sklep|pivo\b|pilsner|urquell|kru[šs]ovice|radegast|staropramen|budvar|zlatopramen|le[žz][áa]k|gambrinus|kozel\b|platan|desperados|strongbow|whisk|whiskey|gin\b|rum\b|vodka|lik[ée]r|j[äa]germeister|fernet|tuzem[áa]k|malibu|kahl[úu]a|absinth|brandy|cognac|tequila|martini|campari|aperol|cider|cyder|mimosa|mojito|tabasco|becherovka|alkohol|% obj|energy drink|monster\b|guarana|erythritol|xylitol|sladidlo/i;

const fantomy = [];
const dietySpatne = [];
const mlekoChybi = [];
const stopyMimoAlergeny = [];

for (const r of rows) {
  const nazev = r.nazev ?? "";
  const dekl = +r.kalorie || 0;
  const odhad = 4 * (+r.bilkoviny || 0) + 4 * (+r.sacharidy || 0) + 9 * (+r.tuky || 0);
  const zaklad = Math.max(dekl, odhad);
  const lisi = zaklad > 30 && Math.abs(dekl - odhad) / zaklad > 0.35;
  if (lisi && (VSE || !NEJIDLO.test(nazev))) {
    fantomy.push({
      id: r.id, nazev, kategorie: r.kategorie, dekl,
      odhad: Math.round(odhad),
      smer: dekl > odhad ? "nadhodnoceno" : "podhodnoceno",
    });
  }
  const diety = r.diety ?? [];
  for (const d of diety) {
    if (nazevVylucujeDietu(nazev, d)) {
      dietySpatne.push({ id: r.id, nazev, tag: d });
    }
  }
  if (!(r.alergeny ?? []).includes("mleko") && nazevNasvedcujeAlergenu(nazev, "mleko")) {
    mlekoChybi.push({ id: r.id, nazev });
  }
  // invariant: stopy ⊆ alergeny – stopa mimo union pole = chyba zápisu
  for (const s of r.alergeny_stopy ?? []) {
    if (!(r.alergeny ?? []).includes(s)) stopyMimoAlergeny.push({ id: r.id, nazev, s });
  }
}

if (CSV) {
  console.log("sekce;id;nazev;detail");
  for (const x of fantomy) console.log(`fantom;${x.id};${x.nazev};dekl ${x.dekl} vs makra ${x.odhad} (${x.smer})`);
  for (const x of dietySpatne) console.log(`dieta;${x.id};${x.nazev};${x.tag}`);
  for (const x of mlekoChybi) console.log(`mleko;${x.id};${x.nazev};chybi tag mleko`);
  for (const x of stopyMimoAlergeny) console.log(`stopy;${x.id};${x.nazev};stopa ${x.s} není v alergeny`);
} else {
  console.log(`== Fantomové kalorie u jídel (vyloučeno z plánů): ${fantomy.length} ==`);
  for (const x of fantomy) {
    console.log(`  ${String(x.dekl).padStart(4)} vs ${String(x.odhad).padStart(4)} | ${x.nazev} | ${x.kategorie} | ${x.smer} | #${x.id}`);
  }
  console.log(`\n== Dietní tagy, které veto z plánu stejně vyloučí: ${dietySpatne.length} ==`);
  for (const x of dietySpatne) console.log(`  ${x.nazev} | ${x.tag} | #${x.id}`);
  console.log(`\n== Chybějící tag „mleko" (jmenná síť by ho poznala): ${mlekoChybi.length} ==`);
  for (const x of mlekoChybi) console.log(`  ${x.nazev} | #${x.id}`);
  console.log(`\n== Stopy mimo alergeny (porušený invariant stopy ⊆ alergeny): ${stopyMimoAlergeny.length} ==`);
  for (const x of stopyMimoAlergeny) console.log(`  ${x.nazev} | ${x.s} | #${x.id}`);
}
