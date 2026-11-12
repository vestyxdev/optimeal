import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Konfigurace prostředí – klíče přichází přes .env (VITE_ prefix).
 * Bez klíčů běží aplikace v DEMO REŽIMU: navigace a lokální logika
 * fungují, data/auth se zdvořile vysvětlí na stránce Nastavení.
 *
 * VITE_SUPABASE_URL        – URL projektu (Settings → API)
 * VITE_SUPABASE_ANON_KEY   – veřejný anon klíč (NE service_role!)
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseNastaveno: boolean = Boolean(url && anonKey);

/** Klient Supabase, nebo null v demo režimu. */
export const supabase: SupabaseClient | null = supabaseNastaveno
  ? createClient(url as string, anonKey as string, {
      auth: {
        // session se udrží i po zavření prohlížeče
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
