import { supabase } from "@/lib/supabase";
import { nactiVse } from "@/lib/data/strankovani";
import type { Potravina } from "@/lib/generator/generator";

/**
 * Katalog potravin – načítá view `aktualni_ceny` (efektivní ceny)
 * a rozšiřuje o vlastnictví (vytvoril / zdroj = 'uzivatel').
 */

export interface KatalogPotravina extends Potravina {
  vytvoril: string | null;
  zdroj: string;
  obrazek: string | null;
  ean: string | null;
}

export async function nactiKatalogPotravin(): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const data = await nactiVse<Record<string, unknown>>(() =>
    klient
      .from("aktualni_ceny")
      .select("*")
      .order("nazev"),
  );

  return data.map((r) => ({
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
    alergeny: (r.alergeny as string[]) ?? [],
    diety: (r.diety as string[]) ?? [],
    obrazek: (r.obrazek ?? null) as string | null,
    ean: (r.ean ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
    puvodniCena: r.puvodni_cena != null ? Number(r.puvodni_cena) : null,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
  }));
}

/** Top akční nabídky živě z view – pro dashboard „Aktuální akce“. */
export async function nactiAktualniSlevy(limit = 10): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("aktualni_ceny")
    .select("*")
    .eq("sleva", true)
    .order("sleva_procenta", { ascending: false, nullsFirst: false })
    .order("pozorovano_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Slevy se nepodařilo načíst: ${error.message}`);

  return (data ?? []).map((r) => ({
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
    sleva: true,
    vytvoril: (r.vytvoril ?? null) as string | null,
    zdroj: (r.zdroj_potraviny as string) ?? "manual",
    alergeny: (r.alergeny as string[]) ?? [],
    diety: (r.diety as string[]) ?? [],
    obrazek: (r.obrazek ?? null) as string | null,
    ean: (r.ean ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
    puvodniCena: r.puvodni_cena != null ? Number(r.puvodni_cena) : null,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
  }));
}

/** Veřejná akce pro landing – úzká projekce z RPC top_akce (funguje i pro anon). */
export interface VerejnaAkce {
  nazev: string;
  obchod: string | null;
  cena: number;
  puvodniCena: number | null;
  slevaProcenta: number | null;
  platnostDo: string | null;
  obrazek: string | null;
  baleniG: number | null;
}

/** Top slevy přes security-definer RPC – čitelné i nepřihlášeným (landing). */
export async function nactiVerejneAkce(limit = 12): Promise<VerejnaAkce[]> {
  const klient = supabase;
  if (!klient) return [];
  const { data, error } = await klient.rpc("top_akce", { p_limit: limit });
  if (error) throw new Error(`Slevy se nepodařilo načíst: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    nazev: r.nazev as string,
    obchod: (r.obchod ?? null) as string | null,
    cena: Number(r.cena),
    puvodniCena: r.puvodni_cena != null ? Number(r.puvodni_cena) : null,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
    obrazek: (r.obrazek ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
  }));
}

/** Detail jedné potraviny přímo z foods – pro editační formulář (obsahuje i ean). */
export async function nactiPotravinu(id: string): Promise<{
  id: string;
  nazev: string;
  kategorie: string;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  beznaCena: number;
  ean: string | null;
  baleniG: number | null;
}> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { data, error } = await klient
    .from("foods")
    .select("id, nazev, kategorie, kalorie, bilkoviny, sacharidy, tuky, bezna_cena, ean, baleni_g")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Potravinu se nepodařilo načíst: ${error.message}`);
  return {
    id: data.id as string,
    nazev: data.nazev as string,
    kategorie: data.kategorie as string,
    kalorie: Number(data.kalorie),
    bilkoviny: Number(data.bilkoviny),
    sacharidy: Number(data.sacharidy),
    tuky: Number(data.tuky),
    beznaCena: Number(data.bezna_cena),
    ean: (data.ean ?? null) as string | null,
    baleniG: data.baleni_g != null ? Number(data.baleni_g) : null,
  };
}

/** Upraví vlastní potravinu (RLS dovolí jen autor – zdroj='uzivatel'). */
export async function upravPotravinu(
  id: string,
  p: {
    nazev: string;
    kategorie: string;
    kalorie: number;
    bilkoviny: number;
    sacharidy: number;
    tuky: number;
    beznaCena: number;
    ean?: string | null;
    obrazek?: string | null;
    baleniG?: number | null;
  },
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const payload: Record<string, unknown> = {
    nazev: p.nazev.trim(),
    kategorie: p.kategorie,
    kalorie: p.kalorie,
    bilkoviny: p.bilkoviny,
    sacharidy: p.sacharidy,
    tuky: p.tuky,
    bezna_cena: p.beznaCena,
    ean: p.ean ?? null,
    baleni_g: p.baleniG ?? null,
  };
  if (p.obrazek !== undefined) payload.obrazek = p.obrazek;

  let { error } = await klient.from("foods").update(payload).eq("id", id);
  // Schéma bez migrace 0009 nezná sloupec obrazek – zkusit znovu bez něj.
  if (error && payload.obrazek !== undefined && /obrazek|PGRST204/i.test(`${error.code} ${error.message}`)) {
    delete payload.obrazek;
    ({ error } = await klient.from("foods").update(payload).eq("id", id));
  }

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      throw new Error("Potravina s tímto názvem už v katalogu existuje.");
    }
    throw new Error(`Potravinu se nepodařilo upravit: ${error.message}`);
  }
}

