import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// cilove nazvy nesmi existovat (UNIQUE nazev)
const cile = ["Losos uzený kousky","Uzený losos","Bezlaktozový tvaroh","Balkánský sýr (Fresh)","Basmati rýže","Basmati rýže (Lagris)","Meruňkový nektar","Seafoo tofu uzený","Athenikos bílý jogurt","Ananasové plátky (Giana Bucati)","Bez laktózy jogurt borůvka","Podmáslí ananas-kokos","Oplatka s lískooříškově-kakaovou náplní 48 % (alpské mléko)"];
const r = await c.query("select nazev from foods where nazev = any($1)", [cile]);
console.log("kolize:", r.rows.length === 0 ? "zadne" : r.rows.map(x=>x.nazev));
// puvodni nazvy existuji?
const stavajici = ["Merňkový nektar","Seafoo tofu tuned","Losos uzeny kousky","Uzeny Losos","Bezlaktozovy Tvaroh","Balkánsky syr (Fresh)","Athenikos bíý jogurt","Basmati ryze","Basmati ryze (Lagris)","Ananas giana bucati","Bez laktozy jogurt boruvka","Butter Milch (Ananas/Kokos)"];
const s = await c.query("select nazev from foods where nazev = any($1)", [stavajici]);
console.log("existujici:", s.rows.map(x=>x.nazev));
await c.end();
