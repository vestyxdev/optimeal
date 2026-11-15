/**
 * Generátor jídelníčku (port z PHP verze OptiMeal)
 * ---------------------------------------------------------------
 * Algoritmus „Chytrý generátor":
 *  1) Potraviny s AKTUÁLNÍMI cenami (sleva, pokud platí, jinak běžná).
 *  2) Denní cíle se rozdělí na jídla podle podílů
 *     (Snídaně 25 %, Oběd 35 %, Svačina 15 %, Večeře 25 %).
 *  3) Každá potravina spadá do kategorie podle DOMINUJÍCÍHO makra
 *     (bílkovinová / sacharidová / tuková).
 *  4) Skóre = kolik „úžitku" (gramů makra) dá potravina za 1 Kč;
 *     slevové potraviny mají bonus 1,25× – generátor automaticky
 *     upřednostní zlevněné potraviny.
 *  5) Gramace se řeší krokem kotva (bílkoviny) → sacharidy → tuky,
 *     každá porce zůstává v kalorickém limitu jídla.
 *  6) Různorodost: filtr použitých ID + rotace mezi cenově
 *     srovnatelnými kandidáty (denní plán 85 %, týdenní 60 %).
 *
 * Všechny funkce jsou ČISTÉ (vstup → výstup) – snadno testovatelné.
 */

/* ============================================================
 * TYPY
 * ============================================================ */

/** Potravina s vyřešenou AKTUÁLNÍ cenou (sleva, pokud platí). */
export interface Potravina {
  id: string;
  nazev: string;
  /** g bílkovin / 100 g */
  bilkoviny: number;
  /** g sacharidů / 100 g */
  sacharidy: number;
  /** g tuků / 100 g */
  tuky: number;
  /** kcal / 100 g */
  kalorie: number;
  /** Kč / 100 g bez slevy */
  beznaCena: number;
  /** Kč / 100 g (akční, pokud existuje, jinak běžná) */
  aktualniCena: number;
  /** název obchodu, pokud je potravina ve slevě */
  obchod: string | null;
  /** je právě ve slevě? */
  sleva: boolean;
  /** původní (přeškrtnutá) cena za 100 g z letáku/seedu – může se lišit od beznaCena */
  puvodniCena?: number | null;
  /** % slevy spočítaná z původní ceny (badge „-30 %“) */
  slevaProcenta?: number | null;
  /** poslední den platnosti akční ceny (ISO) – „sleva do út 18. 11.“ */
  platnostDo?: string | null;
  /** kategorie z katalogu (maso_ryby, mlecne_vyrobky, …) */
  kategorie?: string;
  /** alergeny EU-14 (lepek, mleko, vejce, ryby, arasidy, …) */
  alergeny?: string[];
  /** vhodné pro diety (vegetariansky, vegansky, bezlepkovy) */
  diety?: string[];
  /** URL náhledu z OpenFoodFacts (migrace 0009) */
  obrazek?: string | null;
  /** hmotnost/obsah balení v g (migrace 0012) – pro cenu za balení */
  baleniG?: number | null;
}

/** Profilový filtr jídelníčku – diety a alergie uživatele. */
export interface FiltrPotraviny {
  diety?: string[];
  alergeny?: string[];
}

/**
 * Odfiltruje katalog podle profilu: potravina musí vyhovovat VŠEM
 * dietám a nesmí obsahovat ŽÁDNÝ z uvedených alergenů.
 * Prázdný filtr = celý katalog (běžný jedlík).
 */
export function filtrujPotraviny(
  potraviny: Potravina[],
  filtr?: FiltrPotraviny | null,
): Potravina[] {
  const diety = filtr?.diety ?? [];
  const alergeny = filtr?.alergeny ?? [];
  if (diety.length === 0 && alergeny.length === 0) return potraviny;
  return potraviny.filter(
    (p) =>
      diety.every((d) => (p.diety ?? []).includes(d)) &&
      alergeny.every((a) => !(p.alergeny ?? []).includes(a)),
  );
}

export interface Jidlo {
  id: string;
  nazev: string;
  gramy: number;
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  /** Kč za porci (akční cena) */
  cena: number;
  /** Kč za porci bez slevy – pro výpočet úspory */
  cenaBezna: number;
  obchod: string | null;
  sleva: boolean;
  /** URL náhledu potraviny (z OpenFoodFacts), pokud existuje */
  obrazek?: string | null;
}

