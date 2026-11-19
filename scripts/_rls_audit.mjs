import pg from "pg";
process.loadEnvFile(".env.local");
const pool = new pg.Pool({
  host: process.env.SUPABASE_POOLER ?? "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb"}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
const { rows } = await pool.query(`
  select tablename, policyname, cmd, roles::text
  from pg_policies where schemaname='public'
  order by tablename, cmd, policyname
`);
for (const r of rows) console.log(`${r.tablename} | ${r.cmd} | ${r.policyname} | ${r.roles}`);
const { rows: rls } = await pool.query(`
  select tablename, rowsecurity from pg_tables where schemaname='public' order by 1
`);
console.log("\n--- RLS enabled ---");
for (const r of rls) console.log(`${r.tablename}: ${r.rowsecurity}`);
const { rows: idx } = await pool.query(`
  select tablename, indexname from pg_indexes
  where schemaname='public' order by tablename
`);
console.log("\n--- Indexy ---");
for (const r of idx) console.log(`${r.tablename}: ${r.indexname}`);
await pool.end();
