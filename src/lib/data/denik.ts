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
  /** ISO timestamp – den se počítá ze sloupce zapsano_dne */
  zapsanoAt: string;
}

/** Položka formuláře před zápisem (z výběru z katalogu). */
export interface NovaPoznamka extends Makra100 {
  foodId: string | null;
  nazev: string;
  obrazek: string | null;
  mnozstviG: number;
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
  zapsano_at: string;
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
    zapsanoAt: r.zapsano_at,
  };
}

/** Všechny záznamy deníku pro daný den (ISO YYYY-MM-DD). */
export async function nactiDenik(datum: string): Promise<PoznamkaDeniku[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("diary_entries")
    .select("id, food_id, nazev, obrazek, typ_jidla, mnozstvi_g, kalorie, bilkoviny, sacharidy, tuky, zapsano_at")
    .eq("zapsano_dne", datum)
    .order("zapsano_at", { ascending: true });
  if (error) throw new Error(`Deník se nepodařilo načíst: ${error.message}`);
  return (data ?? []).map((r) => naPoznamku(r as RadkaDeniku));
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
