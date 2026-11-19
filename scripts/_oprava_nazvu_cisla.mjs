// Oprava názvů potravin se SKU/bare-EAN prefixem z OFF importu
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import pg from "pg";

process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"));
const pool = new pg.Pool({
  host: `aws-0-eu-west-2.pooler.supabase.com`,
  port: 6543,
  user: `postgres.${process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb"}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

// 1) název = samotné EAN → bez názvu, schovat z katalogu
const skryte = await pool.query(
  `update public.foods set schvaleno = false
   where nazev = ean and nazev ~ '^[0-9]{8,14}$' returning id, nazev`
);
console.log("skryté (název=EAN):", skryte.rows);

// 2) číselný prefix + reálný zbytek → oříznout prefix
const opravene = await pool.query(
  `update public.foods set nazev = regexp_replace(nazev, '^[0-9]{4,}\\s+', '')
   where nazev ~ '^[0-9]{4,}\\s+\\D' returning id, nazev`
);
console.log("ořezané prefixy:", opravene.rows);
await pool.end();
