import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const db = new pg.Pool({host:"aws-0-eu-west-2.pooler.supabase.com",port:6543,user:"postgres.gduquvqofcohbjzzsicb",password:process.env.SUPABASE_DB_PASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});

const {rows:foods} = await db.query(`select id, nazev, baleni_g, bezna_cena from foods where lower(nazev) like '%granko%' limit 10`);
console.log("=== foods Granko:"); foods.forEach(f=>console.log(" ",f.id,f.nazev,"| baleni",f.baleni_g,"| bezna",f.bezna_cena));

for (const f of foods) {
  const {rows:obs} = await db.query(`select po.cena::float, po.puvodni_cena::float, po.baleni_g, po.je_sleva, po.podezrele, po.zdroj, r.nazev obchod, po.platnost_do, po.pozorovano_at
    from price_observations po left join retailers r on r.id=po.retailer_id
    where po.food_id=$1 order by po.pozorovano_at desc limit 10`, [f.id]);
  console.log(`--- obs pro ${f.nazev}:`);
  obs.forEach(o=>console.log(`   ${o.cena} Kč/100g | puvodni ${o.puvodni_cena} | baleni ${o.baleni_g}g | sleva ${o.je_sleva} | pod ${o.podezrele} | ${o.obchod} | ${o.zdroj} | ${String(o.pozorovano_at).slice(0,10)}`));
  const {rows:v} = await db.query(`select aktualni_cena::float cena, puvodni_cena::float puv, sleva, sleva_procenta, obchod, baleni_g, zdroj_ceny from aktualni_ceny where food_id=$1`,[f.id]);
  console.log("   VIEW:", JSON.stringify(v[0]));
}
await db.end();