export interface SouhrnJidla {
  jidla: Jidlo[];
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  cena: number;
  cenaBezna: number;
}

export interface DenVysledek {
  jidelnicek: Record<string, SouhrnJidla>;
  celkem: SouhrnJidlaBezJidel;
}

export interface SouhrnJidlaBezJidel {
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
  cena: number;
  cenaBezna: number;
}

export interface Cile {
  kalorie: number;
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
}

export interface NakupniPolozka {
  id: string;
  nazev: string;
  gramy: number;
  cenaZa100g: number | null;
  cenaBeznaZa100g: number | null;
  obchod: string | null;
  sleva: boolean;
  obrazek?: string | null;
  cenaCelkem: number;
  usetreno: number;
}

/* ============================================================
 * KONSTANTY
 * ============================================================ */

/** Podíly denních cílů na jednotlivá jídla (výchozí, 4 jídla) */
export const PODILY_JIDEL = {
  Snídaně: 0.25,
  Oběd: 0.35,
  Svačina: 0.15,
  Večeře: 0.25,
} as const;

export type NazevJidla = keyof typeof PODILY_JIDEL;

/**
 * Rozdělení dne na N jídel (2–8) podle profilu uživatele.
 * Podíly vždy sčítají 1,0 a jídla jdou chronologicky.
 */
export function podilyProPocetJidel(pocetJidel: number): Record<string, number> {
  const n = Math.max(2, Math.min(8, Math.round(pocetJidel)));
  switch (n) {
    case 2:
      return { Oběd: 0.55, Večeře: 0.45 };
    case 3:
      return { Snídaně: 0.3, Oběd: 0.4, Večeře: 0.3 };
    case 5:
      return { Snídaně: 0.22, "Dopolední svačina": 0.08, Oběd: 0.3, "Odpolední svačina": 0.12, Večeře: 0.28 };
    case 6:
      return { Snídaně: 0.18, "Dopolední svačina": 0.08, Oběd: 0.27, "Odpolední svačina": 0.1, Večeře: 0.24, "Druhá večeře": 0.13 };
    case 7:
      return { Snídaně: 0.16, "Dopolední svačina": 0.07, Oběd: 0.25, "Odpolední svačina": 0.09, Večeře: 0.22, "Druhá večeře": 0.12, "Před spaním": 0.09 };
    case 8:
      return { Snídaně: 0.15, "Dopolední svačina": 0.07, Oběd: 0.23, "Odpolední svačina": 0.09, Večeře: 0.2, "Druhá večeře": 0.12, "Před spaním": 0.08, "Pozdní svačina": 0.06 };
    default:
      return { ...PODILY_JIDEL };
  }
}

/** Bonus ve skóre pro potraviny, které jsou právě ve slevě */
export const BONUS_SLEVY = 1.25;

type Kategorie = "bilkovinova" | "sacharidova" | "tukova";
type KategorieMap = Record<Kategorie, Kandidat[]>;

/** Potravina s vypočteným skórem (interní, vzniká v pripravKategorie). */
interface Kandidat extends Potravina {
  skore: number;
}

/* ============================================================
 * KATEGORIE A SKÓRE
 * ============================================================ */

/**
 * Kategorie podle DOMINUJÍCÍ makroživiny (podle podílu kcal):
 *   bílkoviny 4 kcal/g, sacharidy 4 kcal/g, tuky 9 kcal/g.
 */
export function kategoriePotraviny(p: Potravina): Kategorie {
  const kcalB = p.bilkoviny * 4;
  const kcalS = p.sacharidy * 4;
  const kcalT = p.tuky * 9;
  const celkem = Math.max(kcalB + kcalS + kcalT, 0.001);

  if (kcalB / celkem >= Math.max(kcalS, kcalT) / celkem) {
    return "bilkovinova";
  }
  return kcalS >= kcalT ? "sacharidova" : "tukova";
}

/** Skóre = gramy dominujícího makra za 1 Kč (sleva má bonus).
 *  Potraviny bez ceny (0 = neceněné, např. import z OFF) používají
 *  medián ceny své kategorie – jinak by 0,01 Kč strop udělal z každé
 *  neceněné potraviny vítěze a plán by se skládal jen z neceněných.
 *  Neceněné navíc dostávají pokutu – plán má preferovat potraviny,
 *  které si uživatel opravdu koupí za zobrazenou cenu. */
