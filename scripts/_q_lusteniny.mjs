import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// Lusteniny v ostatni – kde konvence umi? Porovnat s ovoce_zelenina
const a = await c.query(`select kategorie, count(*) as n from foods where nazev ~* '\\y(c[íi]zern|hrach(?!ov)|fazol|lušt|lusten|čočk|cocka|lusk|bob\\y)' group by kategorie order by n desc`);
a.rows.forEach(x => console.log(x.kategorie.padEnd(20), x.n));
const b = await c.query(`select nazev, kategorie from foods where nazev ~* '\\y(c[íi]zern|hrach(?!ov)|fazol|čočk|cocka)' and kategorie in ('ostatni','ovoce_zelenina','maso_ryby','peckoviny_obily','suchary_testoviny','mlecne_vyrobky') order by kategorie, nazev limit 80`);
b.rows.forEach(x => console.log(x.kategorie.padEnd(18), x.nazev));
await c.end();
