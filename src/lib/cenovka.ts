import type { CenaObchodu } from "@/lib/data/nakup";

/**
 * Cenovka – porovnání cen nákupního košíku napříč obchody.
 * Čisté funkce nad živými price_observations (hladiny z
 * nactiCenoveHladiny) – testovatelné bez sítě.
 */

export interface SouhrnObchodu {
  obchodId: string;
  obchod: string;
  /** kolik položek seznamu má u obchodu cenu – úplnost odhadu */
  pokryti: number;
  /** odhad celkové ceny za pokryté položky v Kč */
  celkem: number;
}

/** Nejlevnější nabídka jedné potraviny; null když cenu nemá nikdo. */
export function nejlevnejsiObchod(
  hladiny: CenaObchodu[] | undefined,
): CenaObchodu | null {
  if (!hladiny || hladiny.length === 0) return null;
  return hladiny.reduce((a, b) => (b.cena < a.cena ? b : a));
}

/**
 * Odhad ceny celého seznamu v každém obchodě, který má aspoň
 * jednu položku oceněnou. Celkem počítá jen pokryté položky –
 * `pokryti` říká, na kolika položkách odhad stojí.
 * Řazeno od nejlevnějšího; při shodě vítězí lepší pokrytí.
 */
export function porovnejObchody(
  polozky: { foodId?: string | null; gramy: number }[],
  hladiny: Map<string, CenaObchodu[]>,
): SouhrnObchodu[] {
  const sumy = new Map<string, SouhrnObchodu>();
  for (const p of polozky) {
    if (!p.foodId || p.gramy <= 0) continue;
    const ceny = hladiny.get(p.foodId);
    if (!ceny) continue;
    for (const c of ceny) {
      const s = sumy.get(c.obchodId) ?? {
        obchodId: c.obchodId,
        obchod: c.obchod,
        pokryti: 0,
        celkem: 0,
      };
      s.pokryti += 1;
      s.celkem += (c.cena * p.gramy) / 100;
      sumy.set(c.obchodId, s);
    }
  }
  return [...sumy.values()].sort(
    (a, b) => a.celkem - b.celkem || b.pokryti - a.pokryti,
  );
}
