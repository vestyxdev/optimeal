/**
 * Nákupní balení – jediný zdroj pravdy pro „co se skutečně koupí".
 *
 * Recept nařizuje gramy (20 g oleje), v obchodě se ale kupují
 * celá balení a kusy. Tato knihovna převádí potřebné gramy na
 * reálnou koupi:
 *
 *   1. kusové potraviny (rohlík, houska, vejce…) → celé kusy
 *      (váha kusu z DB baleni_g, jinak typická česká hodnota)
 *   2. skutečná gramáž balení z katalogu (foods/obs baleni_g)
 *      → počet balení = ceil(potřeba / baleniG)
 *   3. fallback typické české prodejní velikosti podle názvu
 *      (olej 1 l, mouka 1 kg, těstoviny 500 g…)
 *   4. vážené zboží bez balení → čisté kroky po 50 g
 *
 * Cena se vždy počítá za CELÁ balení (cena/100 g × nakoupená
 * gramáž) – součty nákupu odpovídají pokladnímu účtu.
 */

export interface NakupniBaleni {
  /** "ks" kusy | "baleni" balení | "vazene" vážené zboží */
  druh: "ks" | "baleni" | "vazene";
  /** počet kusů (druh ks) nebo balení (druh baleni) */
  pocet: number;
  /** gramáž/ml jednoho kusu či balení (null u váženého) */
  velikost: number | null;
  /** "g" | "ml" | "ks" */
  jednotka: "g" | "ml" | "ks";
  /** krátký popisek pro UI: "4 ks" · "1× 1 l" · "2× 500 g" · "450 g" */
  popisek: string;
  /** potřebné množství z receptů (g) – sekundární poznámka */
  potrebaG: number;
  /** celkové nakoupené množství (g/ml, u kusů ks×váha) */
  nakoupeno: number;
  /** cena celého nákupu v Kč – null bez známé ceny */
  cenaCelkem: number | null;
  /** úspora proti běžné ceně za nakoupené množství (Kč) */
  usetreno: number;
  /** nakoupeno převyšuje potřebu – zbyde na později */
  zbytek: boolean;
}

interface Vstup {
  nazev: string;
  gramy: number;
  /** gramáž balení z DB (foods.baleni_g / obs.baleni_g); null = vážené */
  baleniG?: number | null | undefined;
  /** cena Kč / 100 g (u ml položek Kč / 100 ml – stejná konvence) */
  cenaZa100g?: number | null;
  /** běžná cena Kč / 100 g (před slevou) – pro úsporu */
  cenaBeznaZa100g?: number | null;
}

/** Typické váhy kusů v českém obchodě (g). */
const KS_VAHY: [RegExp, number][] = [
  [/rohl[íi]k/i, 43],
  [/housk/i, 55],
  [/kaiserk/i, 50],
  [/rožek|rozek/i, 45],
  [/dalam[aá]nek/i, 45],
  [/vejce|vejci/i, 60],
];

/** Typické velikosti českého retail balení podle názvu. */
const BALENI_TYPICKE: [RegExp, number, "g" | "ml"][] = [
  [/olivov[éeý].*olej|olej.*olivov/i, 500, "ml"],
  [/olej/i, 1000, "ml"],
  [/ocet/i, 500, "ml"],
  [/mouk/i, 1000, "g"],
  [/cukr/i, 1000, "g"],
  [/r[ýy]ž/i, 1000, "g"],
  [/s[ůu]l\b/i, 1000, "g"],
  [/t[ěe]stovin|spaget|penne|fusilli|nudl|tarho[ňn]|lasagne|kol[íi]nk|vlo[čc]k/i, 500, "g"],
  [/pohank|bulgur|kuskus|quino|tarho[ňn]|jahel|ovsen/i, 500, "g"],
  [/o[řr]ech|mandle|vla[šs]|kesu|para|sezam|chia|ln[ěe]n|sem[íi]n|slune[čc]nic|d[ýy][ňn]ov/i, 200, "g"],
  [/ko[řr]en[íi]|kari\b|major[áa]nk|bazalk|rozmar[ýy]n|tymi[áa]n|sko[řr]ic/i, 30, "g"],
  [/dro[žz]d[íi]/i, 42, "g"],
  [/kyp[řr]ic|pr[áa][šs]ek do pe[čc]iva/i, 15, "g"],
  [/ml[ée]ko/i, 1000, "ml"],
  [/smetan/i, 250, "ml"],
  [/m[áa]slo/i, 250, "g"],
  [/jogurt/i, 180, "g"],
  [/tvaroh/i, 250, "g"],
  [/med\b/i, 500, "g"],
  [/d[žz]em|marmel[áa]d/i, 220, "g"],
  [/tu[ňn][aá]k/i, 160, "g"],
  [/passata|loupan[ée] raj[čc]ata|raj[čc]ata konzerva|konzervovan[ée] raj[čc]/i, 400, "g"],
  [/fazol|cizrn|[čc]o[čc]k/i, 400, "g"],
  [/toast/i, 500, "g"],
  [/chl[ée]b|chleba/i, 1000, "g"],
];

