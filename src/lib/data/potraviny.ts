import { supabase } from "@/lib/supabase";
import type { Potravina } from "@/lib/generator/generator";

/**
 * Katalog potravin – načítá view `aktualni_ceny` (efektivní ceny)
 * a rozšiřuje o vlastnictví (vytvoril / zdroj = 'uzivatel').
 */

export interface KatalogPotravina extends Potravina {
  vytvoril: string | null;
  zdroj: string;
}

export async function nactiKatalogPotravin(): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("aktualni_ceny")
    .select("*")
    .order("nazev");

  if (error) throw new Error(`Katalog se nenačetl: ${error.message}`);

  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.food_id as string,
    nazev: r.nazev as string,
    kategorie: r.kategorie as string,
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    kalorie: Number(r.kalorie),
    beznaCena: Number(r.bezna_cena),
    aktualniCena: Number(r.aktualni_cena ?? r.bezna_cena),
    obchod: (r.sleva ? r.obchod : null) as string | null,
    sleva: Boolean(r.sleva),
    vytvoril: (r.vytvoril ?? null) as string | null,
    zdroj: (r.zdroj_potraviny as string) ?? "manual",
  }));
}

/** Vloží vlastní potravinu přihlášeného uživatele (RLS: zdroj='uzivatel' + vytvoril=auth.uid()). */
export async function pridejPotravinu(p: {
  nazev: string;
  kategorie: string;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  beznaCena: number;
}): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const {
    data: { user },
    error: authChyba,
  } = await klient.auth.getUser();
  if (authChyba || !user) throw new Error("Pro přidání potraviny se musíte přihlásit.");

  const { data, error } = await klient
    .from("foods")
    .insert({
      nazev: p.nazev.trim(),
      kategorie: p.kategorie,
      kalorie: p.kalorie,
      bilkoviny: p.bilkoviny,
      sacharidy: p.sacharidy,
      tuky: p.tuky,
      bezna_cena: p.beznaCena,
      zdroj: "uzivatel",
      vytvoril: user.id,
      schvaleno: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      throw new Error("Potravina s tímto názvem už v katalogu existuje.");
    }
    throw new Error(`Potravinu se nepodařilo uložit: ${error.message}`);
  }
  return data.id as string;
}

/** Smaže vlastní potravinu (RLS dovolí jen autor). */
export async function smazPotravinu(id: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("foods").delete().eq("id", id);
  if (error) throw new Error(`Potravinu se nepodařilo smazat: ${error.message}`);
}

/* ============================================================
 * OpenFoodFacts – dohledání výživových hodnot podle názvu
 * (veřejné API, nutriments za 100 g odpovídají našemu formátu).
 * ============================================================ */

export interface OffNalezenaPotravina {
  nazev: string;
  kalorie: number | null;
  bilkoviny: number | null;
  sacharidy: number | null;
  tuky: number | null;
}

export async function hledejOpenFoodFacts(
  dotaz: string,
): Promise<OffNalezenaPotravina | null> {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl" +
    `?search_terms=${encodeURIComponent(dotaz)}` +
    "&search_simple=1&action=process&json=1&page_size=5&lc=cs";

  const odpoved = await fetch(url, {
    headers: { "User-Agent": "OptiMeal/2.0 (https://github.com/vestyxdev/optimeal)" },
  });
  if (!odpoved.ok) throw new Error("OpenFoodFacts neodpovídá – zkuste to za chvíli.");

  const json = (await odpoved.json()) as {
    products?: {
      product_name?: string;
      product_name_cs?: string;
      nutriments?: Record<string, unknown>;
    }[];
  };

  // první produkt, který má kompletní nutrienty za 100 g
  for (const p of json.products ?? []) {
    const n = p.nutriments;
    if (!n) continue;
    const kcal = Number(n["energy-kcal_100g"] ?? n.energy_100g);
    if (!Number.isFinite(kcal) || kcal <= 0) continue;
    const nazev = (p.product_name_cs ?? p.product_name ?? "").trim();
    if (!nazev) continue;
    const cislo = (v: unknown) => {
      const c = Number(v);
      return Number.isFinite(c) && c >= 0 ? Math.round(c * 10) / 10 : null;
    };
    return {
      nazev,
      kalorie: Math.round(kcal),
      bilkoviny: cislo(n.proteins_100g),
      sacharidy: cislo(n.carbohydrates_100g),
      tuky: cislo(n.fat_100g),
    };
  }
  return null;
}
