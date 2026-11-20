// over_jidelnicek.mjs – audit kvality generovaného denního plánu
// na ŽIVÉM katalogu (aktualni_ceny): celá jídla, porce, zelenina,
// ceny a denní makra. Jen čte – nic nezapisuje.
// Použití: node scripts/over_jidelnicek.mjs [kcal B S T]
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
const r = await c.query("select * from aktualni_ceny");
await c.end();
console.log(`Katalog: ${r.rows.length} potravin`);

const potraviny = r.rows.map((x) => ({
  id: String(x.food_id ?? x.id), nazev: x.nazev, kategorie: x.kategorie,
  bilkoviny: +x.bilkoviny, sacharidy: +x.sacharidy, tuky: +x.tuky, kalorie: +x.kalorie,
  beznaCena: +x.bezna_cena || 15,
  aktualniCena: x.aktualni_cena != null ? +x.aktualni_cena : +x.bezna_cena || 15,
  obchod: x.obchod ?? null, sleva: !!x.sleva,
  puvodniCena: x.puvodni_cena != null ? +x.puvodni_cena : null,
  alergeny: x.alergeny ?? [], diety: x.diety ?? [], obrazek: x.obrazek ?? null,
  baleniG: x.baleni_g != null ? +x.baleni_g : null,
}));

const {
  vygenerujJidelnicek, vygenerujTydenniPlan, jeSuplementTvrdy, jeSuplementSnack,
  jeCenaSpolehliva, kusovaGramaz, klicPodobnosti, obsahujeAlergen, filtrujPotraviny,
} = await import("../src/lib/generator/generator.ts");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const tydenni = process.argv.includes("--tyden");
const argHodnota = (klic) => process.argv.find((a) => a.startsWith(`--${klic}=`))?.split("=")[1] ?? "";
const filtr = {
  diety: argHodnota("diety").split(",").filter(Boolean),
  alergeny: argHodnota("alergeny").split(",").filter(Boolean),
};
const maFiltr = filtr.diety.length > 0 || filtr.alergeny.length > 0;
const cile = {
  kalorie: +(args[0] ?? 2200),
  bilkoviny: +(args[1] ?? 150),
  sacharidy: +(args[2] ?? 220),
  tuky: +(args[3] ?? 70),
};
console.log(`Cíle: ${cile.kalorie} kcal | B ${cile.bilkoviny} | S ${cile.sacharidy} | T ${cile.tuky}${tydenni ? " | TÝDEN (7 dnů, rotace rodin)" : ""}${maFiltr ? ` | FILTR diety=[${filtr.diety}] alergeny=[${filtr.alergeny}]` : ""}\n`);

// --tyden: reálný týdenní plán (minuleDny rotace rodin), jinak 3 nezávislé dny
const dnyVysledky = tydenni
  ? Object.entries(vygenerujTydenniPlan(potraviny, cile, 4, maFiltr ? filtr : null).dny).map(([d, v]) => [+d, v])
  : [1, 2, 3].map((d) => [d, vygenerujJidelnicek(potraviny, cile, d, 0.85, 4, maFiltr ? filtr : null)]);

let problemy = 0;
const flag = (msg) => { problemy++; console.log(`      ⚠ ${msg}`); };
const rodinyKotv = new Map();

