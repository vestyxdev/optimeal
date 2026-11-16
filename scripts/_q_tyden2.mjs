import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("select food_id id, nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie, bezna_cena, aktualni_cena, obchod, sleva from aktualni_ceny");
await c.end();
const potraviny = r.rows.map((x) => ({ id: String(x.id), nazev: x.nazev, kategorie: x.kategorie, bilkoviny: +x.bilkoviny, sacharidy: +x.sacharidy, tuky: +x.tuky, kalorie: +x.kalorie, beznaCena: +x.bezna_cena || 15, aktualniCena: +x.aktualni_cena || 15, obchod: x.obchod ?? null, sleva: !!x.sleva }));
const { vygenerujTydenniPlan } = await import("../src/lib/generator/generator.ts");
const t = vygenerujTydenniPlan(potraviny, { kalorie: 2200, bilkoviny: 150, sacharidy: 220, tuky: 70 });
for (const [den, vysledek] of Object.entries(t.dny)) {
  console.log("DEN " + den);
  for (const [k, v] of Object.entries(vysledek.jidelnicek))
    console.log("  " + k.padEnd(8) + " => " + v.jidla.map((j) => j.nazev + " " + j.gramy + "g").join(" + "));
}
