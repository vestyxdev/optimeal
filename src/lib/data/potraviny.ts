import { supabase } from "@/lib/supabase";
import { nactiVse, type StrankovatelnyDotaz } from "@/lib/data/strankovani";
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
  /** popisek balení pro UI: Balení | Plechovka | Láhev | Kelímek | Kus | Sáček | Krabice */
  baleniLabel: string | null;
  /** vláknina na 100 g/ml – null u zdrojů, které ji neudávají */
  vlaknina: number | null;
  /** značka včetně privátních labelů (Pilos, K-Classic, Clever, dmBio…) */
  znacka: string | null;
  /** zdroj ceny (asortiment:rohlík.cz, scraper:tesco…) – null = jen bezna_cena odhad */
  zdrojCeny: string | null;
}

/** České názvy alergenů EU-14 (klíče = foods.alergeny). */
export const ALERGEN_NAZVY: Record<string, string> = {
  lepek: "lepek", korisi: "korýši", vejce: "vejce", ryby: "ryby",
  arasidy: "arašídy", soja: "sója", mleko: "mléko", orisky: "ořechy",
  skorocel: "celer", horcice: "hořčice", sezam: "sezam",
  sulfit: "oxid siřičitý", lupina: "lupina", vodnany: "měkkýši",
};

/** Sloupce view aktualni_ceny potřebné pro UI (vynechává retailer_id). */
export const SLOUPCE_AKTUALNI_CENY =
  "food_id, nazev, kategorie, bilkoviny, sacharidy, tuky, kalorie," +
  " bezna_cena, aktualni_cena, obchod, sleva, platnost_do, zdroj_ceny," +
  " pozorovano_at, vytvoril, zdroj_potraviny, alergeny, alergeny_stopy, diety, ean," +
  " obrazek, baleni_g, baleni_label, puvodni_cena, sleva_procenta, puvodni_zdroj, vlaknina, znacka";

/** Sdílený mapper řádku aktualni_ceny → KatalogPotravina. */
function mapujKatalogRadek(r: Record<string, unknown>): KatalogPotravina {
  return {
    id: r.food_id as string,
    nazev: r.nazev as string,
    kategorie: r.kategorie as string,
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    kalorie: Number(r.kalorie),
    beznaCena: Number(r.bezna_cena),
    aktualniCena: Number(r.aktualni_cena ?? r.bezna_cena),
    // obchod ukazujeme i u běžné ceny – asortimentní cena eshopu
    // je pro Cenovku stejně důležitá jako letáková sleva
    obchod: (r.obchod ?? null) as string | null,
    sleva: Boolean(r.sleva),
    vytvoril: (r.vytvoril ?? null) as string | null,
    zdroj: (r.zdroj_potraviny as string) ?? "manual",
    alergeny: (r.alergeny as string[]) ?? [],
    alergenyStopy: (r.alergeny_stopy as string[]) ?? [],
    diety: (r.diety as string[]) ?? [],
    obrazek: (r.obrazek ?? null) as string | null,
    ean: (r.ean ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
    baleniLabel: (r.baleni_label ?? null) as string | null,
    puvodniCena: r.puvodni_cena != null ? Number(r.puvodni_cena) : null,
    puvodniZdroj: (r.puvodni_zdroj ?? null) as NonNullable<KatalogPotravina["puvodniZdroj"]>,
    slevaProcenta: r.sleva_procenta != null ? Number(r.sleva_procenta) : null,
    platnostDo: (r.platnost_do ?? null) as string | null,
    pozorovanoAt: (r.pozorovano_at ?? null) as string | null,
    vlaknina: r.vlaknina != null ? Number(r.vlaknina) : null,
    znacka: (r.znacka ?? null) as string | null,
    zdrojCeny: (r.zdroj_ceny ?? null) as string | null,
  };
}

export async function nactiKatalogPotravin(): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const data = await nactiVse<Record<string, unknown>>(
    () =>
      klient
        .from("aktualni_ceny")
        .select(SLOUPCE_AKTUALNI_CENY)
        .order("nazev") as unknown as StrankovatelnyDotaz<Record<string, unknown>>,
  );

  return data.map(mapujKatalogRadek);
}

/** Filtry server-side prohlížení katalogu (RPC katalog_stranka). */
export interface KatalogFiltrServer {
  dotaz?: string;
  kategorie?: string;
  jenSlevy?: boolean;
  zero?: boolean;
  protein?: boolean;
  razeni?: string;
}

export interface KatalogStranka {
  radky: KatalogPotravina[];
  celkem: number;
}

/**
 * Server-side stránka katalogu – filtry/řazení/hledání běží v DB,
 * klient stáhne jen viditelnou stránku (škáluje i při 20k+ potravinách).
 */
