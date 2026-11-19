// Rychlé statistiky live DB po asortimentním ingestu.
// node scripts/statistiky_db.mjs
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));

const db = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const { rows: f } = await db.query(`
  select count(*)::int as celkem,
         count(*) filter (where schvaleno)::int as schvalene,
         count(*) filter (where not schvaleno)::int as neschvalene,
         count(*) filter (where kalorie > 0)::int as s_makry,
         count(*) filter (where schvaleno and kalorie > 0
              and bilkoviny > 0 and sacharidy > 0 and tuky > 0)::int as plna_makra,
         count(*) filter (where schvaleno)::float as schv_celkem
  from foods
`);
const g = (x) => new Intl.NumberFormat("cs-CZ").format(x);
const r = f[0];
console.log(`POTRAVINY  celkem ${g(r.celkem)} | schválené ${g(r.schvalene)} | neschválené ${g(r.neschvalene)}`);
console.log(`  makra>0 ${g(r.s_makry)} | plná makra u schválených ${g(r.plna_makra)} (${Math.round(100 * r.plna_makra / r.schv_celkem)} %)`);

const { rows: z } = await db.query(`
  select zdroj, count(*)::int as n,
         count(distinct food_id)::int as potravin,
         max(pozorovano_at) as posledni
  from price_observations group by zdroj order by n desc
`);
console.log("\nPOZOROVÁNÍ dle zdroje:");
for (const x of z) {
  const d = x.posledni ? new Date(x.posledni).toISOString().slice(0, 16).replace("T", " ") : "-";
  console.log(`  ${(x.zdroj || "?").padEnd(28)} ${g(x.n).padStart(7)} pozor.  ${g(x.potravin).padStart(6)} potravin  poslední ${d}`);
}

const { rows: o } = await db.query(`
  select r.nazev, count(*)::int as n
  from price_observations po join retailers r on r.id = po.retailer_id
  group by r.nazev order by n desc limit 12
`);
console.log("\nPOZOROVÁNÍ dle obchodu:");
for (const x of o) console.log(`  ${x.nazev.padEnd(22)} ${g(x.n).padStart(7)}`);

await db.end();
