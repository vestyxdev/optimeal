/**
 * Český plurál: 1 → forma1, 2–4 → forma24, 0 a 5+ → forma5.
 * sklonuj(3, "položka", "položky", "položek") → "položky"
 */
export function sklonuj(n: number, forma1: string, forma24: string, forma5: string): string {
  if (n === 1) return forma1;
  if (n >= 2 && n <= 4) return forma24;
  return forma5;
}
