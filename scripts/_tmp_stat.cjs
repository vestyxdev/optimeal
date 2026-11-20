const pg = require("pg");
const fs = require("fs");
const heslo = fs
  .readFileSync(".env.local", "utf8")
  .match(/SUPABASE_DB_PASSWORD=(.+)/)[1]
  .trim();
const c = new pg.Client({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: heslo,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
async function main() {
  await c.connect();
  const r = await c.query(`
    select kategorie, count(*) n
    from foods where schvaleno and (obrazek is null or obrazek = '')
    group by kategorie order by n desc`);
  console.table(r.rows);
  const r2 = await c.query(`
    select nazev, ean is not null as ean, zdroj
    from foods where schvaleno and (obrazek is null or obrazek = '')
    order by kategorie limit 30`);
  for (const x of r2.rows) console.log(x);
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
