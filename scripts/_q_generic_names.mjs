// Verify 0022
import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: heslo,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const k = await c.query(`select count(*) n from foods where nazev ~* 'ke[čc]up' and kategorie = 'ovoce_zelenina'`);
console.log("kečup v ovoce:", k.rows[0].n);
const z = await c.query(`select count(*) n from foods where nazev ~* 'žížalk|červ[iíy]|pásk' and kategorie = 'ovoce_zelenina'`);
console.log("cukroví v ovoce:", z.rows[0].n);
const m = await c.query(`select nazev from foods where nazev ~* 'mleko|mlieko|truskawkowo'`);
console.log("cizí mléko zbývá:", m.rows.length, m.rows.map((x) => x.nazev).join(" | "));
const d = await c.query(`select kategorie, count(*) n from foods group by 1 order by n desc`);
console.log(d.rows.map((x) => x.kategorie + ": " + x.n).join(", "));
await c.end();
