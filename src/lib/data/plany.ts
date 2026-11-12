import type { Cile, Potravina } from "@/lib/generator/generator";
import { supabase } from "@/lib/supabase";

/**
 * Načtení potravin s AKTUÁLNÍMI cenami z view `aktualni_ceny`
 * (sleva, pokud platí, jinak běžná cena) – přesně ten samý kontrakt
 * jako `nacti_potraviny_se_slevami()` v PHP verzi.
 */

interface RadkaAktualniCeny {
  food_id: string;
  nazev: string;
  kategorie: string;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  kalorie: number;
  bezna_cena: number;
  aktualni_cena: number;
  obchod: string | null;
  sleva: boolean;
  zdroj_ceny: string | null;
  pozorovano_at: string | null;
}

export async function nactiPotravinySeSlevami(): Promise<Potravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("aktualni_ceny")
    .select("*")
    .order("nazev");

  if (error) throw new Error(`Nepodařilo se načíst katalog: ${error.message}`);

  return (data as RadkaAktualniCeny[]).map((r) => ({
    id: r.food_id,
    nazev: r.nazev,
    kategorie: r.kategorie,
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    kalorie: Number(r.kalorie),
    beznaCena: Number(r.bezna_cena),
    aktualniCena: Number(r.aktualni_cena ?? r.bezna_cena),
    obchod: r.sleva ? r.obchod : null,
    sleva: Boolean(r.sleva),
  }));
}

/** Uložení vygenerovaného plánu do meal_plans. */
export async function ulozPlan(plan: {
  typ: "den" | "tyden" | "mealprep";
  cile: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number };
  vysledek: unknown;
}): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  const { data, error } = await klient
    .from("meal_plans")
    .insert({
      user_id: uzivatel.user.id,
      typ: plan.typ,
      cil_kalorie: Math.round(plan.cile.kalorie),
      cil_bilkoviny: Math.round(plan.cile.bilkoviny),
      cil_sacharidy: Math.round(plan.cile.sacharidy),
      cil_tuky: Math.round(plan.cile.tuky),
      data: { cile: plan.cile, vysledek: plan.vysledek },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Plán se neuložil: ${error.message}`);
  return data.id as string;
}

/** Načtení uložených plánů přihlášeného uživatele. */
export async function nactiMePlany() {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("meal_plans")
    .select("id, typ, cil_kalorie, cil_bilkoviny, cil_sacharidy, cil_tuky, vytvoreno")
    .order("vytvoreno", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Plány se nenačetly: ${error.message}`);
  return data ?? [];
}

/** Detail jednoho plánu včetně JSONB obsahu. */
export async function nactiPlan(id: string) {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("meal_plans")
    .select("id, typ, cil_kalorie, cil_bilkoviny, cil_sacharidy, cil_tuky, data, vytvoreno")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Plán se nenačetl: ${error.message}`);
  return data as {
    id: string;
    typ: "den" | "tyden" | "mealprep";
    cil_kalorie: number;
    cil_bilkoviny: number;
    cil_sacharidy: number;
    cil_tuky: number;
    data: { cile: Cile; vysledek: unknown };
    vytvoreno: string;
  };
}

/** Smazání plánu (RLS chrání – smaže se jen vlastní). */
export async function smazPlan(id: string) {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("meal_plans").delete().eq("id", id);
  if (error) throw new Error(`Plán se nesmazal: ${error.message}`);
}
