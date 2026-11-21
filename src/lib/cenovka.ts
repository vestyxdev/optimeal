import type { CenaObchodu } from "@/lib/data/nakup";
import { spocitejNakupniBaleni } from "@/lib/nakupniBaleni";

/** Součet nákupního seznamu v jednom obchodě (Cenovka). */
export interface HladinaObchodu {
  obchodId: string;
  obchod: string;
  pokryti: number;
  celkem: number;
  /** kolik zákazník v tomto obchodě ušetří ověřenými slevami */
  usetreno: number;
  neznamych: number;
}

/**
 * Porovná celkovou cenu seznamu ve všech dostupných obchodech.
 *
 * „Vše" koupené v jednom obchodě: každý obchod ocení položky,
 * které u něj známe; neznámé jdou „bez ceny" a zvýší počet
 * neznamych. Cena = CELÁ BALENÍ (spocitejNakupniBaleni) – obchod
 * s levnějším litrovým olejem porazí i ten s nižší cenou/100 ml.
 */
export function porovnejObchody(
  polozky: { foodId?: string | null; gramy: number; nazev: string; baleniG?: number | null }[],
  ceny: Map<string, CenaObchodu[]>,
): HladinaObchodu[] {
  const mapa = new Map<string, HladinaObchodu>();

  for (const p of polozky) {
    if (!p.foodId) continue; // ruční položky nelze ocenit
    const nabidka = ceny.get(p.foodId) ?? [];
    for (const c of nabidka) {
      const h = mapa.get(c.obchodId) ?? {
        obchodId: c.obchodId,
        obchod: c.obchod,
        pokryti: 0,
        celkem: 0,
        usetreno: 0,
        neznamych: 0,
      };
      const nakup = spocitejNakupniBaleni({
        nazev: p.nazev,
        gramy: p.gramy,
        baleniG: c.baleniG ?? p.baleniG ?? null,
        cenaZa100g: c.cena,
        cenaBeznaZa100g: c.puvodniCena ?? null,
      });
      h.celkem += nakup.cenaCelkem ?? 0;
      h.usetreno += nakup.usetreno;
      h.pokryti++;
      mapa.set(c.obchodId, h);
    }
  }

  // neznámých počítáme jen z ocenitelných položek (ruční bez foodId
  // nemůže mít cenu nikde – nepatří do statistiky pokrytí)
  const ocenitelnych = polozky.filter((p) => p.foodId).length;
  for (const h of mapa.values()) {
    h.neznamych = ocenitelnych - h.pokryti;
    h.celkem = Math.round(h.celkem * 100) / 100;
    h.usetreno = Math.round(h.usetreno * 100) / 100;
  }
  // Pokrytí před cenou: obchod, kde košík jde koupit skoro celý,
  // má přednost před součtem z pár oceněných položek – nižší
  // „celkem" z malého pokrytí není levnější nákup, jen neúplný.
  return [...mapa.values()].sort(
    (a, b) => b.pokryti - a.pokryti || a.celkem - b.celkem,
  );
}

/** Nejlevnější živá nabídka potraviny (nejnižší cena/100 g). */
export function nejlevnejsiObchod(
  nabidka: CenaObchodu[] | undefined,
): CenaObchodu | null {
  if (!nabidka || nabidka.length === 0) return null;
  return nabidka.reduce((min, c) => (c.cena < min.cena ? c : min));
}