export function skorePotraviny(p: Potravina, kategorie: Kategorie, vychoziCena?: number): number {
  const nacenena = p.aktualniCena > 0;
  const cena = nacenena ? p.aktualniCena : Math.max(vychoziCena ?? 15, 0.01);
  const hodnota =
    kategorie === "bilkovinova" ? p.bilkoviny : kategorie === "sacharidova" ? p.sacharidy : p.tuky;

  let skore = hodnota / cena;
  if (p.sleva) skore *= BONUS_SLEVY;
  if (!nacenena) skore *= 0.7;
  return skore;
}

/**
 * „Surovinové" potraviny – olej, cukr, mouka, koření, sůl, droždí…
 * Samy netvoří jídlo (nikdo nesnídaní 33 g krystalu), v tukovém
 * doplněku ale smysl dávají – 20–30 g oleje nebo másla k pokrmu
 * je reálné. Regex běží přes názov: slova jako „olej" nebo „máslo"
 * jen jako samostatná slova (máslový chléb zůstane pečivem).
 */
const PRISADA_RE =
  /\b(olej\b|s[aá]dl|mouk|cukr|sirup|ocet|s[oóůu][lľ]\b|ko[řr]en[íi]|drožd|želatin|kyp[řr]ic|jedl[aá] sod|bobkov|major[aá]n|sko[řr]ic|km[íi]n|pep[řr]\b|buj[oó]n|bu[ďd]on|maggi|m[aá]slo\b|med\b|caro\b)/i;

/** Je potravina kuchyňská surovina, ne samostatná složka jídla? */
export function jePrisada(p: Potravina): boolean {
  return PRISADA_RE.test(p.nazev);
}

/* ============================================================
 * VÝBĚR KANDIDÁTA (různorodost + rotace)
 * ============================================================ */

/**
 * Výběr kandidáta s ohledem na RŮZNORODOST:
 *   1) FILTR POUŽITÝCH: potraviny už obsažené v dnešním jídelníčku
 *      jsou odsunuty k pozadí.
 *   2) DENNÍ ROTACE mezi cenově SROVNATELNÝMI kandidáty (skóre
 *      alespoň poolMin nejlepšího). Denní plán 0,85 – výrazně
 *      levnější alternativa vždy zvítězí; týdenní plán 0,60 –
 *      širší výběr, aby 7 dní = 7 odlišných jídelníčků.
 *      Offset podle dne (1–7) a pořadí jídla: plán je jiný každý
 *      den, přitom DETERMINISTICKÝ.
 */
export function vyberKandidata(
  kandidati: Kandidat[],
  poradi: number,
  pouziteId: string[] = [],
  denniPosun: number | null = null,
  poolMin = 0.85,
): Kandidat | null {
  if (kandidati.length === 0) return null;

  // 1) preferujeme potraviny, které dnes dosud nebyly
  const nove = kandidati.filter((p) => !pouziteId.includes(p.id));
  if (nove.length > 0) {
    kandidati = nove;
  }

  // 2) rotujeme jen mezi cenově srovnatelnými kandidáty
  const nejlepsi = kandidati[0]?.skore ?? 0;
  if (nejlepsi > 0) {
    const srovnatelni = kandidati.filter((p) => p.skore >= nejlepsi * poolMin);
    if (srovnatelni.length > 0) {
      kandidati = srovnatelni;
    }
  }

  // 3) denní rotace – pondělí ≠ úterý, snídaně ≠ oběd
  //    (JS getDay(): 0 = neděle → převedeme na 1–7 dle ISO)
  const den = denniPosun ?? (new Date().getDay() === 0 ? 7 : new Date().getDay());
  const offset = den + poradi * 2;
  return kandidati[offset % kandidati.length] ?? null;
}

/* ============================================================
 * TVORBA JÍDLA A PLÁNOVÁNÍ
 * ============================================================ */

/** Vytvoří položku jídelníčku z potraviny a počtu gramů. */
export function vytvorJidlo(p: Potravina, gramy: number): Jidlo {
  const k = gramy / 100;
  return {
    id: p.id,
    nazev: p.nazev,
    gramy,
    kalorie: Math.round(p.kalorie * k),
    bilkoviny: Math.round(p.bilkoviny * k * 10) / 10,
    sacharidy: Math.round(p.sacharidy * k * 10) / 10,
    tuky: Math.round(p.tuky * k * 10) / 10,
    cena: Math.round(p.aktualniCena * k * 100) / 100,
    cenaBezna: Math.round(p.beznaCena * k * 100) / 100,
    obchod: p.sleva ? p.obchod : null,
    sleva: p.sleva,
    obrazek: p.obrazek ?? null,
  };
}

