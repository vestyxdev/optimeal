import { supabase } from "@/lib/supabase";

/**
 * Nákupní seznamy – ukládání a správa (shopping_lists + items).
 * RLS chrání vlastní seznamy; položky dědí vlastnictví přes seznam.
 */

export interface NakupniSeznam {
  id: string;
  nazev: string;
  hotovo: boolean;
  vytvoreno: string;
}

export interface PolozkaNakupu {
  id: string;
  nazev: string;
  gramy: number;
  cenaZa100g: number | null;
  obchod: string | null;
  jeSleva: boolean;
  koupeno: boolean;
  vlastni: boolean;
  kategorie: string;
}

/** Načte seznamy přihlášeného uživatele (novější první). */
export async function nactiMeNakupniSeznamy(): Promise<NakupniSeznam[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("shopping_lists")
    .select("id, nazev, hotovo, vytvoreno")
    .order("vytvoreno", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Nákupní seznamy se nenačetly: ${error.message}`);
  return data ?? [];
}

/** Vytvoří seznam z položek (gramy, cena, obchod, sleva); volitelně vázaný na plán. */
export async function ulozNakupniSeznam(
  nazev: string,
  polozky: { foodId?: string | null; nazev: string; gramy: number; cenaZa100g: number | null; obchod: string | null; jeSleva: boolean; kategorie?: string }[],
  planId?: string | null,
): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  const { data: seznam, error } = await klient
    .from("shopping_lists")
    .insert({ user_id: uzivatel.user.id, nazev, plan_id: planId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`Seznam se neuložil: ${error.message}`);
  const idSeznamu = seznam.id as string;

  if (polozky.length > 0) {
    const { error: err } = await klient.from("shopping_list_items").insert(
      polozky.map((p) => ({
        list_id: idSeznamu,
        food_id: p.foodId ?? null,
        nazev: p.nazev,
        gramy: Math.round(p.gramy),
        cena_za_100g: p.cenaZa100g,
        obchod: p.obchod,
        je_sleva: p.jeSleva,
        kategorie: p.kategorie ?? "ostatni",
      })),
    );
    if (err) throw new Error(`Položky se neuložily: ${err.message}`);
  }

  return idSeznamu;
}

/** Načte položky jednoho seznamu. */
export async function nactiPolozkySeznamu(idSeznamu: string): Promise<PolozkaNakupu[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("shopping_list_items")
    .select("id, nazev, gramy, cena_za_100g, obchod, je_sleva, koupeno, vlastni, kategorie")
    .eq("list_id", idSeznamu)
    .order("id");
  if (error) throw new Error(`Položky se nenačetly: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    nazev: p.nazev,
    gramy: p.gramy,
    cenaZa100g: p.cena_za_100g === null ? null : Number(p.cena_za_100g),
    obchod: p.obchod,
    jeSleva: p.je_sleva,
    koupeno: p.koupeno,
    vlastni: p.vlastni,
    kategorie: p.kategorie,
  }));
}

/** Přepne stav seznamu (hotovo/nehotovo). */
export async function prepnoutHotovo(idSeznamu: string, hotovo: boolean): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_lists").update({ hotovo }).eq("id", idSeznamu);
  if (error) throw new Error(`Seznam se neupravil: ${error.message}`);
}

/** Smazání seznamu (položky kaskádově). */
export async function smazNakupniSeznam(idSeznamu: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_lists").delete().eq("id", idSeznamu);
  if (error) throw new Error(`Seznam se nesmazal: ${error.message}`);
}

/** Přepne „koupeno" u položky. */
export async function prepnoutKoupeno(idPolozky: string, koupeno: boolean): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_list_items").update({ koupeno }).eq("id", idPolozky);
  if (error) throw new Error(`Položka se neupravila: ${error.message}`);
}

/** Ruční položka (není z katalogu – sůl, paprika, sáčky…). */
export async function pridejVlastniPolozku(
  idSeznamu: string,
  nazev: string,
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_list_items").insert({
    list_id: idSeznamu,
    nazev,
    vlastni: true,
  });
  if (error) throw new Error(`Položka se nepřidala: ${error.message}`);
}

/** Smazání jedné položky. */
export async function smazPolozku(idPolozky: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_list_items").delete().eq("id", idPolozky);
  if (error) throw new Error(`Položka se nesmazala: ${error.message}`);
}
