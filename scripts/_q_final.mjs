import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const d = await c.query(`select kategorie, count(*) n from foods group by kategorie order by n desc`);
console.log("— distribuce —"); d.rows.forEach(x => console.log(x.kategorie.padEnd(20), x.n));
// reverse: podezřelé ne-maso v maso_ryby
const m = await c.query(`select nazev from foods where kategorie='maso_ryby' and nazev ~* 'pol[ée]vk|om[aá][cč]k|chips|lup[íi]nk|mouk|sem[íi]nk|vlo[cč]k|müsli|džus|limon|čaj|káv|ml[ée]ko|jogurt|pomaz[aá]nk|ty[cč]ink|čokol|bonb|sušenk|pern|mou[cč]n|kol[aá][čc]|bucht|pe[cč]iv|chl[ée]b|housk|rohl|těstovin|r[ýy][žz]|kuskus|bulgur|pohank|quino|knedl|brambor|zelenin|ovoc' order by nazev limit 40`);
console.log("— maso_ryby podezřelé —"); m.rows.forEach(x => console.log(x.nazev));
const z = await c.query(`select nazev from foods where kategorie='ovoce_zelenina' and nazev ~* 'ty[cč]ink|čokol|bonb|sušenk|pern|kol[aá][čc]|džus|nektar|limon|nápoj|sirup|chips|lup[íi]nk|pol[ée]vk|om[aá][cč]k|mouk|ml[ée]ko|jogurt|sýr|tvaroh|máslo|margar|pomaz[aá]nk|těstovin|r[ýy][žz]e|kuskus|müsli|vlo[cč]k|kaš|cere[aá]l|chl[ée]b|housk|rohl|tortill|knedl|maso|ku[řr]ec|vep[řr]|hov[ěe]z|ryb|tu[ňn][aá]k|losos|sle[ďd]' order by nazev limit 40`);
console.log("— ovoce_zelenina podezřelé —"); z.rows.forEach(x => console.log(x.nazev));
const ml = await c.query(`select nazev from foods where kategorie='mlecne_vyrobky' and nazev ~* 'čokol[áa]d[aá]?$|ty[cč]ink|chips|lup[íi]nk|pol[ée]vk|těstovin|r[ýy][žz]e|kuskus|fazol|čočk|maso|ku[řr]ec|vep[řr]|hov[ěe]z|tu[ňn][aá]k|losos|ryb[aá]\\y|chl[ée]b|housk|rohl[íi]k|pe[cč]iv|džus|limon|káv|čaj\\y|v[íi]n|pi?v|energet|isoton' order by nazev limit 40`);
console.log("— mlecne podezřelé —"); ml.rows.forEach(x => console.log(x.nazev));
await c.end();