/**
 * Naplánuje jednotlivé jídlo ze 3 kroků:
 *   1. „kotva" = bílkovinová potravina (kvantita podle bílkovin)
 *   2. doplněk sacharidů (preferujeme nízko-bílkovinné zdroje)
 *   3. doplněk tuků (jen když zbývá potřeba i kalorický prostor)
 * Vybraná ID přibudou do pouziteId → další jídla preferují jiné
 * potraviny (různorodost v rámci dne).
 */
export function naplanujJidlo(
  kategorie: KategorieMap,
  poradi: number,
  cilB: number,
  cilS: number,
  cilT: number,
  cilK: number,
  pouziteId: string[] = [],
  denniPosun: number | null = null,
  poolMin = 0.85,
): Jidlo[] {
  const jidla: Jidlo[] = [];
  // nezáporné a konečné zbytky – NaN/Infinity cíl nesmí otrávit plán
  const z = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  const zbyva = { b: z(cilB), s: z(cilS), t: z(cilT), k: z(cilK) };

  /** gramace podle požadovaného makra + kalorického stropu +
   * strop ostatních maker (vysokotučná kotva nesmí vyčerpat tukový rozpočet) */
  const gramace = (p: Kandidat, makro: "bilkoviny" | "sacharidy" | "tuky", cilNaMakro: number, min: number, max: number): number => {
    const hodnotaNaGram = Math.max(p[makro], 0.5) / 100;
    const gramyPodleMakra = Math.round(cilNaMakro / hodnotaNaGram);
    const kcalNaGram = Math.max(p.kalorie, 1) / 100;
    const gramyPodleKcal = Math.floor(zbyva.k / kcalNaGram);
    // 30 % rezerva nad zbývající rozpočet ostatních maker – samotná potravina
    // nemůže překročit jídelní rámec o víc. Strop platí jen u potravin,
    // které jsou v daném makru významné (≥ 3 g/100 g) – brambory s 0,1 g tuku
    // nesmí být omezené vyčerpaným tukovým rozpočtem.
    const stropTuk = p.tuky >= 3 ? Math.floor((Math.max(zbyva.t, 0) * 1.3) / (p.tuky / 100)) : Number.MAX_SAFE_INTEGER;
    const stropSach = p.sacharidy >= 3 ? Math.floor((Math.max(zbyva.s, 0) * 1.3) / (p.sacharidy / 100)) : Number.MAX_SAFE_INTEGER;
    return Math.max(min, Math.min(Math.min(gramyPodleMakra, gramyPodleKcal, stropTuk, stropSach), max));
  };

  const pridej = (p: Potravina, gramy: number) => {
    pouziteId.push(p.id);
    const jidlo = vytvorJidlo(p, gramy);
    jidla.push(jidlo);
    zbyva.b -= jidlo.bilkoviny;
    zbyva.s -= jidlo.sacharidy;
    zbyva.t -= jidlo.tuky;
    zbyva.k -= jidlo.kalorie;
  };

  // --- 1. kotva (bílkovinová potravina) ---
  // Když jsou všechny bílkovinové potraviny dnes použité (malý katalog,
  // třeba filtr bezlepkovy), ukotvíme jídlo nevyužitou potravinou s nejvyšším
  // obsahem bílkovin z jiných kategorií (sýry, čočka…) – jinak by se kotva
  // opakovala v každém jídle. Suroviny (droždí…) kotvou být nesmí.
  let kotva: Kandidat | null;
  const bilkovinyBezPrisad = kategorie.bilkovinova.filter((p) => !jePrisada(p));
  const bilkovinyPool = bilkovinyBezPrisad.length > 0 ? bilkovinyBezPrisad : kategorie.bilkovinova;
  if (bilkovinyPool.some((p) => !pouziteId.includes(p.id))) {
    kotva = vyberKandidata(bilkovinyPool, poradi, pouziteId, denniPosun, poolMin);
  } else {
    const nahradni = [...kategorie.tukova, ...kategorie.sacharidova]
      .filter((p) => !pouziteId.includes(p.id) && !jePrisada(p))
      .sort((a, b) => b.bilkoviny - a.bilkoviny);
    kotva =
      vyberKandidata(nahradni.slice(0, 3), poradi, pouziteId, denniPosun, 0.5) ??
      vyberKandidata(bilkovinyPool, poradi, pouziteId, denniPosun, poolMin) ??
      vyberKandidata(kategorie.sacharidova, poradi, pouziteId, denniPosun, poolMin);
  }
  if (kotva !== null && zbyva.b >= 5) {
    pridej(kotva, gramace(kotva, "bilkoviny", zbyva.b, 30, 400));
  }

  // --- 2. doplněk sacharidů ---
  // Sacharidový doplněk nechceme „přeflakovat" dalšími bílkovinami,
  // proto preferujeme potraviny s nízkým obsahem bílkovin
  // (rýže a vločky, ne čočka), existují-li mezi kandidáty.
  // Suroviny (cukr, mouka) z výběru vylučujeme – jídlo z nich nesestavíme.
  let kandidatiS = kategorie.sacharidova;
  const realneSacharidy = kandidatiS.filter((p) => !jePrisada(p));
  if (realneSacharidy.length > 0) {
    kandidatiS = realneSacharidy;
  }
  const nizkoproteinovi = kandidatiS.filter((p) => p.bilkoviny <= 15.0);
  if (nizkoproteinovi.length > 0) {
    kandidatiS = nizkoproteinovi;
  }
  const dopln = vyberKandidata(kandidatiS, poradi, pouziteId, denniPosun, poolMin);
  if (dopln !== null && zbyva.s >= 10 && zbyva.k >= 60) {
    pridej(dopln, gramace(dopln, "sacharidy", zbyva.s, 30, 350));
  }

  // --- 3. doplněk tuků ---
  // Preferujeme skutečné potraviny (ořechy, avokádo, sýry); suroviny
  // (olej, máslo, sádlo) bereme jen jako rezervu a s užším stropem –
  // 25 g oleje k pokrmu smysl dává, 90 g už ne.
  const tukBezPrisad = kategorie.tukova.filter((p) => !jePrisada(p));
  const tukovina = vyberKandidata(
    tukBezPrisad.length > 0 ? tukBezPrisad : kategorie.tukova,
    poradi,
    pouziteId,
    denniPosun,
    poolMin,
  );
  if (tukovina !== null && zbyva.t >= 8 && zbyva.k >= 80) {
    pridej(tukovina, gramace(tukovina, "tuky", zbyva.t, 20, jePrisada(tukovina) ? 30 : 100));
  }

  return jidla;
}

