import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseNastaveno } from "./supabase";
import { ulozCile, ulozProfil } from "./data/profil";
import { migrujSpizAStaliceHosta } from "./data/spiz";

/**
 * Autentizace – Supabase Auth (e-mail + heslo).
 * V demo režimu (bez klíčů) vrací session = null a feature flag.
 */

export interface Uzivatel {
  id: string;
  email: string;
}

interface AuthStav {
  /** null = nepřihlášen */
  uzivatel: Uzivatel | null;
  nacitaSe: boolean;
  /** false = aplikace běží bez Supabase klíčů (demo) */
  authDostupne: boolean;
  prihlasit: (email: string, heslo: string) => Promise<{ chyba?: string }>;
  registrovat: (email: string, heslo: string) => Promise<{ chyba?: string; cekaNaEmail?: boolean }>;
  /** Pošle odkaz na nastavení nového hesla (obnovený přístup). */
  obnovitHeslo: (email: string) => Promise<{ chyba?: string }>;
  /** Nastaví nové heslo v recovery session (po kliknutí na odkaz z e-mailu). */
  ulozitNoveHeslo: (heslo: string) => Promise<{ chyba?: string }>;
  odhlasit: () => Promise<void>;
}

const AuthKontext = createContext<AuthStav>({
  uzivatel: null,
  nacitaSe: false,
  authDostupne: false,
  prihlasit: async () => ({ chyba: "Auth není nakonfigurováno" }),
  registrovat: async () => ({ chyba: "Auth není nakonfigurováno" }),
  obnovitHeslo: async () => ({ chyba: "Auth není nakonfigurováno" }),
  ulozitNoveHeslo: async () => ({ chyba: "Auth není nakonfigurováno" }),
  odhlasit: async () => undefined,
});

export function AuthPoskytovatel({ children }: { children: ReactNode }) {
  const [uzivatel, setUzivatel] = useState<Uzivatel | null>(null);
  const [nacitaSe, setNacitaSe] = useState(supabaseNastaveno);
  const klient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;

    // počáteční session + reakce na změny (login, logout, obnova tokenu)
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUzivatel(
          session?.user
            ? { id: session.user.id, email: session.user.email ?? "" }
            : null,
        );
        setNacitaSe(false);
      })
      .catch(() => setNacitaSe(false));

    const { data: odber } = supabase.auth.onAuthStateChange(
      (_udalost, session) => {
        const novy: Uzivatel | null = session?.user
          ? { id: session.user.id, email: session.user.email ?? "" }
          : null;
        setUzivatel((pred) => {
          // odhlášení nebo přepnutí účtu → zahodit cache dat předchozího
          // uživatele, jinak by se cizí plány/seznamy mohly bleskově ukázat
          if (pred !== null && pred.id !== (novy?.id ?? null)) {
            klient.clear();
          }
          // první přihlášení po hostu → přenést cíle, spíž i stálice;
          // po migraci zneplatnit query cache (už je načtená hostovská verze)
          if (pred === null && novy !== null) {
            void (async () => {
              try {
                const spizMigrovana = await migrujSpizAStaliceHosta();
                if (spizMigrovana) {
                  void klient.invalidateQueries({ queryKey: ["spiz"] });
                  void klient.invalidateQueries({ queryKey: ["stalice"] });
                }
              } catch {
                /* migrace spíže nesmí zablokovat přihlášení */
              }
              migrujCileHosta().catch(() => {});
            })();
          }
          return novy;
        });
      },
    );

    return () => odber.subscription.unsubscribe();
  }, [klient]);

  const hodnoty: AuthStav = {
    uzivatel,
    nacitaSe,
    authDostupne: supabaseNastaveno,
    prihlasit: async (email, heslo) => {
      if (!supabase) return { chyba: "Aplikace není připojena k Supabase." };
      const { error } = await supabase.auth.signInWithPassword({ email, password: heslo });
      if (error) return { chyba: prelozAuthChybu(error.message) };
      return {};
    },
    registrovat: async (email, heslo) => {
      if (!supabase) return { chyba: "Aplikace není připojena k Supabase." };
      const { data, error } = await supabase.auth.signUp({ email, password: heslo });
      if (error) return { chyba: prelozAuthChybu(error.message) };
      // bez session čeká registrace na potvrzovací e-mail
      return { cekaNaEmail: data.session === null };
    },
    obnovitHeslo: async (email) => {
      if (!supabase) return { chyba: "Aplikace není připojena k Supabase." };
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nove-heslo`,
      });
      if (error) return { chyba: prelozAuthChybu(error.message) };
      return {};
    },
    ulozitNoveHeslo: async (heslo) => {
      if (!supabase) return { chyba: "Aplikace není připojena k Supabase." };
      const { error } = await supabase.auth.updateUser({ password: heslo });
      if (error) return { chyba: prelozAuthChybu(error.message) };
      return {};
    },
    odhlasit: async () => {
      if (supabase) await supabase.auth.signOut();
    },
  };

  return <AuthKontext.Provider value={hodnoty}>{children}</AuthKontext.Provider>;
}

export function useAuth() {
  return useContext(AuthKontext);
}

/**
 * Host cíle z průvodce (/cile bez přihlášení) se uloží do
 * localStorage; při prvním přihlášení je zapíšeme na účet
 * a lokální kopii smažeme.
 */
async function migrujCileHosta(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("om-cile-host");
    if (!raw) return;
    localStorage.removeItem("om-cile-host");
  } catch {
    return; // localStorage nedostupný – nic k migraci
  }
  const host = JSON.parse(raw) as {
    vstupy?: Parameters<typeof ulozProfil>[0];
    cile?: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number };
  };
  if (host.vstupy) {
    // DB check telo_tuk_procento (3–60) – starší localStorage mohl
    // obsahovat hodnotu mimo rozsah, migrace by pak tiše selhala
    const tuk = host.vstupy.teloTukProcento;
    const vstupy = {
      ...host.vstupy,
      teloTukProcento:
        tuk != null && Number.isFinite(tuk) && tuk >= 3 && tuk <= 60 ? tuk : null,
    };
    await ulozProfil(vstupy).catch(() => {});
  }
  if (host.cile) await ulozCile(host.cile, "auto").catch(() => {});
}

/** Většina chyb Supabase jde člověku vysvětlit česky. */
function prelozAuthChybu(zprava: string): string {
  if (zprava.includes("Invalid login credentials"))
    return "Nesprávný e-mail nebo heslo.";
  if (zprava.includes("User already registered"))
    return "Tento e-mail je už registrovaný. Zkuste se přihlásit.";
  if (zprava.includes("Password should be at least"))
    return "Heslo musí mít alespoň 6 znaků.";
  if (zprava.includes("Email not confirmed"))
    return "Nejdřív potvrďte e-mail přes odkaz, který jsme vám poslali.";
  if (zprava.includes("rate limit"))
    return "Zkuste to prosím za chvíli (moc pokusů).";
  return "Přihlášení/registrace se nepodařila: " + zprava;
}
