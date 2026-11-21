import { supabase } from "@/lib/supabase";

/**
 * Spíž („mám doma") + Moje stálice.
 *
 * Přihlášený: tabulky pantry_items / pinned_staples (RLS user_id).
 * Host: localStorage – „om-spiz" / „om-stalice"; při přihlášení
 * se spíž/stálice nemigrují (jednoduché, domácí data = zařízení).
 */

export interface PolozkaSpize {
  foodId: string | null;
  nazev: string;
}

const K_SPIZ = "om-spiz";
const K_STALICE = "om-stalice";

function ctiHost(klic: string): PolozkaSpize[] {
  try {
    const raw = localStorage.getItem(klic);
    const arr = raw ? (JSON.parse(raw) as { f?: string | null; n: string }[]) : [];
    return arr
      .filter((x) => x && typeof x.n === "string")
      .map((x) => ({ foodId: x.f ?? null, nazev: x.n }));
  } catch {
    return [];
  }
}

function zapisHost(klic: string, seznam: PolozkaSpize[]): void {
  try {
    localStorage.setItem(
      klic,
      JSON.stringify(seznam.map((p) => ({ f: p.foodId, n: p.nazev }))),
    );
  } catch {
    /* localStorage nedostupný – spíž u hosta jen v paměti relace */
  }
}

/** Spíž uživatele; host → localStorage. */
export async function nactiSpiz(): Promise<PolozkaSpize[]> {
  const klient = supabase;
  if (!klient) return [];
  const {
    data: { user },
  } = await klient.auth.getUser();
  if (!user) return ctiHost(K_SPIZ);
  const { data, error } = await klient
    .from("pantry_items")
    .select("food_id, nazev")
    .eq("user_id", user.id);
  if (error) throw new Error(`Spíž se nepodařilo načíst: ${error.message}`);
  return (data ?? []).map((r) => ({ foodId: r.food_id as string | null, nazev: r.nazev as string }));
}

/** Přidá položku do spíže (dedupe podle názvu – ruční i katalogové). */
export async function pridejDoSpize(p: PolozkaSpize): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const {
    data: { user },
  } = await klient.auth.getUser();
  if (!user) {
    const s = ctiHost(K_SPIZ).filter((x) => x.nazev !== p.nazev);
    s.push(p);
    zapisHost(K_SPIZ, s);
    return;
  }
  const { error } = await klient.from("pantry_items").upsert(
    { user_id: user.id, food_id: p.foodId, nazev: p.nazev },
    { onConflict: "user_id,nazev" },
  );
  if (error) throw new Error(`Do spíže se nepodařilo přidat: ${error.message}`);
}

/** Odebere položku ze spíže („došlo" – vrací se do účtu nákupu). */
export async function odeberZeSpize(p: PolozkaSpize): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const {
    data: { user },
  } = await klient.auth.getUser();
  if (!user) {
    zapisHost(K_SPIZ, ctiHost(K_SPIZ).filter((x) => x.nazev !== p.nazev));
    return;
  }
  let q = klient
    .from("pantry_items")
    .delete()
    .eq("user_id", user.id)
    .eq("nazev", p.nazev);
  const { error } = await q;
  if (error) throw new Error(`Ze spíže se nepodařilo odebrat: ${error.message}`);
}

/** Je položka nákupu ve spíži? foodId primárně, název jako záloha. */
export function jeVeSpizi(
  spiz: PolozkaSpize[],
  p: { foodId?: string | null; nazev: string },
): boolean {
  return spiz.some(
    (s) =>
      (p.foodId != null && s.foodId === p.foodId) ||
      s.nazev.trim().toLowerCase() === p.nazev.trim().toLowerCase(),
  );
}

// ------------------------------------------------------------------
// Moje stálice
// ------------------------------------------------------------------

/** Ids připnutých stálic; host → localStorage. */
export async function nactiStalice(): Promise<Set<string>> {
  const klient = supabase;
  if (!klient) return new Set();
  const {
    data: { user },
  } = await klient.auth.getUser();
  if (!user) {
    return new Set(
      ctiHost(K_STALICE)
        .map((p) => p.foodId)
        .filter((id): id is string => id !== null),
    );
  }
  const { data, error } = await klient
    .from("pinned_staples")
    .select("food_id")
    .eq("user_id", user.id);
  if (error) throw new Error(`Stálice se nepodařilo načíst: ${error.message}`);
  return new Set((data ?? []).map((r) => r.food_id as string));
}

/** Přepne připnutí stálice; vrátí nový stav (true = připnutá). */
export async function prepnoutStalici(foodId: string, nazev: string): Promise<boolean> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const {
    data: { user },
  } = await klient.auth.getUser();
  if (!user) {
    const s = ctiHost(K_STALICE);
    const ma = s.some((p) => p.foodId === foodId);
    zapisHost(
      K_STALICE,
      ma ? s.filter((p) => p.foodId !== foodId) : [...s, { foodId, nazev }],
    );
    return !ma;
  }
  const { data: existujici } = await klient
    .from("pinned_staples")
    .select("id")
    .eq("user_id", user.id)
    .eq("food_id", foodId)
    .maybeSingle();
  if (existujici) {
    const { error } = await klient
      .from("pinned_staples")
      .delete()
      .eq("user_id", user.id)
      .eq("food_id", foodId);
    if (error) throw new Error(`Stálici se nepodařilo odepnout: ${error.message}`);
    return false;
  }
  const { error } = await klient
    .from("pinned_staples")
    .upsert({ user_id: user.id, food_id: foodId }, { onConflict: "user_id,food_id" });
  if (error) throw new Error(`Stálici se nepodařilo připnout: ${error.message}`);
  return true;
}
