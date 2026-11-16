import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select
  count(*) filter (where f.baleni_g is null)::int bez_cen,
  count(*) filter (where f.baleni_g is not null)::int s_cenou,
  (select count(*) from aktualni_ceny)::int cenovych_celkem
  from aktualni_ceny a join foods f on f.id = a.food_id`);
console.log("v aktualni_ceny (zobrazované):", r.rows[0]);
const r2 = await c.query(`select kategorie, count(*)::int n from foods where baleni_g is null group by kategorie order by n desc`);
console.log("chybějící baleni_g podle kategorie:", r2.rows);
await c.end();