for (const [d, den] of dnyVysledky) {
  const cel = den.celkem;
  console.log(`=== Den ${d}: ${Math.round(cel.kalorie)} kcal | B ${cel.bilkoviny.toFixed(1)}/${cile.bilkoviny} | S ${cel.sacharidy.toFixed(1)}/${cile.sacharidy} | T ${cel.tuky.toFixed(1)}/${cile.tuky} | ${cel.cena.toFixed(0)} Kč ===`);
  for (const [nazev, s] of Object.entries(den.jidelnicek)) {
    const hlavni = /snídan|oběd|večeře/i.test(nazev);
    const svacina = /svačin/i.test(nazev);
    let maZeleninu = false;
    console.log(` ${nazev} (${s.kalorie.toFixed(0)} kcal, ${s.cena.toFixed(2)} Kč)`);
    for (const j of s.jidla) {
      const potravina = potraviny.find((x) => x.id === j.id);
      const cenaTxt = j.cena > 0 ? `${j.cena.toFixed(2)} Kč` : "—";
      const popisek = j.popisekMnozstvi ?? `${j.gramy} g`;
      console.log(`   [${(j.role ?? "-").padEnd(9)}] ${j.nazev} · ${popisek} · ${cenaTxt}`);
      if (j.role === "zelenina") maZeleninu = true;
      if (potravina) {
        if (hlavni && jeSuplementTvrdy(potravina) && j.role !== "suplement")
          flag(`tvrdý suplement v hlavním jídle: ${j.nazev}`);
        if (hlavni && jeSuplementSnack(potravina))
          flag(`tyčinka/shake v hlavním jídle: ${j.nazev}`);
        if (svacina && jeSuplementTvrdy(potravina))
          flag(`tvrdý suplement ve svačině: ${j.nazev}`);
        if (j.role === "suplement" && !/snídan/i.test(nazev))
          flag(`suplement mimo snídani: ${j.nazev}`);
        if (j.aktualniCena !== undefined && !jeCenaSpolehliva(potravina) && j.cena > 0)
          flag(`nespolehlivá cena zobrazena: ${j.nazev} ${j.cena} Kč`);
        for (const a of filtr.alergeny)
          if (obsahujeAlergen(potravina, a))
            flag(`alergen "${a}" v plánu i přes filtr: ${j.nazev}`);
      }
      if (kusovaGramaz(j.nazev) === null && j.gramy % 5 !== 0)
        flag(`nečistá gramáž: ${j.nazev} ${j.gramy} g`);
      if (j.cena > 0 && j.gramy >= 50 && j.cena / (j.gramy / 100) < 0.8)
        flag(`podezřele nízká cena/100g: ${j.nazev} ${j.cena} Kč za ${j.gramy} g`);
      if (j.role === "kotva" && tydenni) {
        const klic = klicPodobnosti(j.nazev);
        rodinyKotv.set(klic, (rodinyKotv.get(klic) ?? 0) + 1);
      }
    }
    if (/oběd|večeře/i.test(nazev) && !maZeleninu)
      flag(`${nazev} bez zeleninové strany`);
  }
  const tk = cel.kalorie / cile.kalorie;
  if (tk < 0.97 || tk > 1.03) flag(`kcal mimo ±3 %: ${Math.round(cel.kalorie)}`);
  for (const [m, v, c] of [["B", cel.bilkoviny, cile.bilkoviny], ["S", cel.sacharidy, cile.sacharidy], ["T", cel.tuky, cile.tuky]])
    if (v < c * 0.95 || v > c * 1.05) flag(`${m} mimo ±5 %: ${v.toFixed(1)}/${c}`);
  console.log();
}

// týdenní pestrost kotev – stejná rodina max 3× za týden
if (tydenni) {
  const opakovane = [...rodinyKotv.entries()].filter(([, n]) => n > 3).sort((a, b) => b[1] - a[1]);
  for (const [klic, n] of opakovane) flag(`kotva-rodina ${n}× za týden: ${klic}`);
  const top = [...rodinyKotv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`Nejčastější kotvy týdne: ${top.map(([k, n]) => `${k}×${n}`).join(", ")}\n`);
}

// pokrytí alergenových tagů – kolik položek by filtr propustil jen díky
// chybějícím tagům (bezpečnostní síť dle názvu je zachytí)
if (maFiltr) {
  const poFiltru = filtrujPotraviny(potraviny, filtr).length;
  const jenTagy = potraviny.filter((p) =>
    filtr.diety.every((d) => (p.diety ?? []).includes(d)) &&
    filtr.alergeny.every((a) => !(p.alergeny ?? []).includes(a))).length;
  console.log(`Filtr: ${poFiltru} potravin projde (jen tagy: ${jenTagy}, jmenná síť vyhodila dalších ${jenTagy - poFiltru})`);
}

// kolik položek katalogu má necenitelnou cenu
const necenitelne = potraviny.filter((p) => !jeCenaSpolehliva(p));
console.log(`Necenitelné položky katalogu: ${necenitelne.length}/${potraviny.length}`);
for (const p of necenitelne.slice(0, 12))
  console.log(`   ${p.nazev} · ${p.aktualniCena} Kč/100g · běžná ${p.beznaCena} · balení ${p.baleniG ?? "?"} g`);
console.log(`\n${problemy === 0 ? "Bez problémů ✔" : `${problemy} problémů ⚠`}`);
process.exit(problemy === 0 ? 0 : 1);
