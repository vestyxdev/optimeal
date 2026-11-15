import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// zbytky: cerstve ovoce/zelenina a kusy masa v ostatni
const a = await c.query(`select nazev from foods where kategorie='ostatni' and nazev ~* '\\y(jablko|jablka|jablko |hrušk|ban[aá]n|pomeran[cč]|pomeranč|mandarink|kiwi|hroznov|hrozen|jahod|malin|bor[ůu]vk|ostružin|ryb[íi]z|švestk|meru[ňn]k|broskv|nektarink|meloun|ananas|mango\\y|avok[aá]d|citron|citron[éeé]|limet|grep\\y|pomeran[cč]ov[ýy]|brusink|brusink|čern[ýy] ryb[íi]z|vinn[éé] hrozn|mrkev\\y|mrkv|brambor|brambory|raj[cč]e|rajc|okurk|paprik|kapust|cuket|d[ýý]n|brokolic|kv[ěe]t[aá]k|zel[íi]\\y|sal[aá]t\\y|špen[aá]t|spenat|cibul|česnek|cesnek|pórek|porek|petržel|petrzel|ředkev|redkev|řepa\\y|repa\\y|avokad|houby|žampion|zampion|hl[íi]va|bedl|bramborov[ýy] šal[aá]t)' order by nazev limit 80`);
a.rows.forEach(x => console.log("ZEL?:", x.nazev));
console.log("celkem:", a.rows.length);
await c.end();