export async function nactiKatalogStranku(
  filtr: KatalogFiltrServer,
  limit = 100,
  offset = 0,
): Promise<KatalogStranka> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient.rpc("katalog_stranka", {
    p_dotaz: filtr.dotaz?.trim() || null,
    p_kategorie: filtr.kategorie && filtr.kategorie !== "vse" ? filtr.kategorie : null,
    p_jen_slevy: filtr.jenSlevy ?? false,
    p_zero: filtr.zero ?? false,
    p_protein: filtr.protein ?? false,
    p_razeni: filtr.razeni ?? "relevance",
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(`Katalog se nepodařilo načíst: ${error.message}`);

  const radky = (data ?? []) as unknown as Record<string, unknown>[];
  return {
    radky: radky.map(mapujKatalogRadek),
    celkem: radky.length > 0 ? Number(radky[0]?.celkem ?? 0) : 0,
  };
}

/** Top akční nabídky živě z view – pro dashboard „Aktuální akce“. */
export async function nactiAktualniSlevy(limit = 10): Promise<KatalogPotravina[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("aktualni_ceny")
    .select(SLOUPCE_AKTUALNI_CENY)
    .eq("sleva", true)
    .order("sleva_procenta", { ascending: false, nullsFirst: false })
    .order("pozorovano_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Slevy se nepodařilo načíst: ${error.message}`);

  const radky = (data ?? []) as unknown as Record<string, unknown>[];
  return radky.map((r) => {
    const zaklad = mapujKatalogRadek(r);
    return { ...zaklad, obchod: (r.sleva ? zaklad.obchod : null) as string | null, sleva: true as const };
  });
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
  /** stáří zdrojového pozorování – „cena z …" u nečerstvých */
  pozorovanoAt?: string | null;
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
    baleniLabel: (r.baleni_label ?? null) as string | null,
    pozorovanoAt: (r.pozorovano_at ?? null) as string | null,
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
    /** tagy dohledané z OFF – prázdné/undefined = stávající neměnit */
    alergeny?: string[];
    /** „může obsahovat stopy" (OFF traces_tags) – subset alergeny */
    stopy?: string[];
    diety?: string[];
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
  if (p.alergeny?.length) payload.alergeny = p.alergeny;
  if (p.stopy !== undefined) payload.alergeny_stopy = p.stopy;
  if (p.diety?.length) payload.diety = p.diety;

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
  /** tagy dohledané z OFF – prázdné/undefined = nevyplňovat */
  alergeny?: string[];
  /** „může obsahovat stopy" (OFF traces_tags) – subset alergeny */
  stopy?: string[];
  diety?: string[];
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
  if (p.alergeny?.length) payload.alergeny = p.alergeny;
  if (p.stopy !== undefined) payload.alergeny_stopy = p.stopy;
  if (p.diety?.length) payload.diety = p.diety;

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
  /** EU-14 klíče alergenů z OFF allergens+traces (prázdné = OFF nic nemá). */
  alergeny: string[];
  /** podmnožina alergeny, která pochází jen z OFF traces_tags –
   *  „může obsahovat stopy", ne skutečná ingredience. */
  stopy: string[];
  /** dietní klíče z OFF analysis/labels (prázdné = OFF nic nemá). */
  diety: string[];
}

export interface OffProdukt {
  product_name?: string;
  product_name_cs?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
  allergens_tags?: string[];
  traces_tags?: string[];
  ingredients_analysis_tags?: string[];
  labels_tags?: string[];
}

/** OFF alergen tag → náš EU-14 klíč (stejné mapování jako ingest_off.mjs). */
const OFF_ALERGEN_MAPA: Record<string, string> = {
  "en:gluten": "lepek", "en:crustaceans": "korisi", "en:eggs": "vejce",
  "en:fish": "ryby", "en:peanuts": "arasidy", "en:soybeans": "soja",
  "en:milk": "mleko", "en:nuts": "orisky", "en:celery": "skorocel",
  "en:mustard": "horcice", "en:sesame-seeds": "sezam",
  "en:sulphur-dioxide-and-sulphites": "sulfit", "en:lupin": "lupina",
  "en:molluscs": "vodnany",
};

/** OFF allergens+traces+analysis+labels → naše alergeny/stopy/diety.
 *  „may contain" (traces) bereme konzervativně jako alergen, ale
 *  evidujeme je v `stopy`, aby UI umělo odlišit „obsahuje" od
 *  „může obsahovat stopy". Stopy ⊆ alergeny – item, který je
 *  současně ingrediencí, jako stopa nefiguruje. */
function tagyZOff(p: OffProdukt): { alergeny: string[]; stopy: string[]; diety: string[] } {
  const mapuj = (t: string[]) =>
    t.map((x) => OFF_ALERGEN_MAPA[x]).filter((x): x is string => Boolean(x));
  const ingredience = new Set(mapuj(p.allergens_tags ?? []));
  const stopy = new Set(mapuj(p.traces_tags ?? []).filter((t) => !ingredience.has(t)));
  const alergeny = new Set([...ingredience, ...stopy]);
  const anal = new Set(p.ingredients_analysis_tags ?? []);
  const labels = new Set(p.labels_tags ?? []);
  const diety = new Set<string>();
  if (anal.has("en:vegan") || labels.has("en:vegan")) {
    diety.add("vegansky");
    diety.add("vegetariansky");
  } else if (anal.has("en:vegetarian") || labels.has("en:vegetarian")) {
    diety.add("vegetariansky");
  }
  if (labels.has("en:gluten-free") && !alergeny.has("lepek")) diety.add("bezlepkovy");
  return { alergeny: [...alergeny], stopy: [...stopy], diety: [...diety] };
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
  const { alergeny, stopy, diety } = tagyZOff(p);
  return {
    nazev,
    kalorie: Math.round(kcal),
    bilkoviny: cisloOff(n.proteins_100g),
    sacharidy: cisloOff(n.carbohydrates_100g),
    tuky: cisloOff(n.fat_100g),
    obrazek: (p.image_small_url ?? p.image_front_small_url ?? "").trim() || null,
    alergeny,
    stopy,
    diety,
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
      signal: AbortSignal.timeout(15_000),
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

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,product_name_cs,image_small_url,image_front_small_url,nutriments,allergens_tags,traces_tags,ingredients_analysis_tags,labels_tags`;
  const odpoved = await fetchOff(url);

  const json = (await odpoved.json()) as { status?: number; product?: OffProdukt };
  if (json.status !== 1 || !json.product) return null;
  return parsujOffProdukty([json.product]);
}

/** Názvy aktivních řetězců pro předvolby uživatele (oblíbené obchody). */
export async function nactiObchody(): Promise<string[]> {
  const klient = supabase;
  if (!klient) return [];
  const { data, error } = await klient
    .from("retailers")
    .select("nazev")
    .eq("aktivni", true)
    .order("nazev");
  if (error) throw new Error(`Obchody se nenačetly: ${error.message}`);
  return (data ?? []).map((r: { nazev: string }) => r.nazev);
}

/** Jedna řádka serverového trigramového hledání (RPC hledej_potraviny). */
export interface TrigramVysledek {
  foodId: string;
  nazev: string;
  kategorie: string;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  vlaknina: number | null;
  znacka: string | null;
  baleniG: number | null;
  baleniLabel: string | null;
  ean: string | null;
  podobnost: number;
}

/**
 * Mapování privátních labelů na řetězce (znacky_mapovani) – „Pilos" → „Lidl".
 * Katalog tak umí ukázat „jen v Lidlu" u značkových privátních produktů.
 */
export async function nactiMapovaniZnacek(): Promise<Map<string, string>> {
  const klient = supabase;
  if (!klient) return new Map();
  const { data, error } = await klient
    .from("znacky_mapovani")
    .select("znacka, retailer_id, retailers(nazev)");
  if (error) return new Map();
  const mapa = new Map<string, string>();
  for (const r of data ?? []) {
    const row = r as { znacka: string; retailers: { nazev: string } | { nazev: string }[] | null };
    const obchod = Array.isArray(row.retailers) ? row.retailers[0]?.nazev : row.retailers?.nazev;
    if (obchod) mapa.set(row.znacka.toLowerCase(), obchod);
  }
  return mapa;
}

/** Najde řetězec pro značku produktu (substring shoda – „Pilos jogurt" vs label „pilos"). */
export function obchodProZnacku(znacka: string | null, mapovani: Map<string, string>): string | null {
  if (!znacka) return null;
  const z = znacka.toLowerCase();
  for (const [label, obchod] of mapovani) {
    if (z === label || z.startsWith(label) || z.includes(label)) return obchod;
  }
  return null;
}

/**
 * Serverové fulltext hledání přes pg_trgm + unaccent – diakritika-insenzitivní
 * („kureci prsa“ → „Kuřecí prsa“), prefix shody první. Škáluje i na katalog,
 * který se do klienta už nevejde; lokální filtrace zůstává jako instantní fallback.
 */
export async function hledejPotravinyTrigram(dotaz: string, maxVysledku = 20): Promise<TrigramVysledek[]> {
  const klient = supabase;
  const q = dotaz.trim();
  if (!klient || q.length < 2) return [];
  const { data, error } = await klient.rpc("hledej_potraviny", {
    dotaz: q,
    max_vysledku: maxVysledku,
  });
  if (error) throw new Error(`Hledání selhalo: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    foodId: r.food_id as string,
    nazev: r.nazev as string,
    kategorie: r.kategorie as string,
    kalorie: Number(r.kalorie),
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    vlaknina: r.vlaknina != null ? Number(r.vlaknina) : null,
    znacka: (r.znacka ?? null) as string | null,
    baleniG: r.baleni_g != null ? Number(r.baleni_g) : null,
    baleniLabel: (r.baleni_label ?? null) as string | null,
    ean: (r.ean ?? null) as string | null,
    podobnost: Number(r.podobnost),
  }));
}
