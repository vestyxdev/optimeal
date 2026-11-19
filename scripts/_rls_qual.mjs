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
  select tablename, policyname, cmd, qual, with_check
  from pg_policies where schemaname='public'
  order by tablename, policyname
`);
for (const r of rows) {
  console.log(`\n== ${r.tablename} / ${r.policyname} (${r.cmd})`);
  console.log(`  qual: ${r.qual}`);
  console.log(`  check: ${r.with_check}`);
}
await pool.end();
