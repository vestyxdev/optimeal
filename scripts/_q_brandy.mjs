import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// kam patri margariny/masla/tuky podle kategorie – co je konvence?
const r = await c.query(`select nazev, kategorie, tuky from foods where (nazev ~* 'margar|masl|maisel|m[aá]seln|tuk|hera|perla|flora|zlat[áa] han' or nazev ~* 'rostlinn') and tuky >= 30 order by kategorie, nazev limit 60`);
r.rows.forEach(x => console.log(x.kategorie, "|", x.nazev, "|", x.tuky, "g"));
await c.end();
