import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (re, label) => {
  const r = await c.query(`select kategorie, count(*) n, string_agg(nazev, ' | ' order by nazev) vzor from foods where nazev ~* '${re}' group by kategorie order by n desc`);
  console.log(`== ${label}`);
  r.rows.forEach(x => console.log("  ", x.kategorie, x.n, ":", x.vzor.slice(0, 130)));
};
await q("čokolád|čoko", "cokolady");
await q("cere[aá]l|m[úu]sl[iy]|granola|kaš[eé]", "cerealie");
await q("ty[cč]ink|bar\\y|flapjack|flap jack", "tycinky");
await q("\\yčaj\\y|nektar|cola|kofol|perliv|v[íi]no|džus|dobr[áa] vod", "napoje");
await q("ryze|r[ýy][žz]e", "ryze");
await q("hamburger|housk|rohl[íi]k|chleba|baget|bun\\y", "pecivo");
await c.end();
