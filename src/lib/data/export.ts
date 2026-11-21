import { supabase } from "@/lib/supabase";

/**
 * GDPR export – všechna uživatelova data jako JSON ke stažení.
 * RLS scopuje selecty na vlastní řádky; recepty a vlastní potraviny
 * filtrujeme explicitně, ať se do exportu nemíchá sdílený obsah.
 */
export async function exportujMujData(): Promise<Record<string, unknown>> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: auth } = await klient.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Není přihlášen.");

  const dotazy = await Promise.all([
    klient.from("profiles").select("*").maybeSingle(),
    klient.from("nutrition_goals").select("*"),
    klient.from("meal_plans").select("*"),
    klient.from("diary_entries").select("*"),
    klient.from("shopping_lists").select("*"),
    klient.from("shopping_list_items").select("*"),
    klient.from("recipes").select("*").eq("user_id", uid),
    klient.from("foods").select("*").eq("vytvoril", uid),
    klient.from("weight_logs").select("*"),
  ]);
  const [profil, cile, plany, denik, seznamy, polozky, recepty, potraviny, vahy] =
    dotazy;
  for (const r of dotazy) {
    if (r.error) throw new Error(`Export selhal: ${r.error.message}`);
  }

  // suroviny vlastních receptů
  const receptIds = (recepty.data ?? []).map((r) => r.id as string);
  let suroviny: Record<string, unknown>[] = [];
  if (receptIds.length > 0) {
    const { data, error } = await klient
      .from("recipe_ingredients")
      .select("*")
      .in("recipe_id", receptIds);
    if (error) throw new Error(`Export selhal: ${error.message}`);
    suroviny = (data ?? []) as Record<string, unknown>[];
  }

  return {
    exportovano: new Date().toISOString(),
    ucet: { id: uid, email: auth.user?.email ?? null },
    profil: profil.data,
    vyzivove_cile: cile.data,
    jidelni_plany: plany.data,
    jidelni_denik: denik.data,
    nakupni_seznamy: seznamy.data,
    polozky_seznamu: polozky.data,
    vlastni_recepty: recepty.data,
    suroviny_receptu: suroviny,
    vlastni_potraviny: potraviny.data,
    zaznamy_vahy: vahy.data,
  };
}

/** Stáhne objekt jako JSON soubor optimeal-export-RRRR-MM-DD.json. */
export function stahniJson(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `optimeal-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
