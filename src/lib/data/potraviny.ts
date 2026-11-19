import { supabase } from "@/lib/supabase";
import { nactiVse } from "@/lib/data/strankovani";
import type { Potravina } from "@/lib/generator/generator";

/**
 * Katalog potravin â€“ naÄŤĂ­tĂˇ view `aktualni_ceny` (efektivnĂ­ ceny)
 * a rozĹˇiĹ™uje o vlastnictvĂ­ (vytvoril / zdroj = 'uzivatel').
 */

export interface KatalogPotravina extends Potravina {
  vytvoril: string | null;
  zdroj: string;
  obrazek: string | null;
  ean: string | null;
}

export async function nactiKatalogPotravin(): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");

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
    // obchod ukazujeme i u bÄ›ĹľnĂ© ceny â€“ asortimentnĂ­ cena eshopu
    // je pro Cenovku stejnÄ› dĹŻleĹľitĂˇ jako letĂˇkovĂˇ sleva
    obchod: (r.obchod ?? null) as string | null,
    sleva: Boolean(r.sleva),
    vytvoril: (r.vytvoril ?? null) as string | null,
    zdroj: (r.zdroj_potraviny as string) ?? "manual",
    alergeny: (r.alergeny as string[]) ?? [],
    diety: (r.diety as string[]) ?? [],
    obrazek: (r.obrazek ?? null) as string | null,
    ean: (r.ean ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
    puvodniCena: r.puvodni_cena != null ? Number(r.puvodni_cena) : null,
    puvodniZdroj: (r.puvodni_zdroj ?? null) as NonNullable<KatalogPotravina["puvodniZdroj"]>,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
    pozorovanoAt: (r.pozorovano_at ?? null) as string | null,
  }));
}

/** Top akÄŤnĂ­ nabĂ­dky ĹľivÄ› z view â€“ pro dashboard â€žAktuĂˇlnĂ­ akceâ€ś. */
export async function nactiAktualniSlevy(limit = 10): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");

  const { data, error } = await klient
    .from("aktualni_ceny")
    .select("*")
    .eq("sleva", true)
    .order("sleva_procenta", { ascending: false, nullsFirst: false })
    .order("pozorovano_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Slevy se nepodaĹ™ilo naÄŤĂ­st: ${error.message}`);

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
    puvodniZdroj: (r.puvodni_zdroj ?? null) as NonNullable<KatalogPotravina["puvodniZdroj"]>,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
    pozorovanoAt: (r.pozorovano_at ?? null) as string | null,
  }));
}

/** VeĹ™ejnĂˇ akce pro landing â€“ ĂşzkĂˇ projekce z RPC top_akce (funguje i pro anon). */
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

