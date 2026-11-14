import type { Aktivita, Cile, CilTela, Pohlavi } from "@/lib/vyziva/cile";
import { rpcChybi, supabase } from "@/lib/supabase";

/**
 * Profil uživatele + aktivní výživové cíle (RLS chrání vlastní řádky).
 */

export interface Profil {
  id: string;
  email: string;
  jmeno: string | null;
  vahaKg: number | null;
  vyskaCm: number | null;
  vekRoku: number | null;
  pohlavi: Pohlavi | null;
  aktivita: Aktivita | null;
  cilTela: CilTela | null;
  teloTukProcento: number | null;
  tydennyRozpocetKc: number | null;
  pocetJidelDenne: number;
  dieta: string[];
  alergie: string[];
}

interface RadkaProfilu {
  id: string;
  email: string;
  jmeno: string | null;
  vaha_kg: number | null;
  vyska_cm: number | null;
  vek_roku: number | null;
  pohlavi: Pohlavi | null;
  aktivita: Aktivita | null;
  cil_tela: CilTela | null;
  telo_tuk_procento: number | null;
  tydenny_rozpocet_kc: number | null;
  pocet_jidel_denne: number;
  dieta: string[];
  alergie: string[];
}

function naProfil(r: RadkaProfilu): Profil {
  return {
    id: r.id,
    email: r.email,
    jmeno: r.jmeno,
    vahaKg: r.vaha_kg === null ? null : Number(r.vaha_kg),
    vyskaCm: r.vyska_cm,
    vekRoku: r.vek_roku,
    pohlavi: r.pohlavi,
    aktivita: r.aktivita,
    cilTela: r.cil_tela,
    teloTukProcento: r.telo_tuk_procento === null ? null : Number(r.telo_tuk_procento),
    tydennyRozpocetKc: r.tydenny_rozpocet_kc === null ? null : Number(r.tydenny_rozpocet_kc),
    pocetJidelDenne: r.pocet_jidel_denne,
    dieta: r.dieta ?? [],
    alergie: r.alergie ?? [],
  };
}

/** Načte profil přihlášeného uživatele (trigger ho vytváří při registraci). */
export async function nactiProfil(): Promise<Profil | null> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient.from("profiles").select("*").maybeSingle();
  if (error) throw new Error(`Profil se nenačetl: ${error.message}`);
  if (!data) return null;
  return naProfil(data as RadkaProfilu);
}

/** Uložení tělesných údajů a preferencí. null = vymazat hodnotu, undefined = neměnit. */
export async function ulozProfil(zmeny: {
  jmeno?: string | undefined;
  vahaKg?: number | null | undefined;
  vyskaCm?: number | null | undefined;
  vekRoku?: number | null | undefined;
  pohlavi?: Pohlavi | null | undefined;
  aktivita?: Aktivita | null | undefined;
  cilTela?: CilTela | null | undefined;
  teloTukProcento?: number | null | undefined;
  tydennyRozpocetKc?: number | null | undefined;
  pocetJidelDenne?: number | undefined;
  dieta?: string[] | undefined;
  alergie?: string[] | undefined;
}): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  const { error } = await klient
    .from("profiles")
    .update({
      ...(zmeny.jmeno !== undefined ? { jmeno: zmeny.jmeno } : {}),
      ...(zmeny.vahaKg !== undefined ? { vaha_kg: zmeny.vahaKg } : {}),
      ...(zmeny.vyskaCm !== undefined ? { vyska_cm: zmeny.vyskaCm } : {}),
      ...(zmeny.vekRoku !== undefined ? { vek_roku: zmeny.vekRoku } : {}),
      ...(zmeny.pohlavi !== undefined ? { pohlavi: zmeny.pohlavi } : {}),
      ...(zmeny.aktivita !== undefined ? { aktivita: zmeny.aktivita } : {}),
      ...(zmeny.cilTela !== undefined ? { cil_tela: zmeny.cilTela } : {}),
      ...(zmeny.teloTukProcento !== undefined ? { telo_tuk_procento: zmeny.teloTukProcento } : {}),
      ...(zmeny.tydennyRozpocetKc !== undefined ? { tydenny_rozpocet_kc: zmeny.tydennyRozpocetKc } : {}),
      ...(zmeny.pocetJidelDenne !== undefined ? { pocet_jidel_denne: zmeny.pocetJidelDenne } : {}),
      ...(zmeny.dieta !== undefined ? { dieta: zmeny.dieta } : {}),
      ...(zmeny.alergie !== undefined ? { alergie: zmeny.alergie } : {}),
      upraveno: new Date().toISOString(),
    })
    .eq("id", uzivatel.user.id);
  if (error) throw new Error(`Profil se neuložil: ${error.message}`);
}

/** Načte aktivní sadu cílů (kalorie + makra). */
export async function nactiAktivniCile(): Promise<Cile | null> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("nutrition_goals")
    .select("kalorie, bilkoviny, sacharidy, tuky")
    .eq("aktivni", true)
    .maybeSingle();
  if (error) throw new Error(`Cíle se nenačetly: ${error.message}`);
  if (!data) return null;
  return {
    kalorie: data.kalorie,
    bilkoviny: data.bilkoviny,
    sacharidy: data.sacharidy,
    tuky: data.tuky,
  };
}

/**
 * Uloží novou aktivní sadu cílů. Staré aktivní se deaktivují,
 * jen jedna sada je aktivní (částečný unikátní index).
 */
export async function ulozCile(c: Cile, zdroj: "auto" | "manual"): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  // atomická RPC (migrace 0008) – deaktivace + vložení v transakci
  const { error: errRpc } = await klient.rpc("uloz_cile", {
    p_kalorie: Math.round(c.kalorie),
    p_bilkoviny: Math.round(c.bilkoviny),
    p_sacharidy: Math.round(c.sacharidy),
    p_tuky: Math.round(c.tuky),
    p_zdroj: zdroj,
  });
  if (!errRpc) return;
  if (!rpcChybi(errRpc)) throw new Error(`Cíle se neuložily: ${errRpc.message}`);
  // funkce není nasazená → kompenzovaný PostgREST zápis

  // snapshot aktivních řádků pro případné vrácení zpět
  const { data: aktivniPred } = await klient
    .from("nutrition_goals")
    .select("id")
    .eq("aktivni", true);

  // deaktivace starých (RLS omezí na vlastní)
  const { error: errDeakt } = await klient
    .from("nutrition_goals")
    .update({ aktivni: false })
    .eq("aktivni", true);
  if (errDeakt) throw new Error(`Cíle se neuložily: ${errDeakt.message}`);

  const { error } = await klient.from("nutrition_goals").insert({
    user_id: uzivatel.user.id,
    kalorie: Math.round(c.kalorie),
    bilkoviny: Math.round(c.bilkoviny),
    sacharidy: Math.round(c.sacharidy),
    tuky: Math.round(c.tuky),
    zdroj,
    aktivni: true,
  });
  if (error) {
    // obnovit předchozí aktivní sadu, ať uživatel nezůstane bez cílů
    const ids = (aktivniPred ?? []).map((r) => r.id as string);
    if (ids.length > 0) {
      await klient.from("nutrition_goals").update({ aktivni: true }).in("id", ids);
    }
    throw new Error(`Cíle se neuložily: ${error.message}`);
  }
}
