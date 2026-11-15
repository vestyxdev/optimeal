import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
for (const [kat, re] of [
  ["maso_ryby", "(lup[íi]nk|sem[íi]nk)"],
  ["ovoce_zelenina", "(chips|lup[íi]nk|pol[ée]vk|gazpacho|džem|mošt|hašlerk|fruit roll|kaštanov|pečivo|kaš|ryžov)"],
  ["mlecne_vyrobky", "(pol[ée]vk|chips|máslo|čokoláda$|sorbetto|tyčinky se sýrem|sýrové tyčinky)"],
]) {
  const r = await c.query(`select nazev from foods where kategorie=$1 and nazev ~* $2 order by nazev`, [kat, re]);
  console.log(`—— ${kat} ——`);
  r.rows.forEach(x => console.log(x.nazev));
}
// kolize pro rename
const k = await c.query(`select nazev from foods where nazev ~* 'Fit rýžov|kaša|Usovsko'`);
console.log("—— kaša ——"); k.rows.forEach(x => console.log(x.nazev));
await c.end();