/** Najde potravinu v katalogu podle uloženého čárového kódu (lokální hit před OFF). */
export async function hledejPodleEanLokalne(
  ean: string,
): Promise<{ id: string; nazev: string } | null> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { data, error } = await klient
    .from("foods")
    .select("id, nazev")
    .eq("ean", ean)
    .maybeSingle();
  if (error) throw new Error(`Hledání podle kódu selhalo: ${error.message}`);
  return data ? { id: data.id as string, nazev: data.nazev as string } : null;
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
  ean?: string | null;
  obrazek?: string | null;
  baleniG?: number | null;
}): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const {
    data: { user },
    error: authChyba,
  } = await klient.auth.getUser();
  if (authChyba || !user) throw new Error("Pro přidání potraviny se musíte přihlásit.");

  const payload: Record<string, unknown> = {
    nazev: p.nazev.trim(),
    kategorie: p.kategorie,
    kalorie: p.kalorie,
    bilkoviny: p.bilkoviny,
    sacharidy: p.sacharidy,
    tuky: p.tuky,
    bezna_cena: p.beznaCena,
    ean: p.ean ?? null,
    baleni_g: p.baleniG ?? null,
    zdroj: "uzivatel",
    vytvoril: user.id,
    schvaleno: true,
  };
  if (p.obrazek != null) payload.obrazek = p.obrazek;

  let { data, error } = await klient
    .from("foods")
    .insert(payload)
    .select("id")
    .single();
  // Schéma bez migrace 0009 nezná sloupec obrazek – zkusit znovu bez něj.
  if (error && payload.obrazek !== undefined && /obrazek|PGRST204/i.test(`${error.code} ${error.message}`)) {
    delete payload.obrazek;
    ({ data, error } = await klient.from("foods").insert(payload).select("id").single());
  }

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      throw new Error("Potravina s tímto názvem už v katalogu existuje.");
    }
    throw new Error(`Potravinu se nepodařilo uložit: ${error.message}`);
  }
  if (!data) throw new Error("Potravina se uložila, ale server nevrátil id.");
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
  obrazek: string | null;
}

export interface OffProdukt {
  product_name?: string;
  product_name_cs?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
}

const cisloOff = (v: unknown) => {
  const c = Number(v);
  return Number.isFinite(c) && c >= 0 ? Math.round(c * 10) / 10 : null;
};