/** Medián kladných cen jako „typická cena" pro neceněné položky. */
function medianCeny(potraviny: Potravina[]): number {
  const ceny = potraviny.map((p) => p.aktualniCena).filter((c) => c > 0).sort((a, b) => a - b);
  if (ceny.length === 0) return 15; // celý katalog bez cen – rozumná výchozí Kč/100g
  return ceny[Math.floor(ceny.length / 2)]!;
}

/** Seřadí potraviny dle skóre a vrátí kategorie kandidátů. */
function pripravKategorie(potraviny: Potravina[]): KategorieMap {
  const kategorie: KategorieMap = { bilkovinova: [], sacharidova: [], tukova: [] };
  const median = medianCeny(potraviny);

  for (const p of potraviny) {
    const k = kategoriePotraviny(p);
    const kandidat: Kandidat = { ...p, skore: skorePotraviny(p, k, median) };
    kategorie[k].push(kandidat);
  }

  // seřadíme každou kategorii od NEJVÝHODNĚJŠÍHO kandidáta
  for (const k of Object.keys(kategorie) as Kategorie[]) {
    kategorie[k].sort((a, b) => b.skore - a.skore);
  }

  return kategorie;
}

/** Denní souhrn – vynuluje jíla. */
function souhrnJidla(jidla: Jidlo[]): SouhrnJidla {
  const s: SouhrnJidla = {
    jidla,
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };
  for (const j of jidla) {
    s.kalorie += j.kalorie;
    s.bilkoviny += j.bilkoviny;
    s.sacharidy += j.sacharidy;
    s.tuky += j.tuky;
    s.cena += j.cena;
    s.cenaBezna += j.cenaBezna;
  }
  s.bilkoviny = Math.round(s.bilkoviny * 10) / 10;
  s.sacharidy = Math.round(s.sacharidy * 10) / 10;
  s.tuky = Math.round(s.tuky * 10) / 10;
  s.cena = Math.round(s.cena * 100) / 100;
  s.cenaBezna = Math.round(s.cenaBezna * 100) / 100;
  return s;
}

