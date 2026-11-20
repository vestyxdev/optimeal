import { doladMakra, type Aktivita, type Cile, type CilTela, type Pohlavi } from "./cile";

/**
 * Vědecký výpočet kalorického plánu (Cal AI styl) – čisté funkce
 * pro průvodce cíli i jeho testy.
 *
 * BMR:  Mifflin-St Jeor (muž +5 / žena −161)
 * TDEE: BMR × faktor aktivity zvolené podle tréninků týdně
 * Tempo: 1 kg hmotnosti ≈ 7 700 kcal → denní korekce = kg/týden × 1100
 * Podlahy: muž 1 500 kcal, žena 1 200 kcal (bezpečnostní minimum)
 * Makra: bílkoviny 1,8–2,2 g/kg cílové váhy (priorita zachování
 *        svalů / růstu), tuky 25 % kcal (min. 0,7 g/kg), sacharidy
 *        zbytek – a doladMakra garantuje 4B+4S+9T ≡ kcal přesně.
 */

export const KCAL_NA_KG = 7700;

/** Bezpečnostní podlahy denního příjmu – pod nimi neodpovídá hubnutí. */
export const PODLAHA_KCAL: Record<Pohlavi, number> = { m: 1500, z: 1200 };

/** Karty „tréninky týdně" – mapování na faktor aktivity. */
export const TRENINKY = [
  { klic: "0-2", titul: "0–2 týdně", popis: "Málo pohybu / sedavé zaměstnání", aktivita: "sedava" as Aktivita },
  { klic: "3-5", titul: "3–5 týdně", popis: "Pravidelný trénink / aktivní", aktivita: "aktivni" as Aktivita },
  { klic: "6+", titul: "6+ týdně", popis: "Intenzivní sportovec / fyzická práce", aktivita: "velmi" as Aktivita },
] as const;
export type TreninkyTydne = (typeof TRENINKY)[number]["klic"];

export const CILE_TELA = [
  { klic: "zhubnout" as CilTela, titul: "Zhubnout", popis: "Kalorický deficit" },
  { klic: "udrzet" as CilTela, titul: "Udržet váhu", popis: "Udržování / rekompozice" },
  { klic: "zhodnotit" as CilTela, titul: "Nabrat svaly", popis: "Kalorický surplus" },
] as const;

/** Rozsah tempa podle cíle – kg/týden [min, max, výchozí]. */
export function rozsahTempa(cil: CilTela): { min: number; max: number; vychozi: number } {
  if (cil === "zhubnout") return { min: 0.2, max: 1.0, vychozi: 0.5 };
  if (cil === "zhodnotit") return { min: 0.1, max: 0.5, vychozi: 0.25 };
  return { min: 0, max: 0, vychozi: 0 }; // udržet – tempo se neřeší
}

/** BMR Mifflin-St Jeor. */
export function spocitejBmr(v: {
  vahaKg: number;
  vyskaCm: number;
  vekRoku: number;
  pohlavi: Pohlavi;
}): number {
  return (
    10 * v.vahaKg + 6.25 * v.vyskaCm - 5 * v.vekRoku + (v.pohlavi === "m" ? 5 : -161)
  );
}

const FAKTORY: Record<Aktivita, number> = {
  sedava: 1.2,
  mirna: 1.375,
  aktivni: 1.55,
  velmi: 1.725,
};

export function aktivitaZTreninku(t: TreninkyTydne): Aktivita {
  return TRENINKY.find((x) => x.klic === t)?.aktivita ?? "sedava";
}

/** TDEE = BMR × faktor aktivity. */
export function spocitejTdee(v: Parameters<typeof spocitejBmr>[0] & {
  aktivita: Aktivita;
}): number {
  return spocitejBmr(v) * FAKTORY[v.aktivita];
}

export interface VstupyPlanu {
  pohlavi: Pohlavi;
  treninky: TreninkyTydne;
  vekRoku: number;
  vyskaCm: number;
  vahaKg: number;
  cilTela: CilTela;
  /** cílová váha – povinná pro zhubnout/zhodnotit */
  cilovaVahaKg?: number;
  /** kg/týden – ignoruje se u „udrzet" */
  tempoKgTydne?: number;
}

