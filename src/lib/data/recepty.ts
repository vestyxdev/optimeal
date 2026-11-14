import type { Potravina } from "@/lib/generator/generator";
import { supabase } from "@/lib/supabase";

/**
 * Recepty – globální (seed/kurátor) i vlastní. Ceny a výživové
 * hodnoty se vždy počítají živě z aktuálních cen (aktualni_ceny),
 * takže recept odráží dnešní slevy. Gramáže surovin jsou na porci.
 */

export const KATEGORIE_NAZVY: Record<string, string> = {
  snidane: "Snídaně",
  polevka: "Polévka",
  hlavni: "Hlavní jídlo",
  svacina: "Svačina",
  desert: "Dezert",
};

export interface Surovina {
  foodId: string;
  nazev: string;
  gramyNaPorce: number;
  poznamka: string | null;
  alergeny?: string[];
}

export interface Recept {
  id: string;
  /** null = globální recept, jinak id autora */
  userId: string | null;
  nazev: string;
  popis: string | null;
  kategorie: string;
  porce: number;
  casMinuty: number | null;
  postup: string;
  zdroj: string;
  suroviny: Surovina[];
}

interface RadkaReceptu {
  id: string;
  user_id: string | null;
  nazev: string;
  popis: string | null;
  kategorie: string;
  porce: number;
  cas_minuty: number | null;
  postup: string;
  zdroj: string;
  suroviny: {
    food_id: string;
    gramy_na_porce: number;
    poznamka: string | null;
    potravina: { nazev: string; alergeny?: string[] } | null;
  }[];
}

function naRecept(r: RadkaReceptu): Recept {
  return {
    id: r.id,
    userId: r.user_id,
    nazev: r.nazev,
    popis: r.popis,
    kategorie: r.kategorie,
    porce: r.porce,
    casMinuty: r.cas_minuty,
    postup: r.postup ?? "",
    zdroj: r.zdroj,
    suroviny: (r.suroviny ?? [])
      .filter((s) => s.potravina !== null)
      .map((s) => ({
        foodId: s.food_id,
        nazev: s.potravina?.nazev ?? "",
        gramyNaPorce: Number(s.gramy_na_porce),
        poznamka: s.poznamka,
        alergeny: s.potravina?.alergeny ?? [],
      })),
  };
}

/** Sjednocení alergenů všech surovin receptu (pro zobrazení/badge). */
export function alergenyReceptu(recept: Recept): string[] {
  return [...new Set(recept.suroviny.flatMap((s) => s.alergeny ?? []))];
}

/** Načte globální + vlastní recepty s surovinami (jeden dotaz). */
export async function nactiRecepty(): Promise<Recept[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("recipes")
    .select("id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj, suroviny:recipe_ingredients(food_id, gramy_na_porce, poznamka, potravina:foods(nazev, alergeny))")
    .order("kategorie")
    .order("nazev");

  if (error) throw new Error(`Recepty se nenačetly: ${error.message}`);
  return (data as unknown as RadkaReceptu[]).map(naRecept);
}

/** Detail jednoho receptu. */
export async function nactiRecept(id: string): Promise<Recept> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("recipes")
    .select("id, user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj, suroviny:recipe_ingredients(food_id, gramy_na_porce, poznamka, potravina:foods(nazev, alergeny))")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Recept se nenačetl: ${error.message}`);
  return naRecept(data as unknown as RadkaReceptu);
}

/** Vytvoření vlastního receptu (RLS: jen pro přihlášeného). */
export async function ulozRecept(recept: {
  nazev: string;
  popis?: string | undefined;
  kategorie: string;
  porce: number;
  casMinuty?: number | null | undefined;
  postup: string;
  suroviny: { foodId: string; gramyNaPorce: number; poznamka?: string | null | undefined }[];
}): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  const { data, error } = await klient
    .from("recipes")
    .insert({
      user_id: uzivatel.user.id,
      nazev: recept.nazev,
      popis: recept.popis ?? null,
      kategorie: recept.kategorie,
      porce: recept.porce,
      cas_minuty: recept.casMinuty ?? null,
      postup: recept.postup,
      zdroj: "manual",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Recept se neuložil: ${error.message}`);
  const idReceptu = data.id as string;

  if (recept.suroviny.length > 0) {
    const { error: errS } = await klient.from("recipe_ingredients").insert(
      recept.suroviny.map((s) => ({
        recipe_id: idReceptu,
        food_id: s.foodId,
        gramy_na_porce: s.gramyNaPorce,
        poznamka: s.poznamka ?? null,
      })),
    );
    if (errS) {
      // kompenzace – jinak zůstane osiřelý recept bez surovin
      await klient.from("recipes").delete().eq("id", idReceptu);
      throw new Error(`Suroviny se neuložily: ${errS.message}`);
    }
  }

  return idReceptu;
}

