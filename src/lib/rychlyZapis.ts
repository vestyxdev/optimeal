import { bezDiakritiky, skoreShody } from "@/lib/vyhledavani";

/**
 * Rychlý zápis do deníku – deterministický parser českého
 * přirozeného zápisu „200g kuřecí prsa, 100 g rýže, 2 vejce".
 * Žádné LLM – gramáže odvozené z jednotkové tabulky a kusových
 * odhadů běžných potravin jsou vždy označené `odhad: true`.
 */

export interface RychlaPolozka {
  /** původní klauzule (pro zobrazení / případný swap) */
  vstup: string;
  /** fráze potraviny pro vyhledání v katalogu */
  dotaz: string;
  /** převedené množství v gramech; null = nerozpoznáno (UI nabídne 100 g / balení) */
  gramy: number | null;
  /** rozpoznaná jednotka („ks", „lžíce", „balení"…); null = gramy/ml přímo */
  jednotka: string | null;
  /** gramáž z kusového převodu nebo odměrky – orientační, označit v UI */
  odhad: boolean;
}

/** Hmotnostní/objemové jednotky → faktor na gramy (ml ≈ g, hustota ~1). */
const JEDNOTKY: Record<string, number> = {
  g: 1, gram: 1, gramy: 1, gramu: 1,
  kg: 1000, kilo: 1000, kilogram: 1000,
  dkg: 10, dekagram: 10,
  ml: 1, mililitr: 1,
  l: 1000, litr: 1000, litru: 1000,
  dl: 100, dcl: 100,
  cl: 10,
};

/** Domácí odměrky → průměrná gramáž (orientační, vždy odhad). */
const ODMERKY: Record<string, number> = {
  lzice: 15, lzic: 15, // lžíce
  lzicka: 5, lzicek: 5, // lžička
  hrnek: 250, hrnku: 250, hrnky: 250, hrnicek: 250,
  sklenice: 250, sklenicky: 250, salek: 250, salku: 250,
  kelimek: 150, kelimku: 150,
  platek: 25, platku: 25, platky: 25,
  hrst: 30, hrsti: 30,
  spetka: 1, spetky: 1,
  strouzek: 3, strouzku: 3, strouzky: 3,
};

/**
 * Typická váha 1 ks běžných potravin – pro „2 vejce", „rohlík".
 * Konzervativní průměry české kuchyně; vždy označeno jako odhad.
 */
const KS_GRAMY: [string, number][] = [
  ["vejce", 55], ["vejec", 55],
  ["rohlik", 45], ["houska", 50], ["housky", 50],
  ["banan", 120], ["bananu", 120], ["banany", 120],
  ["jablko", 180], ["jablka", 180],
  ["pomeranc", 150],
  ["kiwi", 75],
  ["brambora", 90], ["brambory", 90],
  ["mrkev", 80],
  ["citron", 60], ["citronu", 60],
  ["cibule", 70],
  ["rajce", 120], ["rajcata", 120],
  ["paprika", 150],
  ["okurka", 200],
  ["parek", 50], ["parky", 50],
  ["toast", 30],
  ["avokado", 150],
];

const KS_VYCHOZI = 60;

/** Tvar jednotky v textu → kanonický základ („plátky" → „platek"). */
const NORM_ODMERKA: Record<string, string> = {
  lzice: "lzice", lzic: "lzice",
  lzicka: "lzicka", lzicek: "lzicka",
  hrnek: "hrnek", hrnku: "hrnek", hrnky: "hrnek", hrnicek: "hrnek",
  sklenice: "sklenice", sklenicky: "sklenice",
  salek: "salek", salku: "salek",
  kelimek: "kelimek", kelimku: "kelimek",
  platek: "platek", platku: "platek", platky: "platek",
  hrst: "hrst", hrsti: "hrst",
  spetka: "spetka", spetky: "spetka",
  strouzek: "strouzek", strouzku: "strouzek", strouzky: "strouzek",
};

// jednotky jako alternace pro regex – delší před kratšími („lžička" před „lžíce")
const RE_JEDNOTKY =
  "kilogram|kilo|kg|dekagram|dkg|gramy|gramu|gram|g|mililitr|ml|litru|litr|dl|dcl|cl|l|" +
  "kus|ks|x|lzicka|lzice|lzic|hrnicek|hrnek|hrnky|hrnku|sklenice|sklenicky|salek|salku|" +
  "kelimek|kelimku|platek|platku|platky|hrst|hrsti|spetka|spetky|strouzek|strouzku|strouzky|" +
  "balicek|baleni|balicky";

