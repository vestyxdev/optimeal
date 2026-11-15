import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// konvence: kde ziji orechy, luSteniny, dzusy, mouka, pomazanky
const q = async (re, label) => {
  const r = await c.query(`select kategorie, count(*) n, string_agg(nazev, ' | ' order by nazev) vzor from foods where nazev ~* '${re}' group by kategorie order by n desc`);
  console.log(`== ${label}`);
  r.rows.forEach(x => console.log("  ", x.kategorie, x.n, ":", x.vzor.slice(0, 140)));
};
await q("vlašsk|mandle|pistác|kešu|lískov", "orechy");
await q("fazol|čočk|hrach|cizrn", "lusteniny");
await q("džus|dzus|juice|100%.*šťáv|nektar", "dzusy");
await q("\\ymouk", "mouka");
await q("pomazánk", "pomazanky");
await q("jogurtový nápoj|jogurtový drink|nápoj jogurtový", "jogurtove napoje");
await q("sardink|makrel|losos", "ryby konzervy");
await q("slunečnicov|chia sem|lněn|mák\\y", "seminka");
await c.end();
