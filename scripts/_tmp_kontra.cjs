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
  const g = await import("../src/lib/generator/generator.ts");
  const { rows } = await c.query(
    "select id, nazev, alergeny, diety from foods where schvaleno and diety @> '{vegetariansky}' and alergeny && '{ryby,korýši,vodnáče}'::text[]",
  );
  const veta = rows.filter((r) =>
    g.nazevVylucujeDietu(r.nazev, "vegetariansky"),
  );
  const nejasne = rows.filter((r) => !veta.includes(r));
  console.log(
    "vegetariansky+maso/ryba alergen:",
    rows.length,
    "| veto potvrdí:",
    veta.length,
    "| nejasné:",
    nejasne.length,
  );
  for (const r of veta.slice(0, 25))
    console.log("VETO:", r.nazev, "| A:", (r.alergeny ?? []).join(","));
  for (const r of nejasne.slice(0, 15))
    console.log("NEJASNE:", r.nazev, "| A:", (r.alergeny ?? []).join(","));
  await c.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
