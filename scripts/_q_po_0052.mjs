import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const db = new pg.Pool({host:"aws-0-eu-west-2.pooler.supabase.com",port:6543,user:"postgres.gduquvqofcohbjzzsicb",password:process.env.SUPABASE_DB_PASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});

const {rows:g} = await db.query(`select f.nazev, ac.aktualni_cena::float cena, ac.puvodni_cena::float puv, ac.sleva, ac.sleva_procenta, ac.obchod, ac.baleni_g::float
  from aktualni_ceny ac join foods f on f.id=ac.food_id where lower(f.nazev) like '%granko%'`);
console.log("=== VIEW Granko po 0052:"); g.forEach(r=>console.log(`  ${r.nazev}: ${r.cena} Kč/100g | puv ${r.puv} | sleva ${r.sleva} (${r.sleva_procenta}%) | ${r.obchod} | ${r.baleni_g}g`));

const {rows:s} = await db.query("select count(*)::int n from aktualni_ceny where sleva");
console.log("=== view sleva celkem:", s[0].n);

const {rows:p} = await db.query("select count(*)::int n from price_observations where puvodni_cena is not null");
console.log("=== obs s puvodni:", p[0].n);

// max discount teď v view
const {rows:m} = await db.query(`select nazev, sleva_procenta, obchod, aktualni_cena::float c, puvodni_cena::float p from aktualni_ceny where sleva order by sleva_procenta desc limit 8`);
console.log("=== největší slevy v view:");
m.forEach(r=>console.log(`  ${r.sleva_procenta}% ${r.nazev} | ${r.c} ← ${r.p} | ${r.obchod}`));

// trigger na UPDATE: simulace obohaceni PATCH na Mléko (puvodni 999 → měl by znullit)
const {rows:ml} = await db.query("select id from foods where nazev='Mléko' limit 1");
if (ml[0]) {
  const {rows:u} = await db.query(`update price_observations set puvodni_cena=999, puvodni_zdroj='kupi'
    where food_id=$1 and not podezrele returning id, puvodni_cena, puvodni_zdroj`, [ml[0].id]);
  console.log("=== UPDATE trigger: nastavil 999 →", u.length ? `puvodni=${u[0].puvodni_cena} zdroj=${u[0].puvodni_zdroj}` : "žádná řádka");
}
await db.end();