/** Úprava vlastního receptu – hlavičku přepíše, suroviny nahradí novými. */
export async function upravRecept(
  id: string,
  recept: {
    nazev: string;
    popis?: string | undefined;
    kategorie: string;
    porce: number;
    casMinuty?: number | null | undefined;
    postup: string;
    suroviny: { foodId: string; gramyNaPorce: number; poznamka?: string | null | undefined }[];
  },
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { error } = await klient
    .from("recipes")
    .update({
      nazev: recept.nazev,
      popis: recept.popis ?? null,
      kategorie: recept.kategorie,
      porce: recept.porce,
      cas_minuty: recept.casMinuty ?? null,
      postup: recept.postup,
    })
    .eq("id", id);
  if (error) throw new Error(`Recept se neuložil: ${error.message}`);

  // snapshot původních surovin – když vložení nových selže, recept
  // by jinak přišel o všechny suroviny (PostgREST nemá transakce)
  const { data: stareSuroviny } = await klient
    .from("recipe_ingredients")
    .select("food_id, gramy_na_porce, poznamka")
    .eq("recipe_id", id);

  const { error: errDel } = await klient.from("recipe_ingredients").delete().eq("recipe_id", id);
  if (errDel) throw new Error(`Suroviny se neuložily: ${errDel.message}`);

  if (recept.suroviny.length > 0) {
    const { error: errIns } = await klient.from("recipe_ingredients").insert(
      recept.suroviny.map((s) => ({
        recipe_id: id,
        food_id: s.foodId,
        gramy_na_porce: s.gramyNaPorce,
        poznamka: s.poznamka ?? null,
      })),
    );
    if (errIns) {
      // kompenzace – obnovit původní suroviny, ať recept nezůstane prázdný
      if (stareSuroviny && stareSuroviny.length > 0) {
        await klient.from("recipe_ingredients").insert(
          stareSuroviny.map((s) => ({ ...s, recipe_id: id })),
        );
      }
      throw new Error(`Suroviny se neuložily: ${errIns.message}`);
    }
  }
}

/** Smazání vlastního receptu (RLS chrání). */
export async function smazRecept(id: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("recipes").delete().eq("id", id);
  if (error) throw new Error(`Recept se nesmazal: ${error.message}`);
}

// ============================================================
// VÝPOČETY Z ŽIVÝCH CEN
// ============================================================

export interface RozborReceptu {
  /** na 1 porci */
  naPorci: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number; cena: number };
  /** na všechny porce */
  celkem: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number; cena: number };
  /** cena suroviny s výskyt chybějící ceny */
  chybejiciCeny: string[];
  /** kategorie s nejvyšším podílem kalorií – dominantní složka */
  dominujici: string;
}

/**
 * Spočítá výživu a cenu receptu z aktuálních cen. Potraviny bez
 * ceny (nemají pozorování) jsou označeny – nezboří součet, jen
 * jsou uvedeny v chybejiciCeny.
 */
export function spocitejRecept(recept: Recept, potraviny: Potravina[] | null): RozborReceptu {
  const mapa = new Map((potraviny ?? []).map((p) => [p.id, p]));
  const soucet = { kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0 };
  const chybejiciCeny: string[] = [];
  const kaloriePodleKategorie: Record<string, number> = {};

  for (const s of recept.suroviny) {
    const p = mapa.get(s.foodId);
    if (!p) continue; // surovina mimo katalog
    const gramy = s.gramyNaPorce * recept.porce;
    const koef = gramy / 100;
    soucet.kalorie += p.kalorie * koef;
    soucet.bilkoviny += p.bilkoviny * koef;
    soucet.sacharidy += p.sacharidy * koef;
    soucet.tuky += p.tuky * koef;
    if (p.aktualniCena > 0) {
      soucet.cena += (p.aktualniCena * gramy) / 100;
      const kat = p.kategorie ?? "ostatni";
      kaloriePodleKategorie[kat] = (kaloriePodleKategorie[kat] ?? 0) + p.kalorie * koef;
    } else {
      chybejiciCeny.push(p.nazev);
    }
  }

  const naPorci = {
    kalorie: Math.round(soucet.kalorie / recept.porce),
    bilkoviny: Math.round((soucet.bilkoviny / recept.porce) * 10) / 10,
    sacharidy: Math.round((soucet.sacharidy / recept.porce) * 10) / 10,
    tuky: Math.round((soucet.tuky / recept.porce) * 10) / 10,
    cena: Math.round((soucet.cena / recept.porce) * 100) / 100,
  };
  const celkem = {
    kalorie: Math.round(soucet.kalorie),
    bilkoviny: Math.round(soucet.bilkoviny * 10) / 10,
    sacharidy: Math.round(soucet.sacharidy * 10) / 10,
    tuky: Math.round(soucet.tuky * 10) / 10,
    cena: Math.round(soucet.cena * 100) / 100,
  };

  const dominujici =
    Object.entries(kaloriePodleKategorie).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ostatni";

  return { naPorci, celkem, chybejiciCeny, dominujici };
}
