import { supabase } from "@/lib/supabase";

/**
 * Jídelní deník – záznam toho, co uživatel skutečně snědl.
 *
 * Makra jsou v DB (i v typech) uložená jako snapshot NA 100 g –
 * stejné měřítko jako foods. Skutečný příjem = hodnota × mnozstvi_g / 100.
 */

export type TypJidla =
  | "snidane"
  | "svacina"
  | "obed"
  | "odpoledne"
  | "vecere"
  | "ostatni";

export interface TypJidlaInfo {
  klic: TypJidla;
  nazev: string;
}

export const TYPY_JIDLA: TypJidlaInfo[] = [
  { klic: "snidane", nazev: "Snídaně" },
  { klic: "svacina", nazev: "Svačina" },
  { klic: "obed", nazev: "Oběd" },
  { klic: "odpoledne", nazev: "Odpolední svačina" },
  { klic: "vecere", nazev: "Večeře" },
  { klic: "ostatni", nazev: "Ostatní" },
];

export function nazevTypuJidla(klic: TypJidla): string {
  return TYPY_JIDLA.find((t) => t.klic === klic)?.nazev ?? "Ostatní";
}

/**
 * Název jídla z uloženého plánu (jsonb, české názvy generátoru)
 * na klíč deníku. „Odpolední svačina“ i „Pozdní svačina“ musí
 * vyhrát před obecným „svačin“ – pořadí podmínek je důležité.
 */
export function typJidlaZNazvu(nazev: string): TypJidla {
  const n = nazev.toLowerCase();
  if (n.includes("snídan")) return "snidane";
  if (n.includes("oběd")) return "obed";
  if (n.includes("odpoledn") || n.includes("pozdní")) return "odpoledne";
  if (n.includes("večeř") || n.includes("před spaním")) return "vecere";
  if (n.includes("svačin") || n.includes("dopoledn")) return "svacina";
  return "ostatni";
}

/** Makra na 100 g – měřítko tabulky foods i snapshotu v deníku. */
export interface Makra100 {
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
}

/** Skutečný příjem (kcal / g makra) pro dané množství. */
export interface Makra {
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
}

export interface PoznamkaDeniku extends Makra100 {
  id: string;
  foodId: string | null;
  nazev: string;
  obrazek: string | null;
  typJidla: TypJidla;
  mnozstviG: number;
  /** den záznamu (YYYY-MM-DD, česká časová zóna) – klíč pro součty za den */
  zapsanoDne: string;
  /** ISO timestamp přesného času zápisu */
  zapsanoAt: string;
  /** alergeny napojené potraviny (join přes food_id) – pro varování v deníku */
  alergeny?: string[];
  /** podmnožina jen ze stop – „může obsahovat", jemnější varování */
  alergenyStopy?: string[];
}

/** Položka formuláře před zápisem (z výběru z katalogu). */
export interface NovaPoznamka extends Makra100 {
  foodId: string | null;
  nazev: string;
  obrazek: string | null;
  mnozstviG: number;
}

/**
 * Jídlo z uloženého plánu (makra za celou porci) → řádek deníku
 * (snapshot na 100 g + gramáž). Strukturálně kompatibilní se
 * `Jidlo` z generátoru, bez importu (žádný cyklus).
 */
export function jidloPlanuNaPoznamku(j: {
  id: string;
  nazev: string;
  gramy: number;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  obrazek?: string | null;
}): NovaPoznamka {
  const g = Math.max(1, j.gramy);
  const f = 100 / g;
  const r = (n: number) => Math.round(n * f * 100) / 100;
  return {
    foodId: j.id,
    nazev: j.nazev,
    obrazek: j.obrazek ?? null,
    mnozstviG: Math.round(g * 10) / 10,
    kalorie: r(j.kalorie),
    bilkoviny: r(j.bilkoviny),
    sacharidy: r(j.sacharidy),
    tuky: r(j.tuky),
  };
}

/* ------------------------------------------------------------------
 * Čisté výpočty – testovatelné bez sítě.
 * ---------------------------------------------------------------- */

