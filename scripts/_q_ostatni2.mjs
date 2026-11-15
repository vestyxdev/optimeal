import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// ostatni -> maso_ryby: skutecne masne/rybi produkty (vynechat prichute, pomazanky, tofu)
const a = await c.query(`select nazev, bilkoviny from foods where kategorie = 'ostatni' and (nazev ~* '\\y(sardink|sardel|makrel|sle[ďd]|losos|tu[ňn][aá]k|kapr\\y|pstruh|sumec|okoun|parma|karban[aá]tek|karbanátek|steak\\y|klob[aá]s|špek[aá][cč]ek|krvavnic|p[aá]rk|sal[aá]m\\y|šunk|jerky|bresaol|pastrami|prosciutt|speck\\y|bacon|slanin|mortadel|chorizo|pepperon|kabanos|landj|jat[ée]r|droby|srdc|j[aá]tr|ku[řr]ec[íi] (prsa|stehna|medailon|maso|nuget)|hov[eě]z[íi] (maso|gul[aá]š|kost|sv[ií][cč]kov|steak)|vep[řr]ov[éeé] (maso|kotlet|pe[cč]en|žeb[íi]r|bok|plec|krkovic)|kr[ůu]t[íi]|kr[aá]l[íi]k|ka[cč]en|hus[ay]|bažant|kr[eé]p|jehn[eě][cč][íi]|telec[íi]|zavin[aá][cč]|uzen[éé] maso|mlet[éeé] m[aä]so|masov[éeé] kuli[cč]ky|masov[ýy] sal[aá]t|ťamanc|prawns|krevet)' ) order by nazev limit 60`);
a.rows.forEach(x => console.log("MASO?", x.nazev, "| b", x.bilkoviny));
console.log("celkem:", a.rows.length);
await c.end();
