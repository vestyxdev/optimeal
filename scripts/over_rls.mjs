/**
 * over_rls.mjs – ověření RLS a datového kontraktu na běžícím projektu.
 *
 * Použití: node scripts/over_rls.mjs
 * Potřebuje .env s VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 * (anon klíč = přesně to, co běží ve frontendu).
 *
 * Ověří: schéma/sloupce, RLS na hlavních tabulkách, view aktualni_ceny,
 * anonymní přístup (čtení katalogu ano, zápis ne).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const KOREN = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// načti .env ručně (žádný dotenv balíček)
let ENV = {};
try {
  for (const radek of readFileSync(resolve(KOREN, ".env"), "utf8").split("\n")) {
    const [k, ...v] = radek.split("=");
    if (k && v.length) ENV[k.trim()] = v.join("=").trim();
  }
} catch {
  console.error("❌ .env nenalezen – zkopíruj .env.vzor a doplň klíče.");
  process.exit(1);
}

const url = ENV.VITE_SUPABASE_URL;
const key = ENV.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY chybí v .env");
  process.exit(1);
}

const klient = createClient(url, key);
let chyby = 0;

async function krok(popis, fn) {
  try {
    const vysledek = await fn();
    console.log(`✔ ${popis}${vysledek ? ` – ${vysledek}` : ""}`);
  } catch (e) {
    chyby++;
    console.log(`✘ ${popis}: ${e.message}`);
  }
}

await krok("Katalog potravin čitelný anonymně (RLS select)", async () => {
  const { data, error } = await klient.from("foods").select("nazev").limit(5);
  if (error) throw new Error(error.message);
  return `${data.length} záznamů`;
});

await krok("View aktualni_ceny vrací alergeny/diety (migrace 0005/6)", async () => {
  const { data, error } = await klient
    .from("aktualni_ceny")
    .select("nazev, alergeny, diety, sleva")
    .limit(3);
  if (error) throw new Error(error.message);
  return `${data.length} řádek`;
});

await krok("Anonymní zápis do foods odmítnut (RLS insert)", async () => {
  const { error } = await klient
    .from("foods")
    .insert({ nazev: "test-rls-x", kategorie: "ostatni", bilkoviny: 0, sacharidy: 0, tuky: 0, kalorie: 0, bezna_cena: 0 });
  if (!error) throw new Error("Zápis PROŠEL – RLS chybí!");
  return `blokováno (${error.code ?? error.message.slice(0, 40)})`;
});

await krok("Anonymní čtení meal_plans vrací prázdné (RLS)", async () => {
  const { data, error } = await klient.from("meal_plans").select("id").limit(5);
  if (error) throw new Error(error.message);
  if (data.length > 0) throw new Error("Anonym vidí cizí plány!");
  return "0 řádků pro anonyma – OK";
});

await krok("Recepty čitelné (globální zdroj='global')", async () => {
  const { data, error } = await klient.from("recipes").select("id, zdroj").limit(5);
  if (error) throw new Error(error.message);
  return `${data.length} receptů`;
});

await krok("Funkce delete_own_account existuje (anon = odepřen)", async () => {
  const { error } = await klient.rpc("delete_own_account");
  // anon nemá execute → musí selhat
  if (!error) throw new Error("Anonymní RPC proběhlo – grant chybí!");
  return `blokováno (${error.code ?? "grant"})`;
});

await krok("RPC top_akce vrací úzkou projekci slev i pro anonyma (0016)", async () => {
  const { data, error } = await klient.rpc("top_akce", { p_limit: 5 });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Neočekávaný návratový typ");
  if (data.length > 24) throw new Error("Limit cap selhal!");
  const r = data[0];
  if (r && (!("nazev" in r) || !("cena" in r))) {
    throw new Error("Řádek nemá očekávané sloupce (nazev/cena)");
  }
  if (r && ("food_id" in r || "ean" in r || "kategorie" in r)) {
    throw new Error("Projekce uniká interní sloupce – top_akce má vracet jen letáková data!");
  }
  return `${data.length} řádků`;
});

console.log(chyby === 0 ? "\n✅ Všechny kontroly prošly." : `\n⚠ ${chyby} kontrol selhalo.`);
process.exitCode = chyby === 0 ? 0 : 1;
