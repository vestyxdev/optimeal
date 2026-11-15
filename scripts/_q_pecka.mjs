import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// peckoviny_obily: co tam nepatri (mlecne, maso, sladkosti, napoje, suroviny)
const a = await c.query(`select nazev from foods where kategorie = 'peckoviny_obily' and nazev ~* 'jogurt|tvaroh|s[ýy]r\\y|smetan|ml[ée]k|kef[íi]r|maso|ku[řr]ec|hov[eě]z|vep[řr]|ryb|tu[ňn][aá]k|losos|sard|šunk|sal[aá]m|jerky|čokol[aá]d\\y|bonb|žel[ée]|cukrov|draž|olej|margarin|ocet|s[úu]l\\y|ko[řr]en|džus|nektar|cola|limon[aá]d|v[íi]no|pivo|energy|pol[ée]vk|om[aá][cč]k|ke[cč]up|majon|hor[cč]ic|dresink|zelenin|mrkev|brambor|okurk|sal[aá]t\\y|fazol|čočk|avok[aá]d|jablko\\y|ban[aá]n\\y' order by nazev limit 60`);
a.rows.forEach(x => console.log("PECKA?", x.nazev));
console.log("celkem:", a.rows.length);
await c.end();
