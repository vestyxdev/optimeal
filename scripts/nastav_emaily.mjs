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

// Šablony jdou měnit jen s vlastním SMTP (free tier) – SMTP_* env
// se předají jen tehdy, když jsou nastavené (SMTP_HOST je trigger).
const smtp = process.env.SMTP_HOST
  ? {
      smtp_host: process.env.SMTP_HOST,
      smtp_port: process.env.SMTP_PORT ?? "465",
      smtp_user: process.env.SMTP_USER,
      smtp_pass: process.env.SMTP_PASS,
      smtp_admin_email: process.env.SMTP_ADMIN_EMAIL ?? process.env.SMTP_USER,
      smtp_sender_name: process.env.SMTP_SENDER_NAME ?? "OptiMeal",
    }
  : {};
if (!process.env.SMTP_HOST) {
  console.warn(
    "Pozn: bez SMTP_* env se nastaví jen šablony – na free tier to Supabase\n" +
      "      odmítne, dokud není vlastní SMTP (Gmail app heslo / Brevo).",
  );
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...smtp,
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