/** Makra z množství: hodnota/100 g × gramy. Zaokrouhleno na 1 desetinu. */
export function makraProMnozstvi(m: Makra100, gramy: number): Makra {
  const f = Math.max(0, gramy) / 100;
  const r = (n: number) => Math.round(n * f * 10) / 10;
  return {
    kalorie: r(m.kalorie),
    bilkoviny: r(m.bilkoviny),
    sacharidy: r(m.sacharidy),
    tuky: r(m.tuky),
  };
}

/** Součet příjmu přes všechny záznamy (snapshot na 100 g × gramy). */
export function sectiPrijem(
  poznamky: ({ mnozstviG: number } & Makra100)[],
): Makra {
  const soucet = { kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0 };
  for (const p of poznamky) {
    const m = makraProMnozstvi(p, p.mnozstviG);
    soucet.kalorie += m.kalorie;
    soucet.bilkoviny += m.bilkoviny;
    soucet.sacharidy += m.sacharidy;
    soucet.tuky += m.tuky;
  }
  return {
    kalorie: Math.round(soucet.kalorie * 10) / 10,
    bilkoviny: Math.round(soucet.bilkoviny * 10) / 10,
    sacharidy: Math.round(soucet.sacharidy * 10) / 10,
    tuky: Math.round(soucet.tuky * 10) / 10,
  };
}

/**
 * Podíl hodnoty na cíli v % (např. kolik % denního cíle přidává
 * zapisovaná položka). Bez cíle (0) vrací 0 – žádné dělení nulou.
 */
export function podilNaCili(hodnota: number, cil: number): number {
  if (cil <= 0) return 0;
  return Math.round((hodnota / cil) * 100);
}

/** Dnešní datum ve formátu YYYY-MM-DD (lokální čas uživatele). */
export function dnesISO(d = new Date()): string {
  const rok = d.getFullYear();
  const mesic = String(d.getMonth() + 1).padStart(2, "0");
  const den = String(d.getDate()).padStart(2, "0");
  return `${rok}-${mesic}-${den}`;
}

/** Posun ISO data o n dní (záporné = zpět). */
export function posunDen(iso: string, oDny: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + oDny);
  return dnesISO(d);
}

/* ------------------------------------------------------------------
 * Série zapisování (streak) – čistý výpočet nad sadou zapsaných dnů
 * ---------------------------------------------------------------- */

export interface SerieDeniku {
  /** po sobě jdoucí zapsané dny končící dneškem (nebo včerejškem – dnešek se ještě „nepokazil“) */
  aktualni: number;
  /** nejdelší série v načteném okně */
  nejdelsi: number;
  /** dnešek už má aspoň jeden záznam */
  dnesZapsano: boolean;
  /** posledních 7 dnů (nejstarší → dnes) s příznakem zápisu */
  tyden: { iso: string; zapsano: boolean }[];
}

/**
 * Spočítá sérii z množiny dnů (YYYY-MM-DD) se záznamem.
 * Dnešek bez zápisu sérii nepřeruší – počítá se až po půlnoci,
 * proto série startuje z včerejška, dokud dnes nic není.
 */
export function spocitejSerii(dny: Iterable<string>, dnes: string): SerieDeniku {
  const sada = new Set(dny);

  const start = sada.has(dnes) ? dnes : posunDen(dnes, -1);
  let aktualni = 0;
  for (let d = start; sada.has(d); d = posunDen(d, -1)) aktualni++;

  let nejdelsi = 0;
  let beh = 0;
  let predchozi: string | null = null;
  for (const d of [...sada].sort()) {
    beh = predchozi !== null && d === posunDen(predchozi, 1) ? beh + 1 : 1;
    if (beh > nejdelsi) nejdelsi = beh;
    predchozi = d;
  }

  const tyden = Array.from({ length: 7 }, (_, i) => {
    const iso = posunDen(dnes, i - 6);
    return { iso, zapsano: sada.has(iso) };
  });

  return { aktualni, nejdelsi, dnesZapsano: sada.has(dnes), tyden };
}

