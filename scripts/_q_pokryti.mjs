import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("select count(*)::int celkem, count(baleni_g)::int baleni, count(ean)::int eany, count(obrazek)::int obrazky from foods");
console.log(r.rows[0]);
await c.end();
