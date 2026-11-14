/**
 * over_authed.mjs – ověření přihlášených toků na živém projektu.
 *
 * Vytvoří potvrzeného testovacího uživatele (admin API, service key),
 * přihlásí se jako on a projede CRUD cyklus: profil → cíle → plán →
 * recept → nákupní seznam → vlastní potravina. Na konci data uklidí.
 *
 * Použití: SUPABASE_SERVICE_ROLE_KEY=... node scripts/over_authed.mjs
 *          (.env s VITE_* musí existovat)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const KOREN = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let ENV = {};
for (const radek of readFileSync(resolve(KOREN, ".env"), "utf8").split("\n")) {
  const [k, ...v] = radek.split("=");
  if (k && v.length) ENV[k.trim()] = v.join("=").trim();
}
const url = ENV.VITE_SUPABASE_URL;
const anon = ENV.VITE_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("❌ Potřeba .env (VITE_*) a env SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TEST_EMAIL = "tester@optimeal.app";
const TEST_HESLO = "Optimeal-Test-2026!";
const admin = createClient(url, service);
let uid;
let chyby = 0;

async function krok(popis, fn) {
  try {
    const v = await fn();
    console.log(`✔ ${popis}${v ? ` – ${v}` : ""}`);
    return v;
  } catch (e) {
    chyby++;
    console.log(`✘ ${popis}: ${e.message}`);
    return null;
  }
}

// --- 0) testovací uživatel (admin: potvrzený, idempotentně) ---
const existujici = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const nalezen = existujici.data.users.find((u) => u.email === TEST_EMAIL);
if (nalezen) {
  uid = nalezen.id;
  await admin.auth.admin.updateUserById(uid, { password: TEST_HESLO });
  console.log("✔ Testovací uživatel už existoval – heslo přepsáno");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_HESLO,
    email_confirm: true,
  });
  if (error) throw new Error(`Vytvoření uživatele: ${error.message}`);
  uid = data.user.id;
  console.log("✔ Testovací uživatel vytvořen:", TEST_EMAIL);
}

// --- 1) přihlášení jako testovací uživatel ---
const klient = createClient(url, anon);
const { error: chybaPrihlaseni } = await klient.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_HESLO,
});
if (chybaPrihlaseni) {
  console.error("❌ Přihlášení selhalo:", chybaPrihlaseni.message);
  process.exit(1);
}
console.log("✔ Přihlášení jako", TEST_EMAIL);

// --- 2) profil (trigger + update) ---
await krok("Profil vytvořen triggerem", async () => {
  const { data, error } = await klient.from("profiles").select("*").single();
  if (error) throw new Error(error.message);
  return `email ${data.email}`;
});

await krok("Update profilu (dieta + alergie)", async () => {
  const { error } = await klient
    .from("profiles")
    .update({ jmeno: "Tester", dieta: ["bezlepkovy"], alergie: ["arasidy"] })
    .eq("id", uid);
  if (error) throw new Error(error.message);
  const { data } = await klient.from("profiles").select("dieta, alergie").single();
  return `dieta=${data.dieta} alergie=${data.alergie}`;
});

await krok("Cizí profil nevidím (RLS)", async () => {
  const { data } = await klient.from("profiles").select("id");
  if (data.length !== 1) throw new Error(`Vidím ${data.length} profilů!`);
  return "jen vlastní – OK";
});

// --- 3) cíle ---
await krok("Nutrition goals insert+active", async () => {
  const { error } = await klient.from("nutrition_goals").insert({
    user_id: uid, kalorie: 2200, bilkoviny: 150, sacharidy: 220, tuky: 70,
    zdroj: "manual", aktivni: true,
  });
  if (error) throw new Error(error.message);
  const { data } = await klient.from("nutrition_goals").select("*").eq("aktivni", true);
  if (data.length !== 1) throw new Error(`Aktivních: ${data.length}`);
  return "1 aktivní sada";
});

// --- 4) jídelníček ---
let planId;
await krok("Uložení + čtení + smazání plánu", async () => {
  const { data, error } = await klient.from("meal_plans").insert({
    user_id: uid, typ: "den",
    cil_kalorie: 2200, cil_bilkoviny: 150, cil_sacharidy: 220, cil_tuky: 70,
    data: { cile: { kalorie: 2200 }, vysledek: { test: true } },
  }).select("id").single();
  if (error) throw new Error(error.message);
  planId = data.id;
  const { error: errDel } = await klient.from("meal_plans").delete().eq("id", planId);
  if (errDel) throw new Error(`delete: ${errDel.message}`);
  return `plán ${planId.slice(0, 8)}… vytvořen i smazán`;
});

// --- 5) recept ---
await krok("Vlastní recept CRUD", async () => {
  const { data: jidlo } = await klient.from("foods").select("id").limit(1).single();
  const { data: r, error } = await klient.from("recipes").insert({
    user_id: uid, nazev: "Testovací recept", kategorie: "hlavni",
    porce: 2, postup: "Krok 1.", zdroj: "uzivatel",
  }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await klient.from("recipe_ingredients").insert({
    recipe_id: r.id, food_id: jidlo.id, gramy_na_porce: 100,
  });
  if (e2) throw new Error(`surovina: ${e2.message}`);
  const { data: rr } = await klient
    .from("recipes")
    .select("id, suroviny:recipe_ingredients(gramy_na_porce, potravina:foods(nazev))")
    .eq("id", r.id).single();
  if (!rr.suroviny.length || !rr.suroviny[0].potravina)
    throw new Error("join surovin vrátil NULL");
  await klient.from("recipes").delete().eq("id", r.id);
  return `surovina „${rr.suroviny[0].potravina.nazev}" načtena, recept smazán`;
});

// --- 6) nákupní seznam ---
await krok("Nákupní seznam CRUD", async () => {
  const { data: s, error } = await klient.from("shopping_lists").insert({
    user_id: uid, nazev: "Test seznam",
  }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await klient.from("shopping_list_items").insert({
    list_id: s.id, nazev: "Test položka", gramy: 100, koupeno: true,
  });
  if (e2) throw new Error(`položka: ${e2.message}`);
  await klient.from("shopping_lists").delete().eq("id", s.id);
  return "seznam + položka OK";
});

// --- 7) vlastní potravina (RLS zdroj=uzivatel) ---
await krok("Vlastní potravina insert+delete", async () => {
  const { data, error } = await klient.from("foods").insert({
    nazev: `Testovací potravina ${Date.now()}`, kategorie: "ostatni",
    bilkoviny: 1, sacharidy: 1, tuky: 1, kalorie: 10,
    bezna_cena: 1, zdroj: "uzivatel", vytvoril: uid, schvaleno: true,
  }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await klient.from("foods").delete().eq("id", data.id);
  if (e2) throw new Error(`delete: ${e2.message}`);
  return "vytvořena i smazána";
});

await klient.auth.signOut();
console.log(
  chyby === 0
    ? `\n✅ ${TEST_EMAIL} – všechny autentizované kontroly prošly.`
    : `\n⚠ ${chyby} kontrol selhalo.`,
);
process.exitCode = chyby === 0 ? 0 : 1;
