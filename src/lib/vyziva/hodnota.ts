/**
 * Poměr výživy k ceně – „value" metriky pro Cenovku.
 * Všechny výpočty z reálných aktuálních cen (Kč/100 g) a výživy na
 * 100 g. Nikdy nevrací Infinity/NaN – neplatný vstup → null.
 */

/**
 * Gramy bílkovin za 100 Kč – fitness/meatprep metrika.
 * Oleje a cukr (0 g bílkovin) vrací 0 – je to fakt, ne chyba.
 * Bez ceny → null (metrika nejde spočítat).
 */
export function gramyBilkovinNa100Kc(
  bilkovinyNa100g: number,
  cenaZa100g: number,
): number | null {
  if (!Number.isFinite(cenaZa100g) || cenaZa100g <= 0) return null;
  if (!Number.isFinite(bilkovinyNa100g) || bilkovinyNa100g < 0) return null;
  return Math.round(((bilkovinyNa100g * 100) / cenaZa100g) * 10) / 10;
}

/**
 * Kč za 10 g bílkovin – inverzní pohled (kolik stojí porce proteinu).
 * Nulové bílkoviny → null (dělení nulou, metrika nedává smysl).
 */
export function kcNa10gBilkovin(
  bilkovinyNa100g: number,
  cenaZa100g: number,
): number | null {
  if (!Number.isFinite(cenaZa100g) || cenaZa100g <= 0) return null;
  if (!Number.isFinite(bilkovinyNa100g) || bilkovinyNa100g <= 0) return null;
  return Math.round(((cenaZa100g * 10) / bilkovinyNa100g) * 100) / 100;
}

/**
 * Kč za 1000 kcal – rozpočtová efektivita potraviny.
 * Potraviny bez kalorií (ocet, voda) → null.
 */
export function kcNa1000Kcal(kalorieNa100g: number, cenaZa100g: number): number | null {
  if (!Number.isFinite(cenaZa100g) || cenaZa100g <= 0) return null;
  if (!Number.isFinite(kalorieNa100g) || kalorieNa100g <= 0) return null;
  return Math.round(((cenaZa100g * 1000) / kalorieNa100g) * 10) / 10;
}

/** Odhad kalorií z maker: 4·B + 4·S + 9·T (kcal/100 g). */
export function odhadKaloriiZMaker(
  bilkovinyNa100g: number,
  sacharidyNa100g: number,
  tukyNa100g: number,
): number {
  const z = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  return 4 * z(bilkovinyNa100g) + 4 * z(sacharidyNa100g) + 9 * z(tukyNa100g);
}

/**
 * Kontrola uvedených kalorií proti odhadu z maker. Vrací true, když
 * se uvedená hodnota liší o víc než `tolerance` (výchozí 35 % –
 * vláknina/polyoly/atypické složení vysvětlují menší odchylky).
 * Slouží jako indikátor podezřelých zdrojových dat, ne jako chyba.
 */
export function lisiSeKalorie(
  uvedeneNa100g: number,
  bilkovinyNa100g: number,
  sacharidyNa100g: number,
  tukyNa100g: number,
  tolerance = 0.35,
): boolean {
  if (!Number.isFinite(uvedeneNa100g) || uvedeneNa100g <= 0) return false;
  const odhad = odhadKaloriiZMaker(bilkovinyNa100g, sacharidyNa100g, tukyNa100g);
  if (odhad <= 0) return false;
  return Math.abs(uvedeneNa100g - odhad) / Math.max(uvedeneNa100g, odhad) > tolerance;
}
