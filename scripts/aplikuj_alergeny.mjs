/**
 * aplikuj_alergeny.mjs – jednorázově doplní foods.alergeny/diety pro seed
 * potraviny přes PostgREST (service role). Stejná data jako konec seed.sql.
 * Použití: node scripts/aplikuj_alergeny.mjs <soubor-s-service-role-klicem>
 */
import { readFileSync } from "node:fs";

const keyFile = process.argv[2];
try {
  for (const l of readFileSync(".env", "utf8").split("\n")) {
    const i = l.indexOf("=");
    if (i > 0 && !process.env[l.slice(0, i).trim()]) {
      process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  }
} catch { /* .env nemusi existovat */ }
const BASE = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
if (!keyFile || !BASE) {
  console.error("Použití: node scripts/aplikuj_alergeny.mjs <key-file>  (VITE_SUPABASE_URL v env/.env)");
  process.exit(1);
}
const key = readFileSync(keyFile, "utf8").trim();

const data = [
  { where: ["Arašidy"], alergeny: ["arasidy"], diety: ["vegetariansky", "vegansky", "bezlepkovy"] },
  { where: ["Banán", "Brambory", "Jablko"], alergeny: [], diety: ["vegetariansky", "vegansky", "bezlepkovy"] },
  { where: ["Chléb celozrnný"], alergeny: ["lepek"], diety: ["vegetariansky"] },
  { where: ["Hovězí svíčková", "Kuřecí prsa"], alergeny: [], diety: [] },
  { where: ["Jogurt bílý 3,5%", "Mléko čerstvé", "Parmigiano Reggiano", "Sýr Eidam", "Sýr Niva", "Tvaroh polotučný"], alergeny: ["mleko"], diety: ["vegetariansky", "bezlepkovy"] },
  { where: ["Krabí tyčky"], alergeny: ["ryby", "lepek", "vejce"], diety: [] },
  { where: ["Losos"], alergeny: ["ryby"], diety: [] },
  { where: ["Ovesné vločky"], alergeny: ["lepek"], diety: ["vegetariansky", "vegansky"] },
  { where: ["Pohanka", "Quinoa", "Rýže basmati", "Čočka červená"], alergeny: [], diety: ["vegetariansky", "vegansky", "bezlepkovy"] },
  { where: ["Těstoviny celozrnné"], alergeny: ["lepek"], diety: ["vegetariansky"] },
  { where: ["Vejce"], alergeny: ["vejce"], diety: ["vegetariansky"] },
];

let fail = 0;
for (const g of data) {
  const names = g.where.map((n) => `"${n}"`).join(",");
  const res = await fetch(`${BASE}/rest/v1/foods?nazev=in.(${encodeURIComponent(names)})`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ alergeny: g.alergeny, diety: g.diety }),
  });
  const body = await res.json().catch(() => []);
  const n = Array.isArray(body) ? body.length : 0;
  if (!res.ok || n !== g.where.length) {
    fail++;
    console.error(`✘ ${g.where.join(", ")}: HTTP ${res.status}, ${n}/${g.where.length} řádků`);
  } else {
    console.log(`✔ ${g.where.join(", ")} (${n})`);
  }
}
console.log(fail === 0 ? "\n✅ Všechna metadata aplikována." : `\n❌ ${fail} skupin selhalo.`);
process.exitCode = fail === 0 ? 0 : 1;
