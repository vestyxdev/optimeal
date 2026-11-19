/**
 * Nahraje brandované šablony e-mailů do Supabase projektu přes
 * Management API (dashboard to umí jen ručním copy-paste).
 *
 * Potřeba: SUPABASE_ACCESS_TOKEN (Personal Access Token –
 * supabase.com/dashboard/account/tokens, scope auth:write).
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/nastav_emaily.mjs
 *
 * Volitelně SUPABASE_REF pro jiný projekt.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(resolve(root, ".env.local"));
} catch {}

const ref = process.env.SUPABASE_REF ?? "gduquvqofcohbjzzsicb";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Chybí SUPABASE_ACCESS_TOKEN – vytvořte Personal Access Token na\n" +
      "https://supabase.com/dashboard/account/tokens (scope auth:write).",
  );
  process.exit(1);
}

const nacti = (soubor) =>
  readFileSync(resolve(root, "supabase/emails", soubor), "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      smtp_sender_name: "OptiMeal",
      mailer_subjects_confirmation: "Potvrďte e-mail · OptiMeal",
      mailer_templates_confirmation_content: nacti("potvrzeni-emailu.html"),
      mailer_subjects_recovery: "Nové heslo · OptiMeal",
      mailer_templates_recovery_content: nacti("obnoveni-hesla.html"),
    }),
  },
);

const telo = await res.text();
if (!res.ok) {
  console.error(`Chyba ${res.status}: ${telo}`);
  process.exit(1);
}
console.log("E-mailové šablony nastaveny (potvrzení + obnovení hesla, odesílatel „OptiMeal“).");
