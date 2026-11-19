import {
  type NakupniPolozka,
  type Potravina,
} from "@/lib/generator/generator";
import type { Recept } from "@/lib/data/recepty";

/**
 * Mealprep – vaření na zásobu pro více porcí.
 * Čisté funkce: vybrané recepty × porce → konsolidovaný nákupní
 * seznam (stejné potraviny se sečtou přes recepty), součty výživy
 * a ceny se slevovými úsporami. Ceny jsou vždy živé z aktualni_ceny.
 */

export interface MealprepVstup {
  receptId: string;
  /** kolik porcí daného receptu připravujeme */
  porce: number;
}

export interface MealprepDetailReceptu {
  receptId: string;
  nazev: string;
  porce: number;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  cena: number;
}

export interface MealprepVysledek {
  /** konsolidovaný nákupní seznam – stejné potraviny sečtené přes recepty */
  polozky: NakupniPolozka[];
  /** součty za celý mealprep (všechny porce) */
  soucty: {
    kalorie: number;
    bilkoviny: number;
    sacharidy: number;
    tuky: number;
    cena: number;
    cenaBezna: number;
  };
  /** celkový počet připravovaných porcí */
  porceCelkem: number;
  /** rozpad podle receptů */
  detaily: MealprepDetailReceptu[];
  /** recepty, které chybí v nabídce (nemají cenu / suroviny) */
  chybejiciCeny: string[];
}

/**
 * Sestaví mealprep. Recepty bez porce (0) nebo bez dat se tiše
 * přeskočí – stránka ošetří prázdný výsledek.
 */
export function sestavMealprep(
  vstupy: MealprepVstup[],
  recepty: Recept[],
  potraviny: Potravina[] | null,
): MealprepVysledek {
  const mapaReceptu = new Map(recepty.map((r) => [r.id, r]));
  const mapaPotravin = new Map((potraviny ?? []).map((p) => [p.id, p]));

  // konsolidace nákupu: food_id → akumulátor
  const nakup = new Map<string, NakupniPolozka>();
  const detaily: MealprepDetailReceptu[] = [];
  const chybejiciCeny = new Set<string>();

  let porceCelkem = 0;
  const soucty = { kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0, cenaBezna: 0 };

  for (const vstup of vstupy) {
    const porce = Math.round(vstup.porce);
    if (porce <= 0) continue;
    const recept = mapaReceptu.get(vstup.receptId);
    if (!recept) continue;

    porceCelkem += porce;
    let kalorie = 0;
    let bilkoviny = 0;
    let sacharidy = 0;
    let tuky = 0;
    let cena = 0;
    let cenaBezna = 0;

    for (const s of recept.suroviny) {
      const p = mapaPotravin.get(s.foodId);
      if (!p) continue; // surovina mimo katalog

      const gramy = s.gramyNaPorce * porce;
      const koef = gramy / 100;
      kalorie += p.kalorie * koef;
      bilkoviny += p.bilkoviny * koef;
      sacharidy += p.sacharidy * koef;
      tuky += p.tuky * koef;

      if (p.aktualniCena > 0) {
        cena += (p.aktualniCena * gramy) / 100;
        // úspora jen ze zdrojem ověřené původní ceny – nikdy z mediánu
        cenaBezna += ((p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena
          ? p.puvodniCena
          : p.aktualniCena) * gramy) / 100;
      } else {
        chybejiciCeny.add(p.nazev);
      }

      // nákupní položka – sečte se přes recepty; potravina bez ceny
      // jde na seznam taky (cenaZa100g null → „—"), jinak by se
      // v uloženém seznamu tiše ztratila
      const existujici = nakup.get(p.id);
      if (existujici) {
        existujici.gramy += gramy;
      } else {
        nakup.set(p.id, {
          id: p.id,
          nazev: p.nazev,
          gramy,
          cenaZa100g: p.aktualniCena > 0 ? p.aktualniCena : null,
          cenaBeznaZa100g: p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena
            ? p.puvodniCena
            : (p.aktualniCena > 0 ? p.aktualniCena : null),
          obchod: p.aktualniCena > 0 ? p.obchod : null,
          sleva: p.aktualniCena > 0 && p.sleva,
          obrazek: p.obrazek ?? null,
          cenaCelkem: 0,
          usetreno: 0,
        });
      }
    }

    detaily.push({
      receptId: recept.id,
      nazev: recept.nazev,
      porce,
      kalorie: Math.round(kalorie),
      bilkoviny: Math.round(bilkoviny * 10) / 10,
      sacharidy: Math.round(sacharidy * 10) / 10,
      tuky: Math.round(tuky * 10) / 10,
      cena: Math.round(cena * 100) / 100,
    });

    soucty.kalorie += kalorie;
    soucty.bilkoviny += bilkoviny;
    soucty.sacharidy += sacharidy;
    soucty.tuky += tuky;
    soucty.cena += cena;
    soucty.cenaBezna += cenaBezna;
  }

  // ceny položek a úspory z konečných gramáží
  const polozky = [...nakup.values()].map((p) => {
    p.cenaCelkem = Math.round(((p.gramy * (p.cenaZa100g ?? 0)) / 100) * 100) / 100;
    p.usetreno =
      p.cenaBeznaZa100g !== null && p.cenaZa100g !== null
        ? Math.max(
            0,
            Math.round(((p.gramy * (p.cenaBeznaZa100g - p.cenaZa100g)) / 100) * 100) / 100,
          )
        : 0;
    return p;
  });
  polozky.sort((a, b) => b.cenaCelkem - a.cenaCelkem);

  return {
    polozky,
    soucty: {
      kalorie: Math.round(soucty.kalorie),
      bilkoviny: Math.round(soucty.bilkoviny * 10) / 10,
      sacharidy: Math.round(soucty.sacharidy * 10) / 10,
      tuky: Math.round(soucty.tuky * 10) / 10,
      cena: Math.round(soucty.cena * 100) / 100,
      cenaBezna: Math.round(soucty.cenaBezna * 100) / 100,
    },
    porceCelkem,
    detaily,
    chybejiciCeny: [...chybejiciCeny].sort(),
  };
}