/* ============================================================
 * HLAVNÍ FUNKCE GENERÁTORU
 * ============================================================ */

/**
 * Vygeneruje denní jídelníček.
 * denniPosun: 1–7 (pondělí–neděle) – deterministický výstup dle dne;
 * poolMin: 0.85 denní / 0.60 týdenní (viz vyberKandidata).
 */
export function vygenerujJidelnicek(
  potraviny: Potravina[],
  cile: Cile,
  denniPosun: number | null = null,
  poolMin = 0.85,
  pocetJidel = 4,
  filtr: FiltrPotraviny | null = null,
): DenVysledek {
  // ochrana proti poškozeným cílům (NaN / Infinity / záporná čísla
  // z DB nebo formuláře) – raději nulový plán než NaN ve výsledku
  const fin = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);
  const cileCiste: Cile = {
    kalorie: fin(cile.kalorie),
    bilkoviny: fin(cile.bilkoviny),
    sacharidy: fin(cile.sacharidy),
    tuky: fin(cile.tuky),
  };

  const kategorie = pripravKategorie(filtrujPotraviny(potraviny, filtr));

  const jidelnicek: Record<string, SouhrnJidla> = {};
  const celkem: SouhrnJidlaBezJidel = {
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };
  const pouziteId: string[] = [];
  let poradi = 0;

  const podily = podilyProPocetJidel(pocetJidel);
  for (const [nazevJidla, podil] of Object.entries(podily)) {
    const jidla = naplanujJidlo(
      kategorie,
      poradi,
      cileCiste.bilkoviny * podil,
      cileCiste.sacharidy * podil,
      cileCiste.tuky * podil,
      cileCiste.kalorie * podil,
      pouziteId,
      denniPosun,
      poolMin,
    );

    const souhrn = souhrnJidla(jidla);
    jidelnicek[nazevJidla] = souhrn;

    celkem.kalorie += souhrn.kalorie;
    celkem.bilkoviny += souhrn.bilkoviny;
    celkem.sacharidy += souhrn.sacharidy;
    celkem.tuky += souhrn.tuky;
    celkem.cena += souhrn.cena;
    celkem.cenaBezna += souhrn.cenaBezna;

    poradi++;
  }

  celkem.bilkoviny = Math.round(celkem.bilkoviny * 10) / 10;
  celkem.sacharidy = Math.round(celkem.sacharidy * 10) / 10;
  celkem.tuky = Math.round(celkem.tuky * 10) / 10;
  celkem.cena = Math.round(celkem.cena * 100) / 100;
  celkem.cenaBezna = Math.round(celkem.cenaBezna * 100) / 100;

  return { jidelnicek, celkem };
}

/* ============================================================
 * NÁKUPNÍ SEZNAM
 * ============================================================ */

/**
 * Sesbírá potraviny ze všech jídel (i z více dnů), sečte gramy
 * a ke každé spočítá celkovou cenu dle aktuální (slevové) ceny.
 * Cena za 100 g už zahrnuje SLEVU – seznam ukazuje, v KTERÉM
 * obchodě nakoupit nejvýhodněji + kolik sleva ušetřila.
 */
