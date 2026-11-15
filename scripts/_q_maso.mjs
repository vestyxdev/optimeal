import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// maso_ryby: co tam nepatri
const a = await c.query(`select nazev, kategorie from foods where kategorie = 'maso_ryby' and nazev ~* 'čokolád|sušenk|tyčink|bar\\y|protein.*bar|vlo[cč]k|m[úu]sl|cere[aá]l|r[ýy][žz]e|t[eě]stovin|pol[ée]vk|pudink|sirup|džus|nektar|limon[aá]d|v[íi]no|dresink|om[aá][cč]k|pomaz[aá]nk|tofu|tempeh|seitan|margarin|syr|jogurt|tvaroh|smetan|m[ée]k|mlecne|napoj|proteinov[ée] pl[aá]tky|chips|bramb[úu]r' order by nazev limit 50`);
a.rows.forEach(x => console.log("MASO?", x.nazev));
console.log("--- suchary_testoviny anomalie:");
const b = await c.query(`select nazev from foods where kategorie = 'suchary_testoviny' and nazev ~* 'maso|ku[řr]ec|hov[eě]z|ryb|tu[ňn][aá]k|losos|jogurt|tvaroh|s[ýy]r|smetan|ml[ée]k|kef[íi]r|zelenin|mrkev|brambor|okurk|raj[cč]|sal[aá]t\\y|fazol|čočk|r[ýy][žz]e|kuskus|bulgur|olej|margarin|pol[ée]vk|om[aá][cč]k|dresink|ke[cč]up|majon|hor[cč]ic|ocet|s[úu]l\\y|ko[řr]en|džus|nektar|cola|limon[aá]d|v[íi]no|pivo|energy' order by nazev limit 50`);
b.rows.forEach(x => console.log("SUCH?", x.nazev));
await c.end();
