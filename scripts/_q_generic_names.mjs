// Verify 0021
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
const r = await c.query(`select count(*) n from foods where nazev ~ '[Ѐ-ӿ]'`);
console.log("cyrillic:", r.rows[0].n);
const r2 = await c.query(`select count(*) n from foods where nazev ~ '&[a-z]+;'`);
console.log("entities:", r2.rows[0].n);
const r3 = await c.query(
  `select nazev, kategorie from foods where nazev in
   ('Kinder Chocolate','Monster Energy Original','Těstoviny spirály','Třešně (čereshi)','Psyllium vláknina (Dragon Superfoods)','Zlatý Bažant 12%')`,
);
console.log(r3.rows.map((x) => x.nazev + " [" + x.kategorie + "]").join(" | "));
await c.end();