export function sestavNakupniSeznam(jidelnicek: Record<string, SouhrnJidla>): NakupniPolozka[] {
  const mapa = new Map<string, NakupniPolozka>();

  for (const souhrn of Object.values(jidelnicek)) {
    for (const jidlo of souhrn.jidla) {
      let polozka = mapa.get(jidlo.id);
      if (!polozka) {
        polozka = {
          id: jidlo.id,
          nazev: jidlo.nazev,
          gramy: 0,
          // potravina bez ceny (0 Kč) → null → UI ukáže „—", stejně jako mealprep
          cenaZa100g:
            jidlo.gramy > 0 && jidlo.cena > 0
              ? Math.round(((jidlo.cena * 100) / jidlo.gramy) * 100) / 100
              : null,
          cenaBeznaZa100g:
            jidlo.gramy > 0 && jidlo.cenaBezna > 0
              ? Math.round(((jidlo.cenaBezna * 100) / jidlo.gramy) * 100) / 100
              : null,
          obchod: jidlo.obchod,
          sleva: jidlo.sleva,
          obrazek: jidlo.obrazek ?? null,
          cenaCelkem: 0,
          usetreno: 0,
        };
        mapa.set(jidlo.id, polozka);
      }
      polozka.gramy += jidlo.gramy;
    }
  }

  const seznam: NakupniPolozka[] = [];
  for (const polozka of mapa.values()) {
    polozka.cenaCelkem = Math.round(((polozka.gramy * (polozka.cenaZa100g ?? 0)) / 100) * 100) / 100;
    // úspora jen u ocejněných položek – bez aktuální ceny nelze ušetřit spočítat
    polozka.usetreno =
      polozka.cenaBeznaZa100g !== null && polozka.cenaZa100g !== null
        ? Math.max(
            0,
            Math.round(((polozka.gramy * (polozka.cenaBeznaZa100g - polozka.cenaZa100g)) / 100) * 100) / 100,
          )
        : 0;
    seznam.push(polozka);
  }

  // od nejdražší položky (hlavní nákup nahoře)
  seznam.sort((a, b) => b.cenaCelkem - a.cenaCelkem);
  return seznam;
}

/* ============================================================
 * TÝDENNÍ PLÁN
 * ============================================================ */

export interface TydenniPlan {
  dny: Record<number, DenVysledek>;
  tyden: SouhrnJidlaBezJidel;
  nakup: NakupniPolozka[];
}

/** Týdenní plán = 7 dnů, každý s vlastní rotací (denniPosun = 1–7). */
export function vygenerujTydenniPlan(
  potraviny: Potravina[],
  cile: Cile,
  pocetJidel = 4,
  filtr: FiltrPotraviny | null = null,
): TydenniPlan {
  const dny: Record<number, DenVysledek> = {};
  const tyden: SouhrnJidlaBezJidel = {
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };

  for (let den = 1; den <= 7; den++) {
    const vysledek = vygenerujJidelnicek(potraviny, cile, den, 0.6, pocetJidel, filtr);
    dny[den] = vysledek;

    tyden.kalorie += vysledek.celkem.kalorie;
    tyden.bilkoviny += vysledek.celkem.bilkoviny;
    tyden.sacharidy += vysledek.celkem.sacharidy;
    tyden.tuky += vysledek.celkem.tuky;
    tyden.cena += vysledek.celkem.cena;
    tyden.cenaBezna += vysledek.celkem.cenaBezna;
  }

  tyden.kalorie = Math.round(tyden.kalorie);
  tyden.bilkoviny = Math.round(tyden.bilkoviny * 10) / 10;
  tyden.sacharidy = Math.round(tyden.sacharidy * 10) / 10;
  tyden.tuky = Math.round(tyden.tuky * 10) / 10;
  tyden.cena = Math.round(tyden.cena * 100) / 100;
  tyden.cenaBezna = Math.round(tyden.cenaBezna * 100) / 100;

  // spojíme jídelníčky všech dnů do jednoho nákupního seznamu
  const spojeny: Record<string, SouhrnJidla> = {};
  for (const [den, vysledek] of Object.entries(dny)) {
    for (const [nazev, souhrn] of Object.entries(vysledek.jidelnicek)) {
      const klic = `${den}-${nazev}`; // dny se nesmí slít
      spojeny[klic] = souhrn;
    }
  }

  return { dny, tyden, nakup: sestavNakupniSeznam(spojeny) };
}

/* ============================================================
 * POMOCNÍK: cíl vs. realita
 * ============================================================ */

/** Procenta shody (100 − |odchylka|) + barva progress baru. */
export function panelTik(aktualni: number, cilovy: number): { shoda: number; trida: string } {
  const odchylka = cilovy > 0 ? ((aktualni - cilovy) / cilovy) * 100 : 0;
  const shoda = Math.max(0, Math.min(100, Math.round(100 - Math.abs(odchylka))));

  let trida = "ok";
  if (shoda < 70) trida = "danger";
  else if (shoda < 90) trida = "warning";

  return { shoda, trida };
}

/**
 * Vymění jedno jídlo v hotovém denním plánu. Nová kombinace pro daný slot
 * nesmí použít potraviny ostatních jídel ani potraviny původního jídla,
 * takže je výsledek zaručeně jiný – ale pořád respektuje cíle a filtr.
 * Vrací null, když slot neexistuje nebo generátor nenajde náhradu.
 */
