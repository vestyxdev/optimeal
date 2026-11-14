/**
 * over_demo.mjs – end-to-end sanity check hlavního uživatelského
 * scénáře na PRODUKCI (pro živou prezentaci):
 *
 *   přihlášení → načtení katalogu → generace plánu → uložení plánu
 *   → vytvoření nákupního seznamu (RPC) → ověření → úklid test dat
 *
 * Vše jde přes skutečné API (GoTrue + PostgREST s JWT uživatele),
 * takže ověřuje i RLS politiky. Testovací plán a seznam na konci
 * smaže – demo data zůstávají čistá.
 *
 * Použití: node scripts/over_demo.mjs [email] [heslo]
 *   výchozí: petra@demo.optimeal.cz / OptiMeal2025!
 */

import { readFileSync } from "node:fs";
import {
  sestavNakupniSeznam,
  vygenerujJidelnicek,
} from "../src/lib/generator/generator.ts";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.argv[2] ?? "petra@demo.optimeal.cz";
const HESLO = process.argv[3] ?? "OptiMeal2025!";

let ok = 0;
let fail = 0;
function krok(nazev, podminka, detail = "") {
  if (podminka) { ok++; console.log(`  ✔ ${nazev}`); }
  else { fail++; console.log(`  ✘ ${nazev} ${detail}`); }
}

console.log(`Sanity check: ${EMAIL} @ ${URL}`);

/* 1. přihlášení */
const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY },
  body: JSON.stringify({ email: EMAIL, password: HESLO }),
});
const session = await login.json();
krok("přihlášení (GoTrue)", Boolean(session.access_token), session.error_description ?? "");
if (!session.access_token) { console.log(`\n${fail} kroků selhalo`); process.exit(1); }

const H = {
  apikey: KEY,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
};

/* 2. katalog s aktuálními cenami */
const kat = await (await fetch(`${URL}/rest/v1/aktualni_ceny?select=*`, { headers: H })).json();
krok(
  `katalog (aktualni_ceny): ${Array.isArray(kat) ? kat.length : 0} potravin`,
  Array.isArray(kat) && kat.length >= 50,
  JSON.stringify(kat).slice(0, 200),
);
if (!Array.isArray(kat)) { console.log(`\n${fail} kroků selhalo`); process.exit(1); }

/* 3. profil + cíle */
const [profil, cile] = await Promise.all([
  fetch(`${URL}/rest/v1/profiles?select=*`, { headers: H }).then((r) => r.json()),
  fetch(`${URL}/rest/v1/nutrition_goals?aktivni=eq.true&select=*`, { headers: H }).then((r) => r.json()),
]);
krok("profil načten", Array.isArray(profil) && profil.length === 1 && Boolean(profil[0].jmeno));
krok("aktivní cíle načteny", Array.isArray(cile) && cile.length === 1);

/* 4. generace plánu skutečným algoritmem */
const katalog = kat.map((r) => ({
  id: r.food_id, nazev: r.nazev, kategorie: r.kategorie,
  bilkoviny: Number(r.bilkoviny), sacharidy: Number(r.sacharidy),
  tuky: Number(r.tuky), kalorie: Number(r.kalorie),
  beznaCena: Number(r.bezna_cena),
  aktualniCena: Number(r.aktualni_cena ?? r.bezna_cena),
  obchod: r.sleva ? r.obchod : null, sleva: Boolean(r.sleva),
  alergeny: r.alergeny ?? [], diety: r.diety ?? [], obrazek: r.obrazek ?? null,
}));
const c = cile[0];
const cilObj = { kalorie: c.kalorie, bilkoviny: c.bilkoviny, sacharidy: c.sacharidy, tuky: c.tuky };
const pocetJidel = profil[0].pocet_jidel_denne ?? 4;
const plan = vygenerujJidelnicek(katalog, cilObj, null, 0.85, pocetJidel, {
  diety: profil[0].dieta ?? [], alergeny: profil[0].alergie ?? [],
});
const pocetJidelVCele = Object.values(plan.jidelnicek).flatMap((s) => s.jidla).length;
krok(`plán vygenerován (${pocetJidelVCele} jídel, ${Math.round(plan.celkem.kalorie)} kcal)`, pocetJidelVCele > 0 && plan.celkem.kalorie > 0);

/* 5. uložení plánu (RLS – vlastní záznam) */
const planRes = await fetch(`${URL}/rest/v1/meal_plans`, {
  method: "POST",
  headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify({
    user_id: session.user.id, typ: "den",
    cil_kalorie: cilObj.kalorie, cil_bilkoviny: cilObj.bilkoviny,
    cil_sacharidy: cilObj.sacharidy, cil_tuky: cilObj.tuky,
    data: { cile: cilObj, vysledek: plan, _sanity_check: true },
  }),
});
const planBody = await planRes.text();
let planRow = null;
try { planRow = JSON.parse(planBody)?.[0]; } catch { /* chyba – v planBody */ }
krok("plán uložen (meal_plans)", planRes.status === 201 && Boolean(planRow?.id), planBody.slice(0, 200));

/* 6. nákupní seznam přes RPC (stejná cesta jako aplikace) */
const nakup = sestavNakupniSeznam(plan.jidelnicek);
const rpc = await fetch(`${URL}/rest/v1/rpc/uloz_nakupni_seznam`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    p_nazev: "SANITY CHECK seznam",
    p_plan_id: planRow?.id ?? null,
    p_polozky: nakup.map((p) => ({
      food_id: p.id, nazev: p.nazev, gramy: p.gramy,
      cena_za_100g: p.cenaZa100g, obchod: p.obchod,
      je_sleva: p.sleva, kategorie: "ostatni",
    })),
  }),
});
const listId = rpc.ok ? (await rpc.text()).replaceAll('"', "") : null;
krok("nákupní seznam vytvořen (RPC uloz_nakupni_seznam)", rpc.ok && Boolean(listId), `${rpc.status}`);

/* 7. zpětné ověření – RLS čtení vlastních dat */
if (listId) {
  const polozky = await (
    await fetch(`${URL}/rest/v1/shopping_list_items?list_id=eq.${listId}&select=id`, { headers: H })
  ).json();
  krok(`seznam čitelný (${polozky.length} položek)`, Array.isArray(polozky) && polozky.length === nakup.length);
}
if (planRow?.id) {
  const zp = await (
    await fetch(`${URL}/rest/v1/meal_plans?id=eq.${planRow.id}&select=typ,cil_kalorie`, { headers: H })
  ).json();
  krok("plán zpětně čitelný", Array.isArray(zp) && zp.length === 1 && zp[0].cil_kalorie === cilObj.kalorie);
}

/* 8. úklid testovacích záznamů */
if (listId)
  await fetch(`${URL}/rest/v1/shopping_lists?id=eq.${listId}`, { method: "DELETE", headers: H });
if (planRow?.id)
  await fetch(`${URL}/rest/v1/meal_plans?id=eq.${planRow.id}`, { method: "DELETE", headers: H });
const zbyva = await (
  await fetch(`${URL}/rest/v1/shopping_lists?nazev=eq.SANITY CHECK seznam&select=id`, { headers: H })
).json();
krok("úklid (žádné testovací zbytky)", Array.isArray(zbyva) && zbyva.length === 0);

console.log(`\n${ok} kroků OK, ${fail} selhalo ${fail === 0 ? "– demo cesta je průchodná ✅" : "❌"}`);
process.exit(fail === 0 ? 0 : 1);