/** Top slevy pĹ™es security-definer RPC â€“ ÄŤitelnĂ© i nepĹ™ihlĂˇĹˇenĂ˝m (landing). */
export async function nactiVerejneAkce(limit = 12): Promise<VerejnaAkce[]> {
  const klient = supabase;
  if (!klient) return [];
  const { data, error } = await klient.rpc("top_akce", { p_limit: limit });
  if (error) throw new Error(`Slevy se nepodaĹ™ilo naÄŤĂ­st: ${error.message}`);
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

/** Detail jednĂ© potraviny pĹ™Ă­mo z foods â€“ pro editaÄŤnĂ­ formulĂˇĹ™ (obsahuje i ean). */
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
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");
  const { data, error } = await klient
    .from("foods")
    .select("id, nazev, kategorie, kalorie, bilkoviny, sacharidy, tuky, bezna_cena, ean, baleni_g")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Potravinu se nepodaĹ™ilo naÄŤĂ­st: ${error.message}`);
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

/** UpravĂ­ vlastnĂ­ potravinu (RLS dovolĂ­ jen autor â€“ zdroj='uzivatel'). */
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
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");

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
  // SchĂ©ma bez migrace 0009 neznĂˇ sloupec obrazek â€“ zkusit znovu bez nÄ›j.
  if (error && payload.obrazek !== undefined && /obrazek|PGRST204/i.test(`${error.code} ${error.message}`)) {
    delete payload.obrazek;
    ({ error } = await klient.from("foods").update(payload).eq("id", id));
  }

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      throw new Error("Potravina s tĂ­mto nĂˇzvem uĹľ v katalogu existuje.");
    }
    throw new Error(`Potravinu se nepodaĹ™ilo upravit: ${error.message}`);
  }
}

/** Najde potravinu v katalogu podle uloĹľenĂ©ho ÄŤĂˇrovĂ©ho kĂłdu (lokĂˇlnĂ­ hit pĹ™ed OFF). */
export async function hledejPodleEanLokalne(
  ean: string,
): Promise<{ id: string; nazev: string } | null> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");
  const { data, error } = await klient
    .from("foods")
    .select("id, nazev")
    .eq("ean", ean)
    .maybeSingle();
  if (error) throw new Error(`HledĂˇnĂ­ podle kĂłdu selhalo: ${error.message}`);
  return data ? { id: data.id as string, nazev: data.nazev as string } : null;
}

/** VloĹľĂ­ vlastnĂ­ potravinu pĹ™ihlĂˇĹˇenĂ©ho uĹľivatele (RLS: zdroj='uzivatel' + vytvoril=auth.uid()). */
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
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");

  const {
    data: { user },
    error: authChyba,
  } = await klient.auth.getUser();
  if (authChyba || !user) throw new Error("Pro pĹ™idĂˇnĂ­ potraviny se musĂ­te pĹ™ihlĂˇsit.");

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
  // SchĂ©ma bez migrace 0009 neznĂˇ sloupec obrazek â€“ zkusit znovu bez nÄ›j.
  if (error && payload.obrazek !== undefined && /obrazek|PGRST204/i.test(`${error.code} ${error.message}`)) {
    delete payload.obrazek;
    ({ data, error } = await klient.from("foods").insert(payload).select("id").single());
  }

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      throw new Error("Potravina s tĂ­mto nĂˇzvem uĹľ v katalogu existuje.");
    }
    throw new Error(`Potravinu se nepodaĹ™ilo uloĹľit: ${error.message}`);
  }
  if (!data) throw new Error("Potravina se uloĹľila, ale server nevrĂˇtil id.");
  return data.id as string;
}

/** SmaĹľe vlastnĂ­ potravinu (RLS dovolĂ­ jen autor). */
export async function smazPotravinu(id: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase nenĂ­ pĹ™ipojeno.");
  const { error } = await klient.from("foods").delete().eq("id", id);
  if (error) throw new Error(`Potravinu se nepodaĹ™ilo smazat: ${error.message}`);
}

/* ============================================================
 * OpenFoodFacts â€“ dohledĂˇnĂ­ vĂ˝ĹľivovĂ˝ch hodnot podle nĂˇzvu
 * (veĹ™ejnĂ© API, nutriments za 100 g odpovĂ­dajĂ­ naĹˇemu formĂˇtu).
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

/** PĹ™evede jeden OFF produkt na potravinu; null kdyĹľ chybĂ­ nĂˇzev nebo kladnĂ© kcal. */
function parsujOffProdukt(p: OffProdukt): OffNalezenaPotravina | null {
  const n = p.nutriments;
  if (!n) return null;
  // energy-kcal_100g je kcal; energy_100g je kJ â†’ pĹ™evĂ©st (1 kcal = 4,184 kJ)
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
 * Z JSON odpovÄ›di OFF vybere prvnĂ­ produkt s kompletnĂ­mi nutrienty.
 * ÄŚistĂˇ funkce â€“ testovatelnĂˇ bez sĂ­tÄ›.
 */
export function parsujOffProdukty(produkty: OffProdukt[]): OffNalezenaPotravina | null {
  return parsujOffProduktyVice(produkty)[0] ?? null;
}

/** VĹˇechny pouĹľitelnĂ© produkty z OFF odpovÄ›di â€“ pro vĂ˝bÄ›r z vĂ­ce kandidĂˇtĹŻ. */
export function parsujOffProduktyVice(produkty: OffProdukt[]): OffNalezenaPotravina[] {
  const vysledky: OffNalezenaPotravina[] = [];
  for (const p of produkty) {
    const v = parsujOffProdukt(p);
    if (v) vysledky.push(v);
  }
  return vysledky;
}

/** Fetch na OFF se srozumitelnou chybou i pĹ™i vĂ˝padku sĂ­tÄ› (TypeError). */
async function fetchOff(url: string): Promise<Response> {
  let odpoved: Response;
  try {
    odpoved = await fetch(url, {
      headers: { "User-Agent": "OptiMeal/2.0 (https://github.com/vestyxdev/optimeal)" },
    });
  } catch {
    throw new Error("NepodaĹ™ilo se pĹ™ipojit k OpenFoodFacts â€“ zkontrolujte pĹ™ipojenĂ­ k internetu.");
  }
  if (!odpoved.ok) throw new Error("OpenFoodFacts neodpovĂ­dĂˇ â€“ zkuste to za chvĂ­li.");
  return odpoved;
}

/** VyhledĂˇ produkty v OFF podle nĂˇzvu â€“ vracĂ­ vĹˇechny pouĹľitelnĂ© kandidĂˇty. */
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

/** Normalizuje ÄŤĂˇrovĂ˝ kĂłd (EAN/UPC): jen ÄŤĂ­slice, dĂ©lka 8/12/13/14. Jinak null. */
export function normalizujEan(vstup: string): string | null {
  const ean = vstup.replace(/[\s-]/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(ean) ? ean : null;
}

/**
 * DohledĂˇ produkt v OpenFoodFacts podle ÄŤĂˇrovĂ©ho kĂłdu (EAN/UPC).
 * Product API vracĂ­ jeden produkt â€“ status 0 = nenalezen.
 */
export async function nactiOffPodleEan(
  vstup: string,
): Promise<OffNalezenaPotravina | null> {
  const ean = normalizujEan(vstup);
  if (ean === null) throw new Error("Zadejte platnĂ˝ ÄŤĂˇrovĂ˝ kĂłd (8â€“14 ÄŤĂ­slic).");

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,product_name_cs,image_small_url,image_front_small_url,nutriments`;
  const odpoved = await fetchOff(url);

  const json = (await odpoved.json()) as { status?: number; product?: OffProdukt };
  if (json.status !== 1 || !json.product) return null;
  return parsujOffProdukty([json.product]);
}
