import type { KatalogPotravina } from "@/lib/data/potraviny";

/** Filtrace katalogu: text hledá v názvu, čistě číselný dotaz i v EAN. */
export function filtrujKatalog(
  potraviny: KatalogPotravina[],
  dotaz: string,
  kategorie: string,
  jenSlevy = false,
): KatalogPotravina[] {
  const dot = dotaz.trim().toLowerCase();
  const jeEan = /^\d{4,14}$/.test(dot.replace(/[\s-]/g, ""));
  const eanDotaz = dot.replace(/[\s-]/g, "");
  const vybrane = potraviny.filter(
    (p) =>
      (kategorie === "vse" || p.kategorie === kategorie) &&
      (!jenSlevy || p.sleva) &&
      (dot === "" ||
        p.nazev.toLowerCase().includes(dot) ||
        (jeEan && p.ean !== null && p.ean.includes(eanDotaz))),
  );
  // u „jen slevy" řadíme podle % slevy – nejvýhodnější nahoře
  if (jenSlevy) {
    vybrane.sort((a, b) => (b.slevaProcenta ?? -1) - (a.slevaProcenta ?? -1));
  }
  return vybrane;
}
