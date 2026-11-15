import pg from "pg";
import fs from "node:fs";
const { Client } = pg;
const heslo = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(.+)/)[1].trim();
const c = new Client({ host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543, user: "postgres.gduquvqofcohbjzzsicb", password: heslo, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
// tukove potraviny, ktere jsou ve skutecnosti condimenty (majoneza, tatarka, dresink, ketcup, horcice, omacky samostatne)
const t = await c.query(`select nazev, tuky from foods where tuky >= 15 and nazev ~* 'majon|tatark|dresink|ke[cč]up|hor[cč]ic|sauce|dress' order by tuky desc limit 40`);
t.rows.forEach(x => console.log("COND:", x.nazev, "|", x.tuky, "g/100g"));
// co realne vyhrava tukove sloty? tukove potraviny s cenou
const f = await c.query(`select nazev, tuky, aktualni_cena from aktualni_ceny where tuky >= 25 and aktualni_cena > 0 order by tuky desc limit 35`);
f.rows.forEach(x => console.log("FAT:", x.nazev, "|", x.tuky, "g", x.aktualni_cena, "Kč"));
await c.end();
