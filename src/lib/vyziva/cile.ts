/**
 * Výpočet denních výživových cílů (port z PHP verze, 100% přesná bilance)
 * ---------------------------------------------------------------
 * BMR dvěma vzorci:
 *  - Mifflin-St Jeor (1990), když neznáme % tělesného tuku:
 *      muž:  10·kg + 6,25·cm − 5·rok + 5
 *      žena: 10·kg + 6,25·cm − 5·rok − 161
 *  - Katch-McArdle, když údaj o tělesném tuku máme (přesnější,
 *    pracuje s čistou tělesnou hmotou):
 *      BMR = 370 + 21,6·(kg · (1 − tuk %/100))
 * Denní příjem = BMR × faktor aktivity × korekce cíle.
 * Makra 30 % bílkoviny / 40 % sacharidy / 30 % tuky
 * (bílkoviny a sacharidy 4 kcal/g, tuky 9 kcal/g).
 *
 * ZÁRUKA PŘESNOSTI: vrácené kalorie SE VŽDY ROVNAJÍ
 * 4·bílkoviny + 4·sacharidy + 9·tuky – žádné zaokrouhlovací drifty.
 */

export const AKTIVITA_FAKTORY = {
  sedava: 1.2, // práce vsedě, málo pohybu
  mirna: 1.375, // lehký pohyb 1–3× týdně
  aktivni: 1.55, // pohyb 3–5× týdně
  velmi: 1.725, // trénink téměř denně
} as const;

export const CILE_KOREKCE = {
  zhubnout: 0.85, // deficit ~15 %
  udrzet: 1.0, // rovnováha
  zhodnotit: 1.1, // přebytek ~10 %
} as const;

export type Aktivita = keyof typeof AKTIVITA_FAKTORY;
export type CilTela = keyof typeof CILE_KOREKCE;
export type Pohlavi = "m" | "z";

export interface Cile {
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
}

export interface VstupyCile {
  vahaKg: number;
  vyskaCm: number;
  vekRoku: number;
  pohlavi: Pohlavi;
  aktivita: Aktivita;
  cilTela: CilTela;
  /** volitelný údaj o tělesném tuku v % (3–60) – přepne na Katch-McArdle */
  teloTukProcento?: number | null;
}

/** Ověří makra na běžné meze (ochrana před smysluprázdnými vstupy). */
export function platnaMakra(c: Cile): boolean {
  return (
    c.kalorie >= 800 &&
    c.kalorie <= 5000 &&
    c.bilkoviny >= 0 &&
    c.bilkoviny <= 400 &&
    c.sacharidy >= 0 &&
    c.sacharidy <= 700 &&
    c.tuky >= 0 &&
    c.tuky <= 250
  );
}

/**
 * Doladí makra (posunem sacharidů a/nebo tuků o ±1 g) tak, aby
 * 4·b + 4·s + 9·t dávalo PŘESNĚ kcalCíl. Hledáme minimální zásah
 * do gramáží – poměr 30/40/30 zůstává de facto beze změny.
 */
export function doladMakra(kcalCil: number, b: number, s: number, t: number): Cile {
  const rozdil = kcalCil - (4 * b + 4 * s + 9 * t);

  if (rozdil === 0) {
    return { kalorie: kcalCil, bilkoviny: b, sacharidy: s, tuky: t };
  }

  // hledáme 4·aS + 9·aT = rozdil s minimálním počtem posunutých gramů
  let nejlepsi: { bilkoviny: number; sacharidy: number; tuky: number } | null = null;
  let nejlepsiCena = Number.POSITIVE_INFINITY;

  for (let aS = -8; aS <= 8; aS++) {
    for (let aT = -4; aT <= 4; aT++) {
      if (4 * aS + 9 * aT !== rozdil) continue;
      const cena = Math.abs(aS) + Math.abs(aT);
      if (cena < nejlepsiCena) {
        nejlepsiCena = cena;
        nejlepsi = { bilkoviny: b, sacharidy: s + aS, tuky: t + aT };
      }
    }
  }

  if (nejlepsi === null) {
    // rozdíl nedosažitelný posuny ±1 g – kalorie dám přesně podle makra
    const kcalPresne = 4 * b + 4 * s + 9 * t;
    return { kalorie: kcalPresne, bilkoviny: b, sacharidy: s, tuky: t };
  }

  return { kalorie: kcalCil, ...nejlepsi };
}

/**
 * Spočítá denní cíle ze vstupů uživatele.
 */
export function spocitejCile(v: VstupyCile): Cile {
  let bmr: number;
  if (v.teloTukProcento != null && v.teloTukProcento >= 3 && v.teloTukProcento <= 60) {
    // Katch-McArdle – čistá tělesná hmota (bez tuku)
    const bezTuku = v.vahaKg * (1 - v.teloTukProcento / 100);
    bmr = 370 + 21.6 * bezTuku;
  } else {
    // Mifflin-St Jeor – klasika z dostupných údajů
    bmr =
      10 * v.vahaKg + 6.25 * v.vyskaCm - 5 * v.vekRoku + (v.pohlavi === "m" ? 5 : -161);
  }

  const kcalVypocet =
    bmr * AKTIVITA_FAKTORY[v.aktivita] * CILE_KOREKCE[v.cilTela];

  const b = Math.round((kcalVypocet * 0.3) / 4);
  const s = Math.round((kcalVypocet * 0.4) / 4);
  const t = Math.round((kcalVypocet * 0.3) / 9);

  // hezký cíl na celé desítky kcal…
  const kcalCil = Math.round(kcalVypocet / 10) * 10;

  // …a doladění makra tak, aby součet dával PŘESNĚ kcalCíl
  return doladMakra(kcalCil, b, s, t);
}