/** Převede jeden OFF produkt na potravinu; null když chybí název nebo kladné kcal. */
function parsujOffProdukt(p: OffProdukt): OffNalezenaPotravina | null {
  const n = p.nutriments;
  if (!n) return null;
  // energy-kcal_100g je kcal; energy_100g je kJ → převést (1 kcal = 4,184 kJ)
  const kcalRaw = n["energy-kcal_100g"];
  const kcal =
    kcalRaw != null
      ? Number(kcalRaw)
      : n.energy_100g != null
        ? Number(n.energy_100g) / 4.184
        : NaN;
  if (!Number.isFinite(kcal) || kcal <= 0) return null;
  const nazev = (p.product_name_cs ?? p.product_name ?? "").trim();
  if (!nazev) return null;
  return {
    nazev,
    kalorie: Math.round(kcal),
    bilkoviny: cisloOff(n.proteins_100g),
    sacharidy: cisloOff(n.carbohydrates_100g),
    tuky: cisloOff(n.fat_100g),
    obrazek: (p.image_small_url ?? p.image_front_small_url ?? "").trim() || null,
  };
}

/**
 * Z JSON odpovědi OFF vybere první produkt s kompletními nutrienty.
 * Čistá funkce – testovatelná bez sítě.
 */
export function parsujOffProdukty(produkty: OffProdukt[]): OffNalezenaPotravina | null {
  return parsujOffProduktyVice(produkty)[0] ?? null;
}

/** Všechny použitelné produkty z OFF odpovědi – pro výběr z více kandidátů. */
export function parsujOffProduktyVice(produkty: OffProdukt[]): OffNalezenaPotravina[] {
  const vysledky: OffNalezenaPotravina[] = [];
  for (const p of produkty) {
    const v = parsujOffProdukt(p);
    if (v) vysledky.push(v);
  }
  return vysledky;
}

/** Fetch na OFF se srozumitelnou chybou i při výpadku sítě (TypeError). */
async function fetchOff(url: string): Promise<Response> {
  let odpoved: Response;
  try {
    odpoved = await fetch(url, {
      headers: { "User-Agent": "OptiMeal/2.0 (https://github.com/vestyxdev/optimeal)" },
    });
  } catch {
    throw new Error("Nepodařilo se připojit k OpenFoodFacts – zkontrolujte připojení k internetu.");
  }
  if (!odpoved.ok) throw new Error("OpenFoodFacts neodpovídá – zkuste to za chvíli.");
  return odpoved;
}

/** Vyhledá produkty v OFF podle názvu – vrací všechny použitelné kandidáty. */
export async function hledejOpenFoodFactsVice(
  dotaz: string,
  limit = 8,
): Promise<OffNalezenaPotravina[]> {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl" +
    `?search_terms=${encodeURIComponent(dotaz)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}&lc=cs`;

  const odpoved = await fetchOff(url);
  const json = (await odpoved.json()) as { products?: OffProdukt[] };
  return parsujOffProduktyVice(json.products ?? []);
}

export async function hledejOpenFoodFacts(
  dotaz: string,
): Promise<OffNalezenaPotravina | null> {
  return (await hledejOpenFoodFactsVice(dotaz, 5))[0] ?? null;
}

/** Normalizuje čárový kód (EAN/UPC): jen číslice, délka 8/12/13/14. Jinak null. */
export function normalizujEan(vstup: string): string | null {
  const ean = vstup.replace(/[\s-]/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(ean) ? ean : null;
}

/**
 * Dohledá produkt v OpenFoodFacts podle čárového kódu (EAN/UPC).
 * Product API vrací jeden produkt – status 0 = nenalezen.
 */
export async function nactiOffPodleEan(
  vstup: string,
): Promise<OffNalezenaPotravina | null> {
  const ean = normalizujEan(vstup);
  if (ean === null) throw new Error("Zadejte platný čárový kód (8–14 číslic).");

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,product_name_cs,image_small_url,image_front_small_url,nutriments`;
  const odpoved = await fetchOff(url);

  const json = (await odpoved.json()) as { status?: number; product?: OffProdukt };
  if (json.status !== 1 || !json.product) return null;
  return parsujOffProdukty([json.product]);
}
