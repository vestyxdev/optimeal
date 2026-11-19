/**
 * Odešle skutečný e-mail pro obnovení hesla přes Supabase Auth –
 * použije aktuálně nastavenou šablonu (po nastav_emaily.mjs tedy
 * brandovanou). E-mail dorazí jen pokud uživatel existuje.
 *
 *   node scripts/posli_test_email.mjs tomasskoutny@gmail.com
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch {}

const email = process.argv[2];
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!email || !url || !key) {
  console.error("Použití: node scripts/posli_test_email.mjs <email>  (potřeba .env s VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/recover`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, redirect_to: "http://localhost:5173/nove-heslo" }),
});
console.log(res.ok ? `Odesláno na ${email} (pokud účet existuje).` : `Chyba ${res.status}: ${await res.text()}`);
