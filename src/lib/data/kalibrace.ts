import { supabase } from "@/lib/supabase";
import { spocitejKalibraci } from "@/lib/vyziva/plan";

/**
 * Adaptivní kalibrace TDEE z reálných dat: průměrný příjem
 * z deníku a naměřená změna váhy (weight_logs se plní triggerem
 * při každé úpravě profiles.vaha_kg).
 *
 * Výsledek se do výpočtu plánu zamíchá váženě podle množství dat –
 * deník málokdy pokrývá všechno, proto max 60 % váhy měření.
 */

export interface Kalibrace {
  tdeeNamerene: number;
  /** váha naměřeného TDEE v mixu s rovnicí (0–0,6) */
  vaha: number;
  dnyDeniku: number;
  rozsahDni: number;
}

/** Dny zpátky, ze kterých se deník hodnotí. */
const OKNO_DENIKU_DNI = 60;

export async function nactiKalibraci(): Promise<Kalibrace | null> {
  const klient = supabase;
  if (!klient) return null;
  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) return null;

  const od = new Date();
  od.setDate(od.getDate() - OKNO_DENIKU_DNI);
  const odIso = od.toISOString().slice(0, 10);

  const [denik, vahy] = await Promise.all([
    klient
      .from("diary_entries")
      .select("zapsano_dne, kalorie, mnozstvi_g")
      .gte("zapsano_dne", odIso),
    klient
      .from("weight_logs")
      .select("vaha_kg, zapsano_at")
      .order("zapsano_at", { ascending: true }),
  ]);
  if (denik.error || vahy.error) return null;

  // součty příjmu za jednotlivé dny
  const dnyMapa = new Map<string, number>();
  for (const e of denik.data ?? []) {
    const kcal = (Number(e.kalorie) * Number(e.mnozstvi_g)) / 100;
    dnyMapa.set(e.zapsano_dne, (dnyMapa.get(e.zapsano_dne) ?? 0) + kcal);
  }
  const dnyDeniku = dnyMapa.size;
  const prijemKcalDenne =
    dnyDeniku > 0
      ? [...dnyMapa.values()].reduce((a, b) => a + b, 0) / dnyDeniku
      : 0;

  const logy = vahy.data ?? [];
  const prvni = logy[0];
  const posledni = logy[logy.length - 1];
  if (!prvni || !posledni || prvni === posledni) return null;
  const rozsahDni =
    (new Date(posledni.zapsano_at).getTime() - new Date(prvni.zapsano_at).getTime()) / 86400e3;

  const k = spocitejKalibraci({
    dnyDeniku,
    prijemKcalDenne,
    zmenaVahyKg: Number(posledni.vaha_kg) - Number(prvni.vaha_kg),
    rozsahDni,
  });
  if (!k) return null;
  return { ...k, dnyDeniku, rozsahDni: Math.round(rozsahDni) };
}