/** Český tvar „den/dny/dní“ pro popisek série. */
export function dnyVTextu(n: number): string {
  if (n === 1) return "den";
  if (n >= 2 && n <= 4) return "dny";
  return "dní";
}

/** Jak daleko zpět se deník pro sérii načítá (pokryje i víceletou sérii). */
const OKNO_SERIE_DNI = 400;

/** Série zapisování – stačí sloupec zapsano_dne za posledních ~400 dnů. */
export async function nactiSerii(): Promise<SerieDeniku> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("diary_entries")
    .select("zapsano_dne")
    .gte("zapsano_dne", posunDen(dnesISO(), -OKNO_SERIE_DNI));
  if (error) throw new Error(`Sérii se nepodařilo načíst: ${error.message}`);
  return spocitejSerii(
    (data ?? []).map((r) => r.zapsano_dne as string),
    dnesISO(),
  );
}

/* ------------------------------------------------------------------
 * Databázová vrstva
 * ---------------------------------------------------------------- */

interface RadkaDeniku {
  id: string;
  food_id: string | null;
  nazev: string;
  obrazek: string | null;
  typ_jidla: TypJidla;
  mnozstvi_g: number | string;
  kalorie: number | string;
  bilkoviny: number | string;
  sacharidy: number | string;
  tuky: number | string;
  zapsano_dne: string;
  zapsano_at: string;
  potravina?: { alergeny?: string[] | null; alergeny_stopy?: string[] | null } | null;
}

function naPoznamku(r: RadkaDeniku): PoznamkaDeniku {
  return {
    id: r.id,
    foodId: r.food_id,
    nazev: r.nazev,
    obrazek: r.obrazek,
    typJidla: r.typ_jidla,
    mnozstviG: Number(r.mnozstvi_g),
    kalorie: Number(r.kalorie),
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    zapsanoDne: r.zapsano_dne,
    zapsanoAt: r.zapsano_at,
    alergeny: r.potravina?.alergeny ?? [],
    alergenyStopy: r.potravina?.alergeny_stopy ?? [],
  };
}

const SLOUPCE_DENIKU =
  "id, food_id, nazev, obrazek, typ_jidla, mnozstvi_g, kalorie, bilkoviny, sacharidy, tuky, zapsano_dne, zapsano_at," +
  " potravina:foods(alergeny, alergeny_stopy)";

/** Všechny záznamy deníku pro daný den (ISO YYYY-MM-DD). */
export async function nactiDenik(datum: string): Promise<PoznamkaDeniku[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("diary_entries")
    .select(SLOUPCE_DENIKU)
    .eq("zapsano_dne", datum)
    .order("zapsano_at", { ascending: true });
  if (error) throw new Error(`Deník se nepodařilo načíst: ${error.message}`);
  return (data ?? []).map((r) => naPoznamku(r as unknown as RadkaDeniku));
}

/** Záznamy za rozsah dnů včetně krajů (trend posledních N dnů). */
export async function nactiDenikRozsah(
  odDne: string,
  doDne: string,
): Promise<PoznamkaDeniku[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("diary_entries")
    .select(SLOUPCE_DENIKU)
    .gte("zapsano_dne", odDne)
    .lte("zapsano_dne", doDne)
    .order("zapsano_dne", { ascending: true })
    .order("zapsano_at", { ascending: true });
  if (error) throw new Error(`Deník se nepodařilo načíst: ${error.message}`);
  return (data ?? []).map((r) => naPoznamku(r as unknown as RadkaDeniku));
}

/**
 * Zapíše položky do deníku – jeden insert pro celý „pokladní blok“
 * (všechny vybrané potraviny najednou, stejný typ jídla a čas).
 */