export interface Plan {
  cile: Cile;
  bmr: number;
  tdee: number;
  /** denní korekce kcal (záporná u hubnutí) */
  korekceKcal: number;
  /** true, když se musela použít bezpečnostní podlaha */
  pouzitaPodlaha: boolean;
  /** odhadované datum dosažení cílové váhy (null u udržet) */
  terminCile: Date | null;
}

/** Denní korekce kalorií z tempa: kg/týden × 7700 / 7, se znaménkem. */
export function korekceZTempa(tempoKgTydne: number, cil: CilTela): number {
  const denni = (tempoKgTydne * KCAL_NA_KG) / 7;
  return cil === "zhubnout" ? -denni : cil === "zhodnotit" ? denni : 0;
}

/** Odhad data dosažení cílové váhy – null když není co řešit. */
export function odhadTerminu(
  vahaKg: number,
  cilovaVahaKg: number | undefined,
  tempoKgTydne: number | undefined,
  cil: CilTela,
  dnes: Date = new Date(),
): Date | null {
  if (cil === "udrzet" || !cilovaVahaKg || !tempoKgTydne || tempoKgTydne <= 0) {
    return null;
  }
  const delta = Math.abs(vahaKg - cilovaVahaKg);
  if (delta <= 0) return null;
  const tydny = delta / tempoKgTydne;
  return new Date(dnes.getTime() + tydny * 7 * 86400e3);
}

/** g bílkovin na kg cílové váhy podle cíle – deficit šetří svaly nejvíc. */
export function bilkovinyNaKg(cil: CilTela): number {
  return cil === "zhubnout" ? 2.2 : cil === "zhodnotit" ? 1.8 : 2.0;
}

/**
 * Kompletní plán: BMR → TDEE → korekce tempem (+podlaha) → makra.
 * Kalorie vždy přesně odpovídají 4B+4S+9T (doladMakra).
 */
export function spocitejPlan(v: VstupyPlanu): Plan {
  const aktivita = aktivitaZTreninku(v.treninky);
  const bmr = spocitejBmr(v);
  const tdee = bmr * FAKTORY[aktivita];
  const tempo = v.cilTela === "udrzet" ? 0 : (v.tempoKgTydne ?? rozsahTempa(v.cilTela).vychozi);
  const korekce = korekceZTempa(tempo, v.cilTela);

  let kcalCil = Math.round((tdee + korekce) / 10) * 10;
  const podlaha = PODLAHA_KCAL[v.pohlavi];
  const pouzitaPodlaha = kcalCil < podlaha;
  if (pouzitaPodlaha) kcalCil = podlaha;

  // bílkoviny z cílové (nebo aktuální) váhy – prioritní makro
  const vahaProB = v.cilovaVahaKg ?? v.vahaKg;
  const b = Math.round(vahaProB * bilkovinyNaKg(v.cilTela));
  // tuky 25 % kcal, min. 0,7 g/kg aktuální váhy
  const t = Math.max(Math.round((kcalCil * 0.25) / 9), Math.round(v.vahaKg * 0.7));
  // sacharidy doplní zbytek
  const s = Math.max(0, Math.round((kcalCil - 4 * b - 9 * t) / 4));

  return {
    cile: doladMakra(kcalCil, b, s, t),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    korekceKcal: Math.round(korekce),
    pouzitaPodlaha,
    terminCile: odhadTerminu(v.vahaKg, v.cilovaVahaKg, tempo, v.cilTela),
  };
}

/** Přepočet při ruční úpravě v souhrnu – editace gramů přepočítá kcal. */
export function cileZGramu(b: number, s: number, t: number): Cile {
  return { kalorie: 4 * b + 4 * s + 9 * t, bilkoviny: b, sacharidy: s, tuky: t };
}

/** Editace kcal v souhrnu – sacharidy doplní rozdíl, doladMakra
 *  pak srovná poslední gramy tak, aby součet seděl přesně. */
export function cileZKcal(kcal: number, c: Cile): Cile {
  const cil = Math.round(kcal);
  const s = Math.max(0, Math.round((cil - 4 * c.bilkoviny - 9 * c.tuky) / 4));
  return doladMakra(cil, c.bilkoviny, s, c.tuky);
}