/** Rozumná gramáž balení z DB – filtrujeme artefakty (<5 g, >30 kg). */
function platneBaleni(g: number | null | undefined): number | null {
  return g != null && Number.isFinite(g) && g >= 5 && g <= 30000 ? g : null;
}

/** Hezký formát množství: 500→"500 g", 1000→"1 kg", 1500→"1,5 kg". */
export function formatujMnozstvi(n: number, jednotka: "g" | "ml"): string {
  const zaokrouhli = (x: number) =>
    x.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
  if (jednotka === "ml") {
    return n >= 1000 ? `${zaokrouhli(n / 1000)} l` : `${zaokrouhli(n)} ml`;
  }
  return n >= 1000 ? `${zaokrouhli(n / 1000)} kg` : `${zaokrouhli(n)} g`;
}

/**
 * Převede potřebné gramy na reálnou koupi (kusy/balení/vážené)
 * včetně popisku a ceny za celá balení.
 */
export function spocitejNakupniBaleni(v: Vstup): NakupniBaleni {
  const potreba = Math.max(0, v.gramy);
  const baleniDB = platneBaleni(v.baleniG);
  const cena = v.cenaZa100g != null && v.cenaZa100g > 0 ? v.cenaZa100g : null;
  const bezna =
    v.cenaBeznaZa100g != null && v.cenaBeznaZa100g > 0 && cena !== null
      ? Math.max(v.cenaBeznaZa100g, cena)
      : null;
  const cenaZa = (mnozstvi: number) =>
    cena === null ? null : Math.round(((mnozstvi * cena) / 100) * 100) / 100;
  const usporaZa = (mnozstvi: number) =>
    bezna !== null && cena !== null && bezna > cena
      ? Math.round((((bezna - cena) * mnozstvi) / 100) * 100) / 100
      : 0;
  const vysledek = (
    zaklad: Omit<NakupniBaleni, "usetreno" | "zbytek">,
  ): NakupniBaleni => ({
    ...zaklad,
    usetreno: usporaZa(zaklad.nakoupeno),
    zbytek: zaklad.nakoupeno > potreba + 1,
  });

  // 1) kusové potraviny – váha kusu z DB, jinak typická česká
  for (const [re, typickaVaha] of KS_VAHY) {
    if (!re.test(v.nazev)) continue;
    // DB baleni_g kusovky bývá váha kusu (~40–150 g); jiné použij jen když sedí
    const kusG = baleniDB !== null && baleniDB <= 200 ? baleniDB : typickaVaha;
    // potreba 0 → 0 ks (nulová potřeba nesmí zaplatit celé balení)
    const ks = potreba === 0 ? 0 : Math.max(1, Math.ceil(potreba / kusG));
    return vysledek({
      druh: "ks",
      pocet: ks,
      velikost: kusG,
      jednotka: "ks",
      popisek: `${ks} ks`,
      potrebaG: potreba,
      nakoupeno: ks * kusG,
      cenaCelkem: cenaZa(ks * kusG),
    });
  }

  // 2) skutečná gramáž balení z DB
  if (baleniDB !== null) {
    const pocet = potreba === 0 ? 0 : Math.max(1, Math.ceil(potreba / baleniDB));
    return vysledek({
      druh: "baleni",
      pocet,
      velikost: baleniDB,
      jednotka: "g",
      popisek: `${pocet}× ${formatujMnozstvi(baleniDB, "g")}`,
      potrebaG: potreba,
      nakoupeno: pocet * baleniDB,
      cenaCelkem: cenaZa(pocet * baleniDB),
    });
  }

  // 3) typická retail balení podle názvu
  for (const [re, velikost, jednotka] of BALENI_TYPICKE) {
    if (!re.test(v.nazev)) continue;
    const pocet = potreba === 0 ? 0 : Math.max(1, Math.ceil(potreba / velikost));
    return vysledek({
      druh: "baleni",
      pocet,
      velikost,
      jednotka,
      popisek: `${pocet}× ${formatujMnozstvi(velikost, jednotka)}`,
      potrebaG: potreba,
      nakoupeno: pocet * velikost,
      cenaCelkem: cenaZa(pocet * velikost),
    });
  }

  // 4) vážené zboží – čisté kroky po 50 g
  const koupeno = potreba === 0 ? 0 : Math.max(50, Math.ceil(potreba / 50) * 50);
  return vysledek({
    druh: "vazene",
    pocet: 1,
    velikost: null,
    jednotka: "g",
    popisek: formatujMnozstvi(koupeno, "g"),
    potrebaG: potreba,
    nakoupeno: koupeno,
    cenaCelkem: cenaZa(koupeno),
  });
}