const RE_MNOZSTVI = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:\\s*\\u00d7\\s*|\\s*x\\s*)?(${RE_JEDNOTKY})\\b`, "i");
const RE_POCET = /^(\d+(?:[.,]\d+)?)\s*(?:[x\u00d7]\s*)?/i;
const RE_ODMERKA_NA_ZACATKU = new RegExp(`^(${RE_JEDNOTKY})\\s+`, "i");

/**
 * Odhad gramáže 1 ks podle fráze potraviny – první známý výskyt
 * v KS_GRAMY („kuřecí vejce" → vejce 55 g).
 */
function ksGramy(fraze: string): number {
  const norm = bezDiakritiky(fraze);
  for (const [klic, g] of KS_GRAMY) {
    if (norm.includes(klic)) return g;
  }
  return KS_VYCHOZI;
}

/** Rozparsuje jednu klauzuli („200g kuřecí prsa") na položku. */
function parsujKlauzuli(surova: string): RychlaPolozka | null {
  const vstup = surova.trim();
  if (vstup === "") return null;
  const norm = bezDiakritiky(vstup);

  let gramy: number | null = null;
  let jednotka: string | null = null;
  let odhad = false;
  let fraze = norm;

  const m = norm.match(RE_MNOZSTVI);
  if (m !== null && m[1] !== undefined && m[2] !== undefined) {
    const pocet = parseFloat(m[1].replace(",", "."));
    const j = m[2].toLowerCase();
    const faktor = JEDNOTKY[j];
    const odmerka = ODMERKY[j];
    fraze = (norm.slice(0, m.index) + " " + norm.slice((m.index ?? 0) + m[0].length)).trim();
    if (faktor !== undefined) {
      gramy = Math.round(pocet * faktor);
    } else if (odmerka !== undefined) {
      gramy = Math.round(pocet * odmerka);
      jednotka = NORM_ODMERKA[j] ?? j;
      odhad = true;
    } else if (j === "ks" || j === "kus" || j === "x") {
      gramy = Math.round(pocet * ksGramy(fraze));
      jednotka = "ks";
      odhad = true;
    } else {
      // balení/balíček – gramáž se dohodí z baleniG potraviny
      jednotka = "baleni";
    }
  } else {
    // „lžíce oleje", „plátek sýra" – odměrka na začátku bez čísla
    const o = norm.match(RE_ODMERKA_NA_ZACATKU);
    if (o !== null && o[1] !== undefined) {
      const j = o[1].toLowerCase();
      const odmerka = ODMERKY[j];
      fraze = norm.slice(o[0].length).trim();
      if (odmerka !== undefined) {
        gramy = odmerka;
        jednotka = NORM_ODMERKA[j] ?? j;
        odhad = true;
      } else if (j === "ks" || j === "kus" || j === "x") {
        gramy = ksGramy(fraze);
        jednotka = "ks";
        odhad = true;
      } else if (j === "balicek" || j === "baleni" || j === "balicky") {
        jednotka = "baleni";
      }
    } else {
      // „2 vejce" – holý počet na začátku = kusy
      const p = norm.match(RE_POCET);
      if (p !== null && p[1] !== undefined && /[a-z]/i.test(norm.slice(p[0].length))) {
        const pocet = parseFloat(p[1].replace(",", "."));
        fraze = norm.slice(p[0].length).trim();
        gramy = Math.round(pocet * ksGramy(fraze));
        jednotka = "ks";
        odhad = true;
      } else {
        // samotná fráze („vejce") – kusová potravina → 1 ks odhad
        const kg = ksGramy(fraze);
        if (kg !== KS_VYCHOZI) {
          gramy = kg;
          jednotka = "ks";
          odhad = true;
        }
      }
    }
  }

  fraze = fraze.replace(/\s+/g, " ").trim();
  if (fraze === "") return null;
  return { vstup, dotaz: fraze, gramy, jednotka, odhad };
}

/**
 * Hlavní parser – rozdělí vstup na klauzule (čárka, +, středník,
 * „ a ", „ i ") a z každé vytěží množství + frázi potraviny.
 */
export function parsujRychlyZapis(vstup: string): RychlaPolozka[] {
  return vstup
    // desetinná čárka „0,5" – znormalizovat na tečku JEŠTĚ před
    // dělením klauzulí, jinak by se věta roztrhla v čísle
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/[,;+&]|\s+(?:a|i)\s+/iu)
    .map(parsujKlauzuli)
    .filter((p): p is RychlaPolozka => p !== null);
}

/**
 * Najde nejlepší shodu fráze v katalogu – diakritika-insenzitivní,
 * stejné relevance skóre jako picker katalogu.
 * Vrátí null, když žádný název frázi neobsahuje (skóre 0).
 */
export function najdiPotravinu<T extends { nazev: string }>(
  katalog: T[],
  dotaz: string,
): T | null {
  const dotazNorm = bezDiakritiky(dotaz).trim();
  if (dotazNorm === "") return null;
  let nejlepsi: T | null = null;
  let nejSkore = 0;
  for (const p of katalog) {
    const s = skoreShody(bezDiakritiky(p.nazev), dotazNorm);
    if (s > nejSkore) {
      nejSkore = s;
      nejlepsi = p;
    }
  }
  return nejlepsi;
}
