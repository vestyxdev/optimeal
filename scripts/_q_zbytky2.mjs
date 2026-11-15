import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const b = await c.query(`select count(*) filter (where baleni_g is not null) as s, count(*) as vse from foods`);
console.log(`baleni_g: ${b.rows[0].s}/${b.rows[0].vse} (${(b.rows[0].s/b.rows[0].vse*100).toFixed(1)}%)`);
// ostatni: pecivo/cemale peckoviny + suchary kandidati
const a = await c.query(`select nazev from foods where kategorie='ostatni' and nazev ~* '\\y(chl[ée]b|housk|rohl[íi]k|rožk|baget|dalam[aá]n|toastov[ýy] chl[ée]b|pšeničn[ýy] chl[ée]b|žitn[ýy] chl[ée]b|chleb[íi][cč]k|tortill|wrap\\y|pita|baguett|croissant|croissan|kaiser|kornspitz|sumavsk|injektor|mazanec|v[aá]no[cč]k|briošk|focacci|ciabatt|kulich|challa|žeml|bread\\y|flatbread|naan|pumpernikel|pasta\\y|špaget|těstovin|nudl|penne|fusill|tagliatell|spaghetti|lasagn|raviol|gnocchi|couscou|kuskus|bulgur|quino|pohank|pšen|amarant|rýže\\y|rýžov[ýy]|ječm|ovesn[éé] vlo[cč]k|vlo[cč]k|musli|müsli|granul|granola|kaš[ei]|cere[aá]l|semolin|krupic|krupi[cč]k|mouk[aá]|mouka\\y|perník|pernik|sušenk|susenk|cookie|biscuit|oplatk|hosti|trubičk|trubick|piškot|piskot|wafel|vafle|koláč|kol[aá][cč]k|bucht|donut|muffin|brownie|lup[ée]n|štr[úú]dl|zavin|závin|dort\\y|cake\\y|tartlet|tart\\y|pusink|marcip|marcip[aá]n|nug[aá]t|karamelk|bonb[oó]n|žel[eé] bonb|tyc[cč]ink|tyčink|ty[cč]inka|bar\\y|proteinov[áa] ty[cč]|müsli ty[cč]|energi ty[cč]|chips|lup[íi]nk|brambur|bramb[ůu]rk|snack\\y|krek|rice cake|rýžov[éé] chleb[íi][cč]k|puff|extrud|sol[ée]n[éé] ty[cč]|precl[íi]k|slan[éeé] ty[cč]|breadstick|grissin)' order by nazev limit 200 offset 100`);
a.rows.forEach(x => console.log("KAND:", x.nazev));
console.log("celkem:", a.rows.length);
await c.end();