export function vymenJidlo(
  potraviny: Potravina[],
  den: DenVysledek,
  nazevJidla: string,
  cile: Cile,
  filtr: FiltrPotraviny | null = null,
  poolMin = 0.85,
): DenVysledek | null {
  const stara = den.jidelnicek[nazevJidla];
  if (!stara) return null;
  const podil = podilyProPocetJidel(Object.keys(den.jidelnicek).length)[nazevJidla];
  if (podil === undefined) return null;

  // všechna jídla včetně vyměňovaného → náhrada použije vždy jiné potraviny
  const pouziteId = Object.values(den.jidelnicek).flatMap((s) => s.jidla.map((j) => j.id));
  const puvodnePouzite = new Set(pouziteId);
  const kategorie = pripravKategorie(filtrujPotraviny(potraviny, filtr));
  const jidla = naplanujJidlo(
    kategorie,
    0,
    cile.bilkoviny * podil,
    cile.sacharidy * podil,
    cile.tuky * podil,
    cile.kalorie * podil,
    pouziteId,
    null,
    poolMin,
  );
  // vyberKandidata padá zpět na použité potraviny, když je fond malý –
  // u výměny to porušuje garanci „vždy jiné jídlo", takže takovou
  // náhradu raději odmítneme (UI ukáže hlášku, že náhrada neexistuje).
  if (jidla.length === 0 || jidla.some((j) => puvodnePouzite.has(j.id))) return null;

  const nova = souhrnJidla(jidla);
  const celkem = {
    kalorie: Math.round(den.celkem.kalorie - stara.kalorie + nova.kalorie),
    bilkoviny: Math.round((den.celkem.bilkoviny - stara.bilkoviny + nova.bilkoviny) * 10) / 10,
    sacharidy: Math.round((den.celkem.sacharidy - stara.sacharidy + nova.sacharidy) * 10) / 10,
    tuky: Math.round((den.celkem.tuky - stara.tuky + nova.tuky) * 10) / 10,
    cena: Math.round((den.celkem.cena - stara.cena + nova.cena) * 100) / 100,
    cenaBezna: Math.round((den.celkem.cenaBezna - stara.cenaBezna + nova.cenaBezna) * 100) / 100,
  };
  return { ...den, jidelnicek: { ...den.jidelnicek, [nazevJidla]: nova }, celkem };
}

/**
 * Vymění jídlo v konkrétním dni týdenního plánu – deleguje na vymenJidlo
 * a přepočítá týdenní součty i sloučený nákupní seznam.
 */
export function vymenJidloVTydnu(
  potraviny: Potravina[],
  plan: TydenniPlan,
  denIndex: number,
  nazevJidla: string,
  cile: Cile,
  filtr: FiltrPotraviny | null = null,
): TydenniPlan | null {
  const den = plan.dny[denIndex];
  if (!den) return null;
  const novyDen = vymenJidlo(potraviny, den, nazevJidla, cile, filtr);
  if (novyDen === null) return null;

  const dny = { ...plan.dny, [denIndex]: novyDen };
  const spojeny: Record<string, SouhrnJidla> = {};
  const tyden: SouhrnJidlaBezJidel = {
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };
  for (const [d, v] of Object.entries(dny)) {
    tyden.kalorie += v.celkem.kalorie;
    tyden.bilkoviny += v.celkem.bilkoviny;
    tyden.sacharidy += v.celkem.sacharidy;
    tyden.tuky += v.celkem.tuky;
    tyden.cena += v.celkem.cena;
    tyden.cenaBezna += v.celkem.cenaBezna;
    for (const [nazev, souhrn] of Object.entries(v.jidelnicek)) {
      spojeny[`${d}-${nazev}`] = souhrn;
    }
  }
  tyden.bilkoviny = Math.round(tyden.bilkoviny * 10) / 10;
  tyden.sacharidy = Math.round(tyden.sacharidy * 10) / 10;
  tyden.tuky = Math.round(tyden.tuky * 10) / 10;
  tyden.cena = Math.round(tyden.cena * 100) / 100;
  tyden.cenaBezna = Math.round(tyden.cenaBezna * 100) / 100;

  return { dny, tyden, nakup: sestavNakupniSeznam(spojeny) };
}
