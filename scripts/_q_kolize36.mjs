import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select nazev, kategorie from foods where nazev in ('Qwizz protein bar, slaný karamel','Ultra energy bar strawberry','Kopr a másličko bramborové lupínky','Hovězí s nudlemi do hrnečku','Qwizz rotein bar, slaný karamel','Ultra enery bar strawberry','Kopr A Maslicko Bramborove Lupinky','Hovězí S Nudlemi Do Hrnečku','Monte Snack','Monte snack (Zott)','Sójový granulát')`);
r.rows.forEach(x => console.log(x.kategorie.padEnd(18), x.nazev));
await c.end();
