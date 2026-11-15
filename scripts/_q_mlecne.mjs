import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// mlecne_vyrobky: co tam zjevne nepatri (zelenina, maso, pecivo, napoje ne-mlecne, omacky)
const r = await c.query(`select nazev, bilkoviny, tuky from foods where kategorie = 'mlecne_vyrobky' and nazev ~* 'zelenin|mrkev|brambor| rajč|okurk|fazol|čočk|maso|ku[řr]ec|hov[eě]z|vep[řr]|sard|tuňák|losos|ryb|klob[aá]s|šunk|sal[aá]m|jerky|t[eě]stovin|spaghet|nudl|r[ýy][žz]e|rohl[íi]k|housk|chleba|baget|mouk|vlo[cč]k|olej|margarin|cola|limon[aá]d|džus|v[íi]no|pivo|energy|kofol|ke[cč]up|om[aá][cč]k|dresink|majon|hor[cč]ic|cukrov|draž[ée]|sušenk|bonb|piškot' order by nazev limit 70`);
r.rows.forEach(x => console.log(x.nazev, "| b", x.bilkoviny, "| t", x.tuky));
console.log("celkem:", r.rows.length);
await c.end();
