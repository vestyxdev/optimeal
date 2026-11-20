import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const db = new pg.Pool({host:"aws-0-eu-west-2.pooler.supabase.com",port:6543,user:"postgres.gduquvqofcohbjzzsicb",password:process.env.SUPABASE_DB_PASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});

const {rows:a} = await db.query(`select f.nazev, po.cena, po.puvodni_cena, r.nazev obchod, po.je_sleva, po.platnost_do
  from price_observations po join foods f on f.id=po.food_id left join retailers r on r.id=po.retailer_id
  where po.je_sleva and (po.puvodni_cena is null or po.puvodni_cena <= po.cena*1.01) limit 15`);
console.log("=== obs je_sleva bez platne puvodni ("+a.length+"):"); a.forEach(r=>console.log(" ",r.nazev,"|",r.cena,"vs",r.puvodni_cena,"|",r.obchod,"| do",r.platnost_do));

const {rows:b} = await db.query(`select count(*)::int n from aktualni_ceny where sleva and (puvodni_cena is null or puvodni_cena <= aktualni_cena*1.01 or puvodni_cena > aktualni_cena*4)`);
console.log("=== view sleva violating guards:", b[0].n);

const {rows:c} = await db.query(`select f.nazev, po.cena, po.baleni_g, r.nazev obchod from price_observations po join foods f on f.id=po.food_id left join retailers r on r.id=po.retailer_id where f.nazev='Mléko' and po.cena > 20 limit 5`);
console.log("=== Mleko >20 Kc/100g:"); c.forEach(r=>console.log(" ",r.nazev,"|",r.cena,"Kc/100g | baleni",r.baleni_g,"|",r.obchod));

const {rows:d} = await db.query("select count(*)::int n from price_observations where zdroj like 'seed%'");
console.log("=== seed-* obs remaining:", d[0].n);

const {rows:e} = await db.query(`select count(*)::int n from aktualni_ceny where sleva and platnost_do < current_date`);
console.log("=== view sleva with expired platnost_do:", e[0].n);
await db.end();