export async function zapisDoDeniku(
  typJidla: TypJidla,
  datum: string,
  cas: string,
  poznamky: NovaPoznamka[],
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  if (poznamky.length === 0) return;

  const { data: uzivatel, error: authChyba } = await klient.auth.getUser();
  if (authChyba || !uzivatel.user) {
    throw new Error("Pro zápis do deníku se musíte přihlásit.");
  }

  const zapsanoAt = new Date(`${datum}T${cas || "12:00"}:00`);
  const { error } = await klient.from("diary_entries").insert(
    poznamky.map((p) => ({
      user_id: uzivatel.user!.id,
      food_id: p.foodId,
      nazev: p.nazev,
      obrazek: p.obrazek,
      typ_jidla: typJidla,
      mnozstvi_g: p.mnozstviG,
      kalorie: p.kalorie,
      bilkoviny: p.bilkoviny,
      sacharidy: p.sacharidy,
      tuky: p.tuky,
      zapsano_dne: datum,
      zapsano_at: zapsanoAt.toISOString(),
    })),
  );
  if (error) throw new Error(`Zápis do deníku selhal: ${error.message}`);
}

/**
 * Kopie uloženého záznamu na jiný den – zachová typ jídla, gramáž,
 * makro-snapshot i čas zápisu (hodina:minuta se přenese na nové datum).
 */
export function kopiePoznamky(
  p: Pick<
    PoznamkaDeniku,
    | "foodId"
    | "nazev"
    | "obrazek"
    | "typJidla"
    | "mnozstviG"
    | "kalorie"
    | "bilkoviny"
    | "sacharidy"
    | "tuky"
    | "zapsanoAt"
  >,
  doDne: string,
): Omit<RadkaDeniku, "id"> {
  const t = new Date(p.zapsanoAt);
  const cas = Number.isNaN(t.getTime())
    ? "12:00"
    : `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  return {
    food_id: p.foodId,
    nazev: p.nazev,
    obrazek: p.obrazek,
    typ_jidla: p.typJidla,
    mnozstvi_g: p.mnozstviG,
    kalorie: p.kalorie,
    bilkoviny: p.bilkoviny,
    sacharidy: p.sacharidy,
    tuky: p.tuky,
    zapsano_dne: doDne,
    zapsano_at: new Date(`${doDne}T${cas}:00`).toISOString(),
  };
}

/**
 * Nejbližší den PŘED `doDne`, který má aspoň jeden záznam
 * (pro „zopakovat předchozí den" – i když byl včera deník prázdný).
 */
export function posledniPredchoziDen(
  poznamky: { zapsanoDne: string }[],
  doDne: string,
): string | null {
  let nej: string | null = null;
  for (const p of poznamky) {
    if (p.zapsanoDne < doDne && (nej === null || p.zapsanoDne > nej)) {
      nej = p.zapsanoDne;
    }
  }
  return nej;
}

/** Zkopíruje záznamy na cílový den (typ jídla + čas se zachovají). Vrací počet řádků. */
export async function zkopirujZaznamy(
  poznamky: PoznamkaDeniku[],
  doDne: string,
): Promise<number> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  if (poznamky.length === 0) return 0;

  const { data: uzivatel, error: authChyba } = await klient.auth.getUser();
  if (authChyba || !uzivatel.user) {
    throw new Error("Pro zápis do deníku se musíte přihlásit.");
  }

  const { error } = await klient.from("diary_entries").insert(
    poznamky.map((p) => ({
      user_id: uzivatel.user!.id,
      ...kopiePoznamky(p, doDne),
    })),
  );
  if (error) throw new Error(`Kopírování selhalo: ${error.message}`);
  return poznamky.length;
}

/** Změna gramáže uloženého záznamu (makro snapshot zůstává). */
export async function upravPoznamkuDeniku(
  id: string,
  mnozstviG: number,
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient
    .from("diary_entries")
    .update({ mnozstvi_g: mnozstviG })
    .eq("id", id);
  if (error) throw new Error(`Gramáž se nepodařilo uložit: ${error.message}`);
}

/** Smaže vlastní záznam (RLS hlídá vlastnictví). */
export async function smazPoznamkuDeniku(id: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("diary_entries").delete().eq("id", id);
  if (error) throw new Error(`Záznam se nepodařilo smazat: ${error.message}`);
}
