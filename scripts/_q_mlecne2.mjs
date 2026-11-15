import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// ostatni: skutecne mlecne vyrobky (syry, tvaroh, jogurt – NE napoje, NE pomazanky)
const a = await c.query(`select nazev from foods where kategorie = 'ostatni' and nazev ~* 'hermel[íi]n|eidam|gouda|cheddar|edam|parmaz[aá]n|parmesan|mozzarell|niva|salan|bl[aá]t[aá][cč]k|jerm[aá]r|balk[aá]nsk[ýy] s[ýy]r|s[ýy]r\\y|s[ýy]rov[ýy]|tvaroh\\y|quark|ricott|mascarpone|camembert|brie\\y|feta|halloumi|korb[aá][cč]|parenic|ošt[ěe]pek|jogurt\\y|jogurtov[ýy] (?!nápoj)|skyr|kef[íi]r\\y|zakysan|smetan[aá]\\y|šleha[cč]k|ml[ée]ko\\y|mlecny\\y|podm[aá]sl[íi]|m[aá]slo\\y|gh[íi]\\y|pudink|pudding|tvarohov[ýy]|s[ýy]r se|s[ýy]r s' order by nazev limit 70`);
a.rows.forEach(x => console.log("MLEC?", x.nazev));
console.log("celkem:", a.rows.length);
await c.end();
