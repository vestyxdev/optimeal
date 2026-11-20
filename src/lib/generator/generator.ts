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
  /** původní (přeškrtnutá) cena za 100 g – jen zdrojem ověřená */
  puvodniCena?: number | null;
  /** odkud původní cena pochází: letákové %, was-price eshopu, Kupi „běžně stojí“ */
  puvodniZdroj?: "letak" | "eshop" | "kupi" | null;
  /** % slevy spočítaná z původní ceny (badge „-30 %“) */
  slevaProcenta?: number | null;
  /** poslední den platnosti akční ceny (ISO) – „sleva do út 18. 11.“ */
  platnostDo?: string | null;
  /** kdy byla cena naposledy pozorována scraperem (ISO) – „aktualizováno dnes“ */
  pozorovanoAt?: string | null;
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
 * Jmenná heuristika EU-14 alergenů – bezpečnostní síť pro položky bez
 * alergenových tagů (retail scraper nemá OFF allergens_tags; v katalogu
 * je tagovaná jen čtvrtina položek). Při alergii je falešně pozitivní
 * vyloučení bezpečnější než falešně negativní, proto jsou vzorce
 * záměrně širší – ale ověřené proti typickým českým falešným shodám
 * (rybíz ≠ ryba, chlebíčky z rýže ≠ chléb, kokos není ořech EU-14).
 */
export const ALERGEN_Z_NAZVU: Record<string, RegExp> = {
  lepek:
    /p[šs]en|[žz]itn|je[čc]men|oves|[šs]pald|spelt|chl[éeé]b(?!íč)|rohl[íi]k|housk|baget|t[ěe]stovin|testovin|nudl|[šs]paget|lasagn|penne|fusill|farfalle|tagliatell|rigatoni|gnocchi|makaron|knedl|mouk|múk|strouhan|panko|bulgur|cous ?cous|kuskus|seitan|tarhoň|pern[íi]k|kol[áa][čc]|bucht|croissant|koblih|su[šs]enk|pizza|tortill|wrap\b|kn[äa]ck|crispbread|crackers?|müsli|musli|granola|[šs]trúdl|strudl|[čc]ere[áa]l|vlo[čc]k|triti|pečiv/i,
  mleko:
    /ml[eé]k|s[ýy]r|tvaroh|jogurt|zakysan|smetan|m[áa]sl|kef[íi]r|skyr|mozzarell|eidam|gouda|parmez|parmesan|parmigiano|\bniv|hermel|emental|balk[áa]nsk|ricott|mascarpone|puding|zmrzlin|nanuk|[čc]okol[áa]d|srv[áa]tk|whey|kazein|kasein|casein|laktoz|bechamel|feta\b|bryndz|parenic|camembert|cheddar|brie\b|lu[čc]in|lip[áa]nek/i,
  vejce: /vaj|vejc|[žz]loutk|majon[eé]z|mayonnaise|mayo\b|egg\b|tiramisu/i,
  ryby:
    /ryb(?![ií]z)|losos|tu[ňn][áa]k|tuna\b|sardink|sardel|makrel|kapr\b|pstruh|cand[áa]t|[šs]tik|[úu]ho[řr]|tresk|halibut|pangas|anchov|an[čc]ovi[čc]k|garn[áa]t|mo[řr]sk[éeé] ryb/i,
  arasidy: /ara[šs][íi]d|arasid|peanut|bur[áa]k/i,
  soja: /s[óo]j|soja|soya|tofu|tempeh|edamame/i,
  orisky:
    /o[řr]ech|o[řr][íi][šs]k|orisk|mandel|mandl|l[íi]sk|ke[šs]u|kesu|pist[áa]c|pekan|vla[šs]sk|makadam|para ?o[řr]ech|marzipan|marcip[áa]n|nug[áa]t|nougat|pralin|musli|müsli|granola/i,
  skorocel: /celer|skorocel|celery/i,
  horcice: /ho[řr][čc]ic|horcic|k[řr]em[žz]sk|senf|mustard|dijon/i,
  sezam: /sezam|tahini|hummus|humus|chumus/i,
  sulfit: /sulfit|si[řr][íi][čc]it|\bv[íi]n|\bvinn|ocet|octov|su[šs]en[éeé] (ovoce|raj[čc])/i,
  lupina: /lupin/i,
  korisi:
    /kor[ýy][šs]|korys|krevet|krab(?!i)|langust|humr|\brak[aů]?\b|\braci\b|shrimp|scampi|garn[áa]t/i,
  vodnany:
    /m[ěe]kk[ýy][šs]|mekkys|[úu]st[řr]ic|mu[šs]l(?!i)|chobotnic|s[éeé]pi|olih|kalam[áa]r|sl[áa]vk|vongole/i,
};

/**
 * Celonázvové námitky – deklarovaný „bez X" vyvrací jakýkoliv důkaz
 * alergenu z názvu (Bezlepková pizza, Bezvaječné těstoviny).
 * Pozn.: bezlaktózové ≠ bezmlečné – laktóza není mléčný protein,
 * bezlaktózové mléko alergii neřeší → výjimka tu záměrně není.
 */
const ALERGEN_VYRAZ_VYNECH: Record<string, RegExp> = {
  lepek: /bez.?lepk|gluten.?free|bez.?glutenu|pro celiaky/i,
  vejce: /bezvaje[čc]|bez.?vajec|egg.?free/i,
  mleko: /bez.?ml[eé]k|milk.?free|dairy.?free/i,
};

/**
 * Fráze vynechané před testem názvu – „arašídové máslo" je rostlinné
 * máslo (ne mléčné), „ryzlink vlašský" je vinná odrůda (ne vlašáky),
 * „s humusem" je půdní substrát (ne hummus).
 */
export const ALERGEN_FRAZE_VYNECH: Record<string, RegExp> = {
  mleko:
    /(?:ara[šs][íi]d|peanut|ke[šs]u|kesu|mandl|mandel|l[íi]sk|pist[áa]c|pekan|vla[šs]sk|makadam|para ?o[řr]ech|o[řr]echov|o[řr][íi][šs]k|kokos|kakao|bambuck|karit|shea|rostlinn|slune[čc]nic|d[ýy][ňn]|m[áa]k|konopn|ln[ěe]n|chia|sezam|tahini|ag[áa]v)[a-zá-žěščřžýíéůúó]*\s+m[áa]sl\w*/gi,
  orisky:
    /vla[šs]sk\w*\s+(?:pozdn[íi]|sb[ěe]r|m[íi]stn[íi]|ryzlink|v[íi]n|hrozn)|(?:ryzlink|veltlin|müller|mueller|thurgau|sauvignon|sylv[áa]nsk|frankovk|ruland|tram[íi]n|mu[šs]k[áa]t|pinot|chardonnay)\w*\s+vla[šs]sk\w*/gi,
  sezam: /\bhumus(?:em|u|ov[éeéý]|n[íi]m?)\w*/gi,
};

/** Název potraviny nasvědčuje přítomnosti alergenu? Síť pro chybějící tagy.
 *  Respektuje deklarované „bez X" námitky a před testem vynechává
 *  zavádějící fráze (rostlinná másla, vinné odrůdy, půdní humus). */
export function nazevNasvedcujeAlergenu(nazev: string, alergen: string): boolean {
  if (ALERGEN_VYRAZ_VYNECH[alergen]?.test(nazev)) return false;
  const re = ALERGEN_Z_NAZVU[alergen];
  if (!re) return false;
  const vynech = ALERGEN_FRAZE_VYNECH[alergen];
  const vycistene = vynech ? nazev.replace(vynech, " ") : nazev;
  return re.test(vycistene);
}

/** Potravina obsahuje alergen – podle tagu NEBO názvu (tagy pokrývají jen část katalogu). */
export function obsahujeAlergen(
  p: { nazev: string; alergeny?: string[] },
  alergen: string,
): boolean {
  return (
    (p.alergeny ?? []).includes(alergen) ||
    nazevNasvedcujeAlergenu(p.nazev, alergen)
  );
}

/**
 * Odfiltruje katalog podle profilu: potravina musí vyhovovat VŠEM
 * dietám a nesmí obsahovat ŽÁDNÝ z uvedených alergenů – ať už podle
 * alergenového tagu, nebo podle názvu (bezpečnostní síť: tagy má jen
 * ~28 % položek katalogu).
 *
 * „Bezlepková dieta" je výjimka: neznamená „jen certifikované GF
 * produkty" (těch je ~70 a plán z nich je chudý i drahý), ale
 * „vyloučit lepek" – přirozeně bezlepkové potraviny (rýže, maso,
 * zelenina) tag bezlepkovy nenosí. Celiakův filtr se tak chová jako
 * alergie na lepek: široký bezpečný pool, glutenové položky ven.
 * Prázdný filtr = celý katalog (běžný jedlík).
 */
export function filtrujPotraviny(
  potraviny: Potravina[],
  filtr?: FiltrPotraviny | null,
): Potravina[] {
  const diety = (filtr?.diety ?? []).filter((d) => d !== "bezlepkovy");
  const alergeny = [...(filtr?.alergeny ?? [])];
  if (filtr?.diety?.includes("bezlepkovy")) alergeny.push("lepek");
  if (diety.length === 0 && alergeny.length === 0) return potraviny;
  return potraviny.filter(
    (p) =>
      diety.every((d) => (p.diety ?? []).includes(d)) &&
      alergeny.every((a) => !obsahujeAlergen(p, a)),
  );
}

/** Role položky v jídle – denní solver podle ní škáluje a přidává. */
export type RoleJidla =
  | "kotva"     // hlavní bílkovinová kotva (maso, tvaroh, vejce…)
  | "sacharid"  // sacharidová příloha / základ (rýže, chléb, ovoce…)
  | "tuk"       // tukový doplněk (olej, ořechy, máslo…)
  | "zelenina"  // zeleninová strana u oběda/večeře
  | "suplement"; // volitelný doplněk – jediný povolený: whey do snídaně

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
  /** gramáž prodávaného balení – pro „co se reálně koupí" */
  baleniG?: number | null;
  /** role v jídle (kotva / sacharid / tuk / zelenina / suplement) */
  role?: RoleJidla;
  /** kusový popisek množství: „2 ks · 120 g" (vejce, rohlík, banán…) */
  popisekMnozstvi?: string;
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
  /** gramáž prodávaného balení (když je známá) – pro nákupní balení */
  baleniG?: number | null;
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
  // nespoledlivá cena (pack-mismatch artefakt, Kč/kg→100 g misfire)
  // se chová jako „bez ceny" – jinak by 5 Kč/100 g vyhrálo všechno
  const nacenena = jeCenaSpolehliva(p);
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
  /\b(olej\b|olio\b|oil\b|oel\b|olaj\b|öl\b|napraforg|sonnenblumen|huile|olivov|margarin|s[aá]dl|lůj|mouk|múk|cukr|sirup|syrup|ocet|tapioc|s[oóůu][lľ]\b|ko[řr]en[íi]|drožd|kyp[řr]ic|jedl[aá] sod|bobkov|major[aá]n|sko[řr]ic|km[íi]n|pep[řr]\b|buj[oó]n|bu[ďd]on|bulion|maggi|m[aá]slo\b|med\b|caro\b|majon[eé]z|mayonnaise|mayo\b|tatarsk|tatark|om[áa][čc]k|sauces?|dresink|dressing|hořčic|kremžsk|senf\b|mustard|ochucovadl|kucharek|kucharka|vegeta\b|krupic|nápoj|n[áa]pojov|j[ií][šš]k|rama\b|gh[ií]\b|ghee|hera\b|perla\b|flora\b|zlat[áa] han|rozt[ií]rateln[ýy] tuk|cooking|seitan\S*\s+(mix|sm[ěe]s)|sm[ěe]s na seitan)|želatin/i;

/** Je potravina kuchyňská surovina, ne samostatná složka jídla? */
export function jePrisada(p: { nazev: string }): boolean {
  return PRISADA_RE.test(p.nazev);
}

/**
 * Klíč podobnosti názvu – první dvě slova bez diakritiky.
 * „Sušené maso hovězí" a „Sušené maso krůtí" mají stejný klíč →
 * generátor jich do jednoho dne nedá víc (různorodost, ne opakování).
 */
export function klicPodobnosti(nazev: string): string {
  return nazev
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

/**
 * „Kulinářská vhodnost" pro typ jídla – snídaně se nesestavuje
 * z beef jerky a oběd z müsli. Měkká preference: vhodné potraviny
 * jdou do výběru první, když žádná nekandiduje, vezme se plný pool
 * (plán musí fungovat i na malém/filtrovaném katalogu).
 */
const SNIDANE_RE =
  /müsli|musli|granola|vlo[čc]k|ovsen|kaše|porridge|oatmeal|jogurt|skyr|ml[eé]k|chl[eé]b|chleba|rohl[íi]k|housk|toast|croissant|veka|pomaz[aá]nk|džem|marmel[aá]d|tvaroh|vaj[íi][čc]|vejce|cornflakes|kornflejk|proteinov|ban[aá]n|jablk|hru[šs]k|bor[ůu]v|jahod|malin|meloun|ananas|smoothie|o[řr]ech|mandle|kešu|kesu|pist[aá]c|krupič/i;

const OBED_VECERE_RE =
  /r[ýy]že|risott|t[ěe]stovin|spaget|penne|fusilli|nudl|brambor|knedl|maso|ku[řr]ec|kr[ůu]t|vep[řr]|hov[ěe]z|jehn[ěe]|telec|ryb|tu[ňn][aá]k|losos|kapr|pstruh|sle[ďd]|makrel|sardink|tresk|tilapi|krevet|kalam[aá]r|krab|fazol|[čc]očk|cizrn|zelenin|sal[aá]t|gul[aá]š|pol[ée]vk|steak|file|prso|prsa|seitan|tofu|tempeh|pizza|tortill|wrap|burg|chilli|curry|quino|bulgur|kuskus|tarho[ňn]|[úu]zen|[šs]unk|jerky|zavin|sv[íi][čc]kov|kan[čc]|tvaroh|s[ýy]r|oliv|avok[aá]d|chl[eé]b|rohl[íi]k|housk/i;

/** Samostatné svačinové potraviny – ovoce, tyčinky, ořechy, snacky. */
const SVACINA_RE =
  /tyčink|jerky|smoothie|pudink|ban[aá]n|jablk|hru[šs]k|bor[ůu]v|jahod|malin|meloun|ananas|pomeranč|mandar|hroznov|kiwi|mango|o[řr]ech|mandle|l[íi]skov|kešu|kesu|pist[aá]c|vla[šs]sk|müsli|musli|granola|jogurt|proteinov|croissant|sušen|crack|popcorn|chips|sušenk|vlo[čc]k|ovsen|kaše|krupič|tvaroh|s[ýy]r|yogurt/i;

/** Tepelné přílohy – do svačiny nedávají smysl. */
const TEPLE_PRILOHY_RE =
  /r[ýy]že|t[ěe]stovin|spaget|penne|fusilli|nudl|brambor|knedl|kuskus|bulgur|quino|tarho[ňn]|pohank/i;

/** Přílohy k hlavnímu jídlu – sacharidový doplněk oběda/večeře. */
const PRILOHA_RE =
  /r[ýy]že|t[ěe]stovin|spaget|penne|fusilli|nudl|brambor|knedl|kuskus|bulgur|quino|tarho[ňn]|pohank|chl[ée]b(?!íč|i[čc]k|ovn)|chleba|rohl[íi]k|housk|veka|toast|tortill|bat[aá]t/i;

/** Příloha, která není příloha – instantní polévky, vývary a nápoje
 * zásahově vyloučit (vývar s nudlemi není sacharidová strana talíře). */
const PRILOHA_ANTI_RE =
  /pol[ée]vk|v[ýy]var|instantn[íi]|džus|juice|nápoj|pudink|puding|pudding|smoothie|dražé|mrk[ev]|karotk|celer|petržel|zel[íi]|sal[áa]t(?!.*(pomaz|maslov|s[ýy]rov))|su[šs]en.*(ananas|mango|ban[áa]n|datl|rozink|brusink|meruňk|fík|švestk|brosk|jahod|malin|bor[ůu]vk|hrozink)/i;

/** Snídaňové/sladké sacharidy – přílohou hlavního jídla nejsou. */
const SNIDANOVA_PRILOHA_ANTI_RE =
  /müsli|musli|granola|vlo[čc]k|ovsen|kaše|krupič|cornflakes|kornflejk|džem|marmel[aá]d|smoothie|pudink/i;

/** Jen-svačinové potraviny – nesmí kotvit hlavní jídlo. Sušené maso
 * a jerky jsou svačina, ne hlavní chod; „crunchy" snacky taktéž. */
const SVACINA_ANCHOR_ANTI_RE =
  /tyčink|smoothie|pudink|cornflakes|kornflejk|müsli|musli|granola|popcorn|chips|croissant|sušenk|jerky|biltong|su[šs]en[éeý].?(maso|kr[ůu]t|ku[řr]ec|vep[řr]|hov[ěe]z)|crunch/i;

/** Sladkosti a dezerty – vysoký tuk ano, ale tukový doplněk jídla nejsou.
 * Totéž platí pro mléčné nápoje – „45 g mléka jako tukový doplněk"
 * je hloupost, stejně jako jogurt v roli tuku. */
const TUK_ANTI_RE =
  /čokol[áa]d|pralink|bonb[oó]n|karamel|nug[áa]t|marcip|l[íi]z[áa]tk|žel[eé] bonb|gumov|z[áa]kusk|dort|zmrzlin|pern[íi]k|kol[áa][čc]|škub[áa]nk|bucht|str[úu]dl|mazanec|v[áa]no[cč]k|tartalet|pusink|marshmallow|mochi|halva|rahat|krokant|ml[ée]k|jogurt|skyr|kef[íi]r|zakysan|lip[áa]nek|acidofiln|zel[íi]|chl[ée]b|rohl[íi]k|housk|veka|baget|pe[čc]iv|dalam[aá]nek|bread\b|toast/i;

/** Dezerty a polévky – nekothví žádné jídlo (cheesecake k snídani
 * není snídaně, „Hrachová polévka" není večeře). */
const DEZERT_ANTI_RE =
  /cheesecake|z[áa]kusk|dort|zmrzlin|tiramisu|cr[èe]me|panna cotta|tartalet|škub[áa]nk|mazanec|v[áa]no[cč]k|halva|rahat|pol[ée]vk|v[ýy]var/i;

/**
 * Ryby a mořské plody – nekothví snídani (tuňákové vločky k snídani
 * nejsou česká snídaně). Výjimka: rybí pomazánky („Tuňáková pomazánka")
 * jsou legitimní snídaňová potravina – proto zápor lookahead na „pomaz".
 * Totéž platí pro vnitřnosti (játra, dršťky, ledviny, srdce) – játra
 * k snídani nepatří, játrová/jaterní pomazánka ano.
 */
export const SNIDANE_KOTVA_ANTI_RE =
  /(?:tu[ňn][aá]k|losos|makrel|sle[ďd]|sardink|tresk|pstruh|kapr|tilapi|krevet|kalam[aá]r|krab|játr|dršť|ledvin|srdc)(?!.*pomaz)|jerky|biltong|su[šs]en[éeý].?(maso|kr[ůu]t|ku[řr]ec|vep[řr]|hov[ěe]z)|crunch|fazol|[čc]očk|cizrn|hrach|hr[áa][šs]ek|lentil|urid|edamame|erbsen|linsen/i;

/** Kulinářský protivzor kotvy podle typu jídla – sdílený mezi
 * plánováním jídla i solverovým přidáváním bílkovin (sušený hrach
 * nesmí kotvit snídani, tyčinka oběd). */
const kotvaAntiRe = (typJ: TypJidla): RegExp =>
  typJ === "obedVecere"
    ? new RegExp(`(?:${SVACINA_ANCHOR_ANTI_RE.source})|(?:${DEZERT_ANTI_RE.source})`, "i")
    : typJ === "snidane"
      ? new RegExp(`(?:${SNIDANE_KOTVA_ANTI_RE.source})|(?:${DEZERT_ANTI_RE.source})`, "i")
      : DEZERT_ANTI_RE;

export type TypJidla = "snidane" | "obedVecere" | "svacina";

function typJidlaZ_nazvu(nazevJidla: string): TypJidla {
  if (/snídan/i.test(nazevJidla)) return "snidane";
  if (/svačin/i.test(nazevJidla)) return "svacina";
  return "obedVecere"; // Oběd, Večeře i případné vlastní názvy
}

/* ============================================================
 * CELOPOTRAVINOVÁ PRAVIDLA – skutečné jídlo, ne suplementy
 * ============================================================ */

/**
 * „Tvrdé" suplementy – práškové/instantní produkty a výkonnostní
 * doplňky. V jídelníčku nemají co dělat NIKDY: 94 g instantní
 * proteinové polévky nebo 30 g práškového pudinku není jídlo.
 * Regex je kontextový, aby se netrefil do normálních potravin –
 * „proteinový jogurt" a „rajčatový koncentrát" zůstávají potravinami:
 * protein/srvátk/whey se váže na prášek|izolát|koncentrát|polévku,
 * instant na protein|polévku|pudink.
 */
const SUPLEMENT_TVRDY_RE =
  /whey|srv[áa]tkov|gejner|gainer|bcaa|kreatin|creatin|karnitin|carnitin|pre.?workout|kasein|casein|maltodextrin|spalovač|b[íi]lkovin[ay]?\b|instantn[íia].{0,15}(?:protein|pol[ée]vk|pudink)|(?:protein|pol[ée]vk).{0,10}instantn|pol[ée]vk[ay][^.]{0,15}protein|protein[ov]*[áaýeéy]?\s*pol[ée]vk|pudink.{0,15}(?:pr[áa][šs]ek|prasek|instant|do vody)|(?:pr[áa][šs]ek|prasek)[^,]{0,15}pudink|(?:protein|srv[áa]tk).{0,20}(?:pr[áa][šs]ek|prasek|koncentr[áa]t|izol[áa]t)|pr[áa][šs]ek[^,]{0,15}protein|protein.{0,15}(?:pudding|pudink|mash|mousse|dessert|gelato|cr[èe]me|cream|kaše)|(?:pudding|mash|mousse).{0,15}protein|low.?carb.{0,10}protein/i;

/**
 * „Svačinové" suplementy – tyčinky a proteinové nápoje. Legitimní
 * svačina, ale NIKDY hlavní jídlo (proteinová tyčinka k snídani
 * ani obědu není jídlo).
 */
const SUPLEMENT_SNACK_RE =
  /ty[čc]ink|protein.{0,15}(?:shake|n[áa]poj|drink|bar\b|wafer|cookie|brownie|muffin|donut|su[šs]enk|vafle|wafl)|m[üu]sli.?bar|granola.?bar|energy.?bar/i;

/**
 * Práškové/instantní suplementy – vyloučené z jídelníčku úplně
 * (jediná výjimka: whey prášek jako malý doplněk snídaně).
 */
export function jeSuplementTvrdy(p: { nazev: string }): boolean {
  return SUPLEMENT_TVRDY_RE.test(p.nazev);
}

/** Tyčinky a proteinové nápoje – povolené jen jako svačina. */
export function jeSuplementSnack(p: { nazev: string }): boolean {
  return SUPLEMENT_SNACK_RE.test(p.nazev);
}

/** Libovolný suplement (tvrdý i svačinový). */
export function jeSuplement(p: { nazev: string }): boolean {
  return jeSuplementTvrdy(p) || jeSuplementSnack(p);
}

/**
 * Jediný povolený „suplement": obyčejný whey proteinový prášek –
 * smí jen jako ~odměrka navíc do vloček/jogurtu/tvarohu k snídani,
 * nikdy jako samostatné jídlo.
 */
export function jeWheyPrasek(p: { nazev: string }): boolean {
  return /whey|srv[áa]tkov|protein[ov]*[áaýeéy]?\s*pr[áa][šs]ek|(?:pr[áa][šs]ek|prasek)[^,]{0,15}protein/i.test(p.nazev);
}

/**
 * Sladkosti, dezerty a cukrovinky – reálný katalog (OpenFoodFacts)
 * jich obsahuje tisíce a jejich poměr makro:cena je lákavý, takže
 * by vyhrávaly sloty v plánu („Chocolat 85%" jako tuk oběda).
 * Cukrovinka není součást jídla – zakázáno ve všech typech jídel.
 * Záměrně NEobsahuje: croissant, müsli, sušené ovoce, popcorn,
 * džem – to jsou legitimní (byť sladké) potraviny.
 */
const JUNK_RE =
  /čokol[áa]d|chocolat|choco|cocoa|kakao(?!.*máslo)|lindor|lindt|pralin|bonb[oó]n|bonbonier|dražé|drazee|lokum|rahat|mochi|marshmallow|halva|nug[áa]t|marcip[áa]n|karamell|karamel|haribo|skittles|snickers|bounty|twix|kitkat|kit kat|kinder|raffaello|tic.?tac|mentos|bonpari|žuvač|zmrzlin|gelato|sorbet|nanuk|míša|kopečkov|pusink|mousse|pudink|puding|pudding|žel[ée](?!\w)|gelee|chips|crisps?d?\b|lupínk|lupinek|chipsy|perliv|neperliv|\bvoda\b|water\b|džus|juice|[šs][ťt][áa]v(?!n)|stava|kombucha|ice.?tea|k[áa]v|coffee|espresso|latt[ée]|cappuccino|macchiato|čaj(?!\w)|tea(?!\w)|nápoj|napitie|drink|ml[ée]ko|\bmilk\b|hrne[čc]k|limon[áa]d|cr[èe]me(?!.*fraiche)|tiramisu|cheesecake|brownie|muffin|cupcake|donut|doughnut|z[áa]kusk|dort|větrník|věneček|kremrol|piškot|sušenk|sušenek|biscuit|biscotti|cantuccin|baiocch|cookies?\b|keks|oplatk|oblátk|vafle|wafl|škubánek|mazanec|vánočk|str[úu]dl|kol[áa][čc]|frg[aá]l|bucht|perník|medovník|laskonk|kokosk|pařížsk|punčov|bábovk|tartalet|jelly|candy|fudge|brittle|truffle|mražen[ýáé]\s+(kr[ée]m|dort|jogurt|dezert|puding|smetan)|dezert|energy.?drink|cola|limon[áa]d|soda|fanta|sprite/i;

/** Sladkost/cukrovinka – nesmí do žádného jídla. */
export function jeJunk(p: { nazev: string }): boolean {
  return JUNK_RE.test(p.nazev);
}

/**
 * Nepotravinové položky, které se do katalogu dostaly z OpenFoodFacts
 * (kosmetika, drogerie, krmiva, tablety) – vyloučení ze všech jídel.
 */
const NEPOTRAVINA_RE =
  /s[ée]rum|pleťov|plet|kosmeti|šampon|m[ýy]dl|dezinfek|parf[ée]m|toaletn|prac[íi]\s|detergent|dopln[ěe]k stravy|tableta|kapsl|vitam[íi]n|probiotik|kolagen|omega.?3|hořčík|magnez|veterin[áa]r|granule pro|krmiv|pipet|antiparazit|odčerv|substr[aá]t|hnojiv|podest[ýy]l|pokojov[ée] rostlin|tr[áa]vn[íi]k|zahradni[čc]|insekticid|pesticid/i;

/** Nepotravina (kosmetika, drogerie, krmivo, tablety). Vejce
 * obohacená o omega-3 jsou potravina, ne doplněk stravy. */
export function jeNepotravinovy(p: { nazev: string }): boolean {
  return NEPOTRAVINA_RE.test(p.nazev) && !/vejc/i.test(p.nazev);
}

/** Alkohol – OFF katalog obsahuje i lihoviny; „37 % obj." nebo
 * Tatratea nemá co dělat v jídelníčku. Lookaheads hlídají falešné
 * zásahy: rump (steak), ginger/origin (gin), pivoňka (pivo). */
const ALKOHOL_RE =
  /%\s*(obj|vol)|alkohol|lik[ée]r|whisk|vodka|rum(?!\w)|tequila|absint|brandy|bourbon|cognac|gin(?!\w)|slivovic|borovičk|becherovk|fernet|tatratea|j[äa]germeister|v[íi]no(?!v[ýy])|vinn[ýy](?!\s+ocet)|prosecco|champagne|sekt(?!\w)|pivo(?!ň)|pilsner|lager|beer|ale(?!\w)|cider(?!\w)|medovin|burčák|portsk|sherry|vermut|martini|mojito|daiquiri|syrah|shiraz|merlot|cabernet|chardonnay|riesling|pinot|sauvignon|malbec|zinfandel|grenache|tempranillo|sangiovese|nebbiolo|frankovka|rulandsk|muškát|tramín|veltlin|chianti|rioja|bordeaux|nealkoholick[ée]\s*piv/i;

/** Zakázáno pro daný typ jídla:
 * – všude: nepotraviny, cukrovinky, tvrdé suplementy
 * – svačina navíc smí svačinové suplementy (tyčinka, protein drink) */
function zakazaneProTyp(p: { nazev: string }, typJ: TypJidla): boolean {
  return (
    jeNepotravinovy(p) ||
    jeJunk(p) ||
    ALKOHOL_RE.test(p.nazev) ||
    jeSuplementTvrdy(p) ||
    (typJ !== "svacina" && jeSuplementSnack(p))
  );
}

/** Zelenina / strana k hlavnímu jídlu (okurka, rajče, brokolice…).
 * Brambory/batáty záměrně NEJSOU v seznamu – to je sacharidová
 * příloha, ne zeleninová strana. */
const ZELENINA_RE =
  /ra[jčc][aá]t|rajče|okurk|brokolic|kv[ěe]t[áa]k|paprik|cuket|mrk[ev]|hl[áa]vkov[ýy]|ledov[ýy].?sal[áa]t|[šs]al[áa]t(?!.*(pomaz|maslov|s[ýy]rov))|zelenin|[čc]erven[áa].?řep|kuku[řr]ic|[šs]pen[áa]t|r[ůu]ži[čc]kov|celer(?!.*(nať|nat))|fazolov|hr[áa][šs]ek|kapusta|kapust|ch[řr]est|houb|[žž]ampion|avok[áa]d|olivy|fazol/i;

/** Složené produkty, které zeleninu jen „obsahují" – müsli s mrkví,
 * polévková směs nebo džus není zeleninová strana jídla. */
const ZELENINA_ANTI_RE =
  /müsli|musli|granola|kaše|vlo[čc]k|pudink|pudding|džus|juice|[šs][ťt][áa]v(?!n)|stava|džem|marmel|kompot|mošt|sirup|nápoj|dražé|lokum|halva|čokol|choco|krém|pomaz|paštik|terrin|polévk|v[ýy]var|n[áa]pl[ňn]|polev|těstovin|r[ýy]ž|kn[ěe]dlík|pizz|tortill|wrap|chips|crisps|burger|om[áa][čc]k|risott|rizoto|tortel|raviol|agnolott|kroužk|smetan|n[áa]kyp|dupetk|krekr|crack|sušen.*(ananas|mango|ban[áa]n|datl|rozink|brusink|meruňk|fík|švestk|brosk|jahod|malin|bor[ůu]vk|hrozink)|tyčink|croissant|smoothie|pasta\b|topink|crouton|stir.?fry|crispbread|knuspi|kn[äa]cke/i;

/** Luštěniny jako zeleninová strana – jedí se, ale na talíři
 * strany prohrávají s opravdovou zeleninou (rajče, okurka,
 * salát). Měkký malus, ne zákaz – na chudém katalogu zůstanou. */
const ZELENINA_LUSK_RE = /fazol|[čc]očk|cizrn|hrach|hr[áa][šs]ek|urid|lentil|edamame/i;

/** Minimální obsah bílkovin pro kotvu jídla (g/100 g) – listová
 * zelenina a nálevy (špenát ~3 g, kysané zelí ~1 g, banánový květ)
 * vypadají „bilkovinově" jen poměrem B:kcal, ale jídlo neukotví.
 * Tofu/seitan/tvaroh/vejce/tempeh (≥8 g) prochází. */
const MIN_B_KOTVA = 4;

/** Opravdová zelenina – preferovaná strana oběda/večeře. */
const ZELENINA_SKUTECNA_RE =
  /ra[jčc][aá]t|rajče|okurk|brokolic|kv[ěe]t[áa]k|paprik|cuket|mrk[ev]|hl[áa]vkov[ýy]|ledov[ýy].?sal[áa]t|[šs]al[áa]t|[čc]erven[áa].?řep|kuku[řr]ic|[šs]pen[áa]t|r[ůu]ži[čc]kov|celer|kapusta|kapust|ch[řr]est|houb|[žž]ampion|avok[áa]d|olivy|zelenin/i;

/* ------------------------------------------------------------
 * Realistické porce – žádné „94 g instantní polévky" nebo
 * „30 g rýže". Každá role má krok a rozmezí lidské porce.
 * ------------------------------------------------------------ */

/** Váhy kusů běžných potravin (g) – porce se počítá v celých kusech. */
const KUSOVA_PORCE: [RegExp, number][] = [
  [/vejce|vejec/i, 60],
  [/chlebíč(?!kov)|kn[aä]cke|k[řr]upav[éeáý]?\s+(pe[čc]iv|chleb|kn[äa]cke)/i, 10],
  [/rohl[íi]k/i, 43],
  [/chl[ée]b(?!íč|i[čc]k|ovn)|chleba/i, 40],
  [/housk/i, 55],
  [/kaiserk/i, 50],
  [/dalam[aá]nek|rožek|rozek/i, 45],
  [/veka/i, 70],
  [/toast|toust/i, 35],
  [/tortill|wrap/i, 65],
  [/ban[áa]n(?!ov)/i, 120],
  [/jablk/i, 170],
  [/hru[šs]k/i, 160],
  [/pomeran[čc]/i, 150],
  [/mandarink/i, 80],
  [/kiwi/i, 75],
  [/avok[áa]d/i, 150],
  [/ty[čc]ink|\bbar\b|k[řr]upav[aá].?ty[čc]/i, 45],
];

/** Váha jednoho kusu kusové potraviny (null u vážených). Kusové
 * slovo musí být v prvních dvou slovech – „Müsli mrkev a jablko"
 * není 170 g kus jablka, ale 40 g kaše. */
export function kusovaGramaz(nazev: string): number | null {
  // pomazánky/paštiky/džemy nejsou kusové – „Pomerančovo-bezová
  // pomazánka" nesmí dostat 150 g kus pomeranče (celá sklenice)
  if (/pomaz|paštik|terrin|marmel|džem|krém|om[áa][čc]k|hummus|humus/i.test(nazev)) return null;
  const hlava = nazev.split(/\s+/).slice(0, 2).join(" ");
  for (const [re, vaha] of KUSOVA_PORCE) {
    if (re.test(hlava)) return vaha;
  }
  return null;
}

const MASO_RYBA_RE =
  /maso|ku[řr]ec|kr[ůu]t|vep[řr]|hov[ěe]z|telec|jehn[ěe]|kr[áa]l[íi]k|kan[čc]|prso|prsa|steak|file|mlet[éeý]|losos|tu[ňn][aá]k|tresk|pstruh|kapr|sle[ďd]|makrel|tilapi|sardink|krevet|kalam[aá]r|krab|tofu|tempeh|seitan|[šs]unk(?!.*pomaz)|klob[aá]s/i;

const MLECNE_RE =
  /jogurt|skyr|tvaroh|cottage|kef[íi]r|ml[ée]k|zakysan|acidofiln|lip[áa]nek|smetanov[ýy] n[áa]poj/i;

const SUCHE_SACH_RE =
  /r[ýy]ž|t[ěe]stovin|spaget|penne|fusilli|nudl|kuskus|bulgur|quino|tarho[ňn]|pohank|jahel|vlo[čc]k|ovsen|müsli|musli|granola|krupič|cereal|kornflejk|cornflakes|kn[aä]cke|k[řr]upav|křupk|ka[šs](?!tan|mír|el)/i;

const OLEJ_TUK_RE =
  /\b(olej|olio|oil|oel|olaj|öl)\b|olivov.*olej|m[áa]slo|gh[íi]|ghee|s[áa]dl|tuk[^ ]* rozt|napraforg|sonnenblumen|huile|margarin|hera\b|perla\b|flora\b|majon[eé]z|mayonnaise|mayo\b/i;

/**
 * Zaokrouhlí gramáž na praktickou porci podle role a typu potraviny:
 *   – kusové: celé kusy (2 vejce = 120 g, 1 banán = 120 g)
 *   – maso/ryby/tofu: krok 10 g, porce 80–250 g
 *   – mléčné kelímky: krok 50 g (150 g jogurt, 250 g tvaroh)
 *   – suché sacharidy: krok 10 g; hlavní jídlo 50–160 g, snídaně 30–120 g
 *   – tukové doplňky: krok 5 g, olej max 20 g, ořechy/sýr max 45 g
 *   – zelenina: 50–150 g; whey doplněk: 15–30 g
 * Vrací „hezká" čísla – denní solver pak doladí zbytek maker.
 */
export function zaokrouhliGramaz(
  p: { nazev: string },
  gramy: number,
  role: RoleJidla = "kotva",
  typJ: TypJidla = "obedVecere",
  povolitPodMin = false,
): number {
  const kusG = kusovaGramaz(p.nazev);
  if (kusG !== null) {
    const maxKs = role === "kotva" ? 4 : role === "zelenina" ? 2 : 3;
    return Math.min(Math.max(1, Math.round(gramy / kusG)), maxKs) * kusG;
  }

  let krok = 10;
  let min = 20;
  let max = 300;
  if (role === "zelenina") {
    krok = 10; min = 50; max = 150;
  } else if (role === "suplement") {
    krok = 5; min = 15; max = 30;
  } else if (role === "tuk") {
    if (OLEJ_TUK_RE.test(p.nazev) && jePrisada(p)) {
      krok = 5; min = 5; max = 20;   // 10 g olivového oleje, ne 47 g
    } else if (MASO_RYBA_RE.test(p.nazev)) {
      krok = 10; min = 30; max = 100; // 30 g uzeného lososa, ne 10 g nitě
    } else {
      krok = 5; min = 10; max = 45;  // 20 g mandlí, 30 g nivy
    }
  } else if (role === "sacharid") {
    if (SUCHE_SACH_RE.test(p.nazev)) {
      krok = 10;
      min = typJ === "obedVecere" ? 50 : typJ === "snidane" ? 30 : 20;
      max = typJ === "obedVecere" ? 160 : 120;
    } else {
      krok = 10; min = 20; max = 250; // brambory, pečivo, ovoce
    }
  } else {
    // kotva
    if (/sušen[éáa]\s+(maso|ryb|tuň|hov[ěe]z|kr[ůu]t|vep[řr]|jehn[ěe])|jerky|biltong|pemikan|pemmican/i.test(p.nazev)) {
      krok = 10; min = 30; max = 60;  // jerky ~70 g B/100 g – 80 g porce = 56 g bílkovin
    } else if (MASO_RYBA_RE.test(p.nazev)) {
      krok = 10; min = 80; max = 250;
    } else if (MLECNE_RE.test(p.nazev)) {
      krok = 50; min = 100; max = 300;
    } else {
      krok = 10; min = 40; max = 300;
    }
  }
  // krácení solveru smí jít pod servírovací minimum, ne však pod
  // jeho polovinu – 60 g sušeného masa je pořád jídlo, 10 g nitě
  // jako „kotva oběda" ne
  if (povolitPodMin) min = Math.max(krok, Math.round(min / 2 / krok) * krok);
  return Math.max(min, Math.min(Math.round(gramy / krok) * krok, max));
}

/** Popisek porce pro kusové potraviny: „2 ks · 120 g" (jinak undefined). */
function popisekKusu(nazev: string, gramy: number): string | undefined {
  const kusG = kusovaGramaz(nazev);
  if (kusG === null) return undefined;
  const ks = Math.max(1, Math.round(gramy / kusG));
  return `${ks} ks · ${ks * kusG} g`;
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
  vhodnostRe: RegExp | null = null,
  nevhodnostRe: RegExp | null = null,
  pouziteKlice: Set<string> = new Set(),
  minuleDny: ReadonlyMap<string, number> = new Map(),
): Kandidat | null {
  if (kandidati.length === 0) return null;

  // 1) preferujeme potraviny, které dnes dosud nebyly
  const nove = kandidati.filter((p) => !pouziteId.includes(p.id));
  if (nove.length > 0) {
    kandidati = nove;
  }

  // 1b) a nejen to – preferujeme i potraviny, jejichž „rodina" se dnes
  //     neobjevila: „Sušené maso hovězí" i „Sušené maso krůtí" je pořád
  //     sušené maso. Bez klíčů kandidátů filtr přeskočíme.
  const bezRodiny = kandidati.filter((p) => !pouziteKlice.has(klicPodobnosti(p.nazev)));
  if (bezRodiny.length > 0) {
    kandidati = bezRodiny;
  }

  // 2) rotujeme jen mezi cenově srovnatelnými kandidáty.
  //    vhodnostRe: kulinářsky vhodné potraviny dostanou bonus ×2,5 při
  //    posuzování srovnatelnosti (vhodná potravina „dotáhne" až 2,5×
  //    horší poměr cena:makro) a mezi srovnatelnými pak rotují pouze
  //    vhodné. nevhodnostRe působí opačně – ×0,4 v srovnatelnosti
  //    (tyčinka u kotvy oběda, špagety v příloze svačiny).
  //    Nevhodné se vrátí, jen když vhodné nekandidují – plán
  //    je gastronomický, když to cena dovoluje, a funkční vždy.
  const BONUS_VHODNOSTI = 2.5;
  const MALUS_NEVHODNOSTI = 0.4;
  const MALUS_MINULE_DNY = 0.5;
  // fantómové kcal: deklarované kcal převyšují součet maker o víc
  // než ~18 % (typicky konzerva, kde kcal počítají i nálev a makra
  // ne – 240 g sardiniek = +150 kcal mimo solver). Konzistentní
  // položky mají přednost, když jsou srovnatelné
  const MALUS_FANTOM = 0.5;
  const fantomMalus = (p: Kandidat) => {
    const mk = 4.1 * (p.bilkoviny + p.sacharidy) + 9.3 * p.tuky;
    return p.kalorie - mk > Math.max(15, p.kalorie * 0.18) ? MALUS_FANTOM : 1;
  };
  const jeVhodny = (p: Kandidat) => vhodnostRe !== null && vhodnostRe.test(p.nazev);
  const jeNevhodny = (p: Kandidat) => nevhodnostRe !== null && nevhodnostRe.test(p.nazev);
  // rodina už použitá v předchozích dnech týdne – malus se stupňuje
  // podle počtu použití (×0,5 po 1. dni, ×0,25 po 2., ×0,125 po 3.) –
  // jinak by nejvýhodnější položka kotvila týden pořád dokola
  const minuleKolikrat = (p: Kandidat) => minuleDny.get(klicPodobnosti(p.nazev)) ?? 0;
  const nejlepsi = kandidati.reduce((m, p) => Math.max(m, p.skore), 0);
  if (nejlepsi > 0) {
    const srovnatelni = kandidati.filter(
      (p) =>
        p.skore *
          (jeVhodny(p) ? BONUS_VHODNOSTI : 1) *
          (jeNevhodny(p) ? MALUS_NEVHODNOSTI : 1) *
          fantomMalus(p) *
          Math.pow(MALUS_MINULE_DNY, minuleKolikrat(p)) >=
        nejlepsi * poolMin,
    );
    if (srovnatelni.length > 0) {
      kandidati = srovnatelni;
    }
  }
  if (vhodnostRe !== null) {
    const vhodni = kandidati.filter(jeVhodny);
    if (vhodni.length > 0) {
      kandidati = vhodni;
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

/**
 * Je jednotková cena (Kč/100 g) vůbec uvěřitelná? Scraper normalizuje
 * balením, ale občas vznikne artefakt:
 *   – celé balení pod ~4 Kč (tyčinka „4,75 Kč za 95 g" – pack-mismatch
 *     při normalizaci; nic se v ČR za 3 Kč nekoupí)
 *   – pod 0,7 Kč/100 g (pod 7 Kč/kg není ani mouka – jde o omyl
 *     Kč/kg→100 g; brambory ~1,5 Kč/100 g záměrně procházejí)
 *   – nad 400 Kč/100 g (40 000 Kč/kg – jen artefakt, ani šafrán tolik
 *     v potravinovém katalogu nemá)
 *   – aktuální cena pod 35 % běžné ceny (sleva >65 % není reálná akce,
 *     ale rozbijená normalizace – souhlasí s pravidlem migrace 0052,
 *     která ověřené původní ceny omezuje na ≤2,5× aktuální)
 * Takovou cenu jídlu NEpřičítáme – položka se tváří jako neceněná
 * (UI ukáže „—") místo toho, aby plán ukazoval nereálnou cifru.
 */
export function jeCenaSpolehliva(p: Potravina): boolean {
  const c = p.aktualniCena;
  if (!Number.isFinite(c) || c < 0.7 || c > 400) return false;
  const b = p.baleniG;
  if (b != null && b >= 20 && (c * b) / 100 < 4) return false;
  // „sleva" hlubší než 65 % = téměř jistě unit-artefakt, ne akce
  if (Number.isFinite(p.beznaCena) && p.beznaCena > 0 && c < p.beznaCena * 0.35) {
    return false;
  }
  // bílkovinové stálice pod 4 Kč/100 g (40 Kč/kg) – symetrický unit
  // omyl, který podíl cena:běžná nepozná (ani tvaroh/kuře tolik nemůže
  // stát; mléko a levné sacharidy záměrně neomezujeme)
  if (
    c < 4 &&
    /maso|ku[řr]ec|kr[ůu]t|vep[řr]|hov[ěe]z|telec|jehn[ěe]|prso|prsa|steak|file|mlet[éeý]|losos|tu[ňn][aá]k|tresk|pstruh|kapr|sle[ďd]|makrel|tilapi|sardink|krevet|kalam[aá]r|tofu|tempeh|seitan|[šs]unk|sal[áa]m|p[áa]tek|slanin|s[ýy]r|tvaroh|cottage|skyr|eidam|mozzarell|parmaz[áa]n|niva|hermel[íi]n|vejce|vaj[íi][čc]/i.test(
      p.nazev,
    )
  ) {
    return false;
  }
  return true;
}

/** Vytvoří položku jídelníčku z potraviny a počtu gramů. */
export function vytvorJidlo(p: Potravina, gramy: number): Jidlo {
  const k = gramy / 100;
  // nespoledlivá cena → položka neceněná (cena 0 → UI ukáže „—")
  const cenaOk = jeCenaSpolehliva(p);
  const puvodni =
    cenaOk && p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena
      ? p.puvodniCena
      : null;
  const slevaOk = puvodni !== null;
  return {
    id: p.id,
    nazev: p.nazev,
    gramy,
    kalorie: Math.round(p.kalorie * k),
    bilkoviny: Math.round(p.bilkoviny * k * 10) / 10,
    sacharidy: Math.round(p.sacharidy * k * 10) / 10,
    tuky: Math.round(p.tuky * k * 10) / 10,
    cena: cenaOk ? Math.round(p.aktualniCena * k * 100) / 100 : 0,
    // úspora se počítá jen ze zdrojem ověřené původní ceny – bez ní
    // cenaBezna = aktuální cena (ušetřeno 0, žádný odhad z mediánu)
    cenaBezna: cenaOk
      ? Math.round((puvodni ?? p.aktualniCena) * k * 100) / 100
      : 0,
    obchod: slevaOk ? p.obchod : null,
    sleva: slevaOk,
    obrazek: p.obrazek ?? null,
    baleniG: p.baleniG ?? null,
  };
}

/**
 * Naplánuje jednotlivé jídlo ze 4 kroků:
 *   1. „kotva" = bílkovinová potravina (kvantita podle bílkovin)
 *   2. doplněk sacharidů (hlavní jídla vždy čistá příloha – rýže,
 *      brambory, těstoviny, pečivo; snídaně kaše/pečivo/ovoce)
 *   3. doplněk tuků (jen když zbývá potřeba i kalorický prostor)
 *   4. oběd/večeře: zeleninová strana; snídaně: volitelný whey doplněk
 * Suplementy jsou z hlavních jídel vyloučené tvrdě (tyčinka k obědu
 * není jídlo); svačině se tvrdé suplementy zakazují, tyčinka projde.
 * Gramáž se zaokrouhluje na praktické porce (kusy, 10/50 g kroky) –
 * zbytek maker pořeší denní solver ve vygenerujJidelnicek.
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
  nazevJidla = "",
  pouziteKlice: Set<string> = new Set(),
  minuleDny: ReadonlyMap<string, number> = new Map(),
  vynutitNepouzite = false,
): Jidlo[] {
  const jidla: Jidlo[] = [];
  // Kulinářská vhodnost podle ROLE v jídle: kotva, příloha a tukový
  // doplněk mají vlastní preference + protivzory (tyčinka není oběd,
  // špagety nejsou svačina). Vše měkké – bez kandidátů plný pool.
  const typJ = typJidlaZ_nazvu(nazevJidla);
  const zakazane = (p: { nazev: string }) => zakazaneProTyp(p, typJ);
  const reKotva = typJ === "snidane" ? SNIDANE_RE : typJ === "svacina" ? SVACINA_RE : OBED_VECERE_RE;
  const antiKotva = kotvaAntiRe(typJ);
  const rePriloha = typJ === "snidane" ? SNIDANE_RE : typJ === "svacina" ? SVACINA_RE : PRILOHA_RE;
  const antiPriloha =
    typJ === "svacina" ? TEPLE_PRILOHY_RE : typJ === "obedVecere" ? SNIDANOVA_PRILOHA_ANTI_RE : null;
  const reTuk = reKotva; // tukový doplněk sdílí typ jídla (ořechy/sýr/olivy)
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

  /** u výměny jídla (vynutitNepouzite) nesmí fallback na vyberKandidata
   * vrátit již použitou potravinu – doplněk raději vynecháme než zopakovat */
  const jenNepouzite = <T extends Kandidat | null>(k: T): Kandidat | null =>
    vynutitNepouzite && k !== null && pouziteId.includes(k.id) ? null : k;

  const oznac = (p: Potravina) => {
    pouziteId.push(p.id);
    pouziteKlice.add(klicPodobnosti(p.nazev));
  };

  const pridej = (p: Potravina, gramy: number, role: RoleJidla) => {
    oznac(p);
    const jidlo = vytvorJidlo(p, gramy);
    jidlo.role = role;
    const popisek = popisekKusu(p.nazev, gramy);
    if (popisek) jidlo.popisekMnozstvi = popisek;
    jidla.push(jidlo);
    zbyva.b -= jidlo.bilkoviny;
    zbyva.s -= jidlo.sacharidy;
    zbyva.t -= jidlo.tuky;
    zbyva.k -= jidlo.kalorie;
  };

  /** odpočet rozpočtu + označení – zelenina se do výpisu přidá až za tukem */
  const odecti = (p: Kandidat, gramy: number) => {
    oznac(p);
    zbyva.b -= (p.bilkoviny * gramy) / 100;
    zbyva.s -= (p.sacharidy * gramy) / 100;
    zbyva.t -= (p.tuky * gramy) / 100;
    zbyva.k -= (p.kalorie * gramy) / 100;
  };

  // --- 1. kotva (bílkovinová potravina) ---
  // Když jsou všechny bílkovinové potraviny dnes použité (malý katalog,
  // třeba filtr bezlepkovy), ukotvíme jídlo nevyužitou potravinou s nejvyšším
  // obsahem bílkovin z jiných kategoriích (sýry, čočka…) – jinak by se kotva
  // opakovala v každém jídle. Suroviny ani suplementy kotvou být nesmí.
  let kotva: Kandidat | null;
  const bilkNePrisady = kategorie.bilkovinova.filter((p) => !jePrisada(p) && !zakazane(p));
  const bilkZdroje = bilkNePrisady.filter((p) => p.bilkoviny >= MIN_B_KOTVA);
  const bilkovinyJidle = bilkZdroje.length > 0 ? bilkZdroje : bilkNePrisady;
  const bilkNePrisadyVse = kategorie.bilkovinova.filter((p) => !jePrisada(p));
  const bilkZdrojeVse = bilkNePrisadyVse.filter((p) => p.bilkoviny >= MIN_B_KOTVA);
  const bilkovinyBezPrisad = bilkZdrojeVse.length > 0 ? bilkZdrojeVse : bilkNePrisadyVse;
  const bilkovinyPool =
    bilkovinyJidle.length > 0
      ? bilkovinyJidle
      : typJ === "svacina"
        ? bilkovinyBezPrisad // svačina: i tyčinka může být kotva
        : bilkovinyJidle;    // hlavní jídla: raději žádná kotva než tyčinka
  if (bilkovinyPool.some((p) => !pouziteId.includes(p.id))) {
    kotva = vyberKandidata(bilkovinyPool, poradi, pouziteId, denniPosun, poolMin, reKotva, antiKotva, pouziteKlice, minuleDny);
  } else {
    const nahradni = [...kategorie.tukova, ...kategorie.sacharidova]
      .filter((p) => !pouziteId.includes(p.id) && !jePrisada(p) && !zakazane(p))
      .sort((a, b) => b.bilkoviny - a.bilkoviny);
    kotva =
      vyberKandidata(nahradni.slice(0, 3), poradi, pouziteId, denniPosun, 0.5, reKotva, antiKotva, pouziteKlice, minuleDny) ??
      vyberKandidata(bilkovinyPool, poradi, pouziteId, denniPosun, poolMin, reKotva, antiKotva, new Set(), minuleDny) ??
      vyberKandidata(kategorie.sacharidova.filter((p) => !zakazane(p)), poradi, pouziteId, denniPosun, poolMin, reKotva, antiKotva, new Set(), minuleDny);
  }
  kotva = jenNepouzite(kotva);
  if (kotva !== null && zbyva.b >= 5) {
    // hlavní jídlo je talíř – hutná kotva (sušený mix ~350 kcal/100 g)
    // si nesmí vzít celý rozpočet, jinak nezbude na přílohu a zeleninu
    let gramyKotva = gramace(kotva, "bilkoviny", zbyva.b, 30, 400);
    if (typJ === "obedVecere") {
      gramyKotva = Math.min(gramyKotva, Math.floor((zbyva.k * 0.7) / (Math.max(kotva.kalorie, 1) / 100)));
    }
    pridej(kotva, zaokrouhliGramaz(kotva, gramyKotva, "kotva", typJ), "kotva");
  }

  // --- 2a. zelenina – oběd/večeře se vždy skládá jako talíř:
  // bílkovina + komplexní sacharid + tuk + zeleninová strana.
  // Vybírá se HNED po kotvě, než příloha spotřebuje kalorický
  // rozpočet. Rozpočet se odečte TEĎ, do výpisu jde položka až
  // za tuk – pořadí talíře.
  let zelenina: [Kandidat, number] | null = null;
  if (typJ === "obedVecere" && zbyva.k >= 50) {
    const zelPool = kategorie.sacharidova.filter(
      (p) =>
        ZELENINA_RE.test(p.nazev) &&
        !ZELENINA_ANTI_RE.test(p.nazev) &&
        // zeleninová strana má ~15–130 kcal/100 g – „zeleninová směs"
        // s omáčkou za 433 kcal/100 g je hotové jídlo, ne strana
        p.kalorie <= 150 &&
        !jePrisada(p) &&
        !zakazane(p),
    );
    const zel = jenNepouzite(
      vyberKandidata(
        zelPool,
        poradi,
        pouziteId,
        denniPosun,
        poolMin,
        ZELENINA_SKUTECNA_RE,
        ZELENINA_LUSK_RE,
        pouziteKlice,
        minuleDny,
      ),
    );
    if (zel !== null) {
      const cilovaG = Math.min(130, zbyva.k / (Math.max(zel.kalorie, 1) / 100));
      if (cilovaG >= 30) {
        const gramy = zaokrouhliGramaz(zel, cilovaG, "zelenina", typJ);
        zelenina = [zel, gramy];
        odecti(zel, gramy);
      }
    }
  }

  // --- 2. doplněk sacharidů ---
  // Sacharidový doplněk nechceme „přeflakovat" dalšími bílkovinami,
  // proto preferujeme potraviny s nízkým obsahem bílkovin
  // (rýže a vločky, ne čočka), existují-li mezi kandidáty.
  // Suroviny (cukr, mouka) ani suplementy z výběru vylučujeme.
  // Oběd/večeře: tvrdě čistá příloha (rýže, brambory, těstoviny, pečivo);
  // snídaně: snídaňové sacharidy (vločky, pečivo, ovoce).
  let kandidatiS = kategorie.sacharidova;
  const realneSacharidy = kandidatiS.filter((p) => !jePrisada(p) && !zakazane(p));
  if (realneSacharidy.length > 0) {
    kandidatiS = realneSacharidy;
  }
  const nizkoproteinovi = kandidatiS.filter((p) => p.bilkoviny <= 15.0);
  if (nizkoproteinovi.length > 0) {
    kandidatiS = nizkoproteinovi;
  }
  if (typJ === "obedVecere") {
    const prilohove = kandidatiS.filter(
      (p) => PRILOHA_RE.test(p.nazev) && !PRILOHA_ANTI_RE.test(p.nazev),
    );
    if (prilohove.length > 0) kandidatiS = prilohove;
  } else if (typJ === "snidane") {
    const snidanove = kandidatiS.filter((p) => SNIDANE_RE.test(p.nazev) && !SNIDANOVA_PRILOHA_ANTI_RE.test(p.nazev));
    if (snidanove.length > 0) kandidatiS = snidanove;
  }
  const dopln = jenNepouzite(
    vyberKandidata(kandidatiS, poradi, pouziteId, denniPosun, poolMin, rePriloha, antiPriloha, pouziteKlice, minuleDny),
  );
  if (dopln !== null && zbyva.s >= 10 && zbyva.k >= 60) {
    pridej(dopln, zaokrouhliGramaz(dopln, gramace(dopln, "sacharidy", zbyva.s, 30, 350), "sacharid", typJ), "sacharid");
  }

  // --- 3. doplněk tuků ---
  // Preferujeme skutečné potraviny (ořechy, avokádo, sýry); suroviny
  // (olej, máslo, sádlo) bereme jen jako rezervu – 10–20 g oleje
  // k pokrmu smysl dává, 90 g už ne.
  const tukBezPrisad = kategorie.tukova.filter(
    (p) => !jePrisada(p) && !zakazane(p) && !TUK_ANTI_RE.test(p.nazev),
  );
  // přísady (olej, máslo, omáčka) jako tukový doplněk dávají smysl jen
  // k hlavnímu jídlu – 40 g majonézy ke svačině není svačina
  const tukPool =
    tukBezPrisad.length > 0
      ? tukBezPrisad
      : typJ === "obedVecere"
        ? kategorie.tukova.filter((p) => !zakazane(p) && !TUK_ANTI_RE.test(p.nazev))
        : [];
  const tukovina = jenNepouzite(
    vyberKandidata(
      tukPool,
      poradi,
      pouziteId,
      denniPosun,
      poolMin,
      reTuk,
      TUK_ANTI_RE,
      pouziteKlice,
      minuleDny,
    ),
  );
  if (tukovina !== null && zbyva.t >= 8 && zbyva.k >= 80) {
    pridej(tukovina, zaokrouhliGramaz(tukovina, gramace(tukovina, "tuky", zbyva.t, 20, jePrisada(tukovina) ? 30 : 100), "tuk", typJ), "tuk");
  }

  if (zelenina !== null) {
    pridej(zelenina[0], zelenina[1], "zelenina");
  }
  // --- 4. whey doplněk – jediný povolený suplement: malá odměrka
  // do snídaňových vloček/jogurtu/tvarohu, když bílkoviny chybí.
  // Nikdy samostatné jídlo, nikdy v jiném slotu.
  if (typJ === "snidane" && zbyva.b >= 8 && zbyva.k >= 60) {
    const wheyPool = kategorie.bilkovinova.filter(
      (p) => jeWheyPrasek(p) && !pouziteId.includes(p.id),
    );
    const whey = jenNepouzite(
      vyberKandidata(wheyPool, poradi, pouziteId, denniPosun, poolMin, null, null, pouziteKlice, minuleDny),
    );
    if (whey !== null) {
      pridej(
        whey,
        zaokrouhliGramaz(whey, zbyva.b / (Math.max(whey.bilkoviny, 1) / 100), "suplement", typJ),
        "suplement",
      );
    }
  }

  return jidla;
}

/** Medián spolehlivých cen jako „typická cena" pro neceněné položky. */
function medianCeny(potraviny: Potravina[]): number {
  const ceny = potraviny.filter(jeCenaSpolehliva).map((p) => p.aktualniCena).sort((a, b) => a - b);
  if (ceny.length === 0) return 15; // celý katalog bez cen – rozumná výchozí Kč/100g
  return ceny[Math.floor(ceny.length / 2)]!;
}

/**
 * Fyzikálně možná výživa: součet maker nesmí přesáhnout ~100 g na 100 g
 * (malá rezerva na zaokrouhlování a vlákninu v datech OFF).
 */
export function jeNutrienceSpolehliva(p: {
  bilkoviny: number;
  sacharidy: number;
  tuky: number;
}): boolean {
  return p.bilkoviny + p.sacharidy + p.tuky <= 105;
}

/** Seřadí potraviny dle skóre a vrátí kategorie kandidátů. */
function pripravKategorie(potraviny: Potravina[]): KategorieMap {
  const kategorie: KategorieMap = { bilkovinova: [], sacharidova: [], tukova: [] };
  const median = medianCeny(potraviny);

  // nemožné nutriční hodnoty z OFF (chybně zadané za 100 g) nesmí do výběru
  const spolehlive = potraviny.filter(jeNutrienceSpolehliva);
  const zaklad = spolehlive.length > 0 ? spolehlive : potraviny;

  for (const p of zaklad) {
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
  minuleDny: ReadonlyMap<string, number> = new Map(),
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
  // mapa id → kandidát pro denní solver (přepočet gramáží z /100 g)
  const podleId = new Map<string, Kandidat>();
  for (const pool of Object.values(kategorie)) {
    for (const k of pool) podleId.set(k.id, k);
  }

  const jidelnicek: Record<string, SouhrnJidla> = {};
  const pouziteId: string[] = [];
  const pouziteKlice = new Set<string>();
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
      nazevJidla,
      pouziteKlice,
      minuleDny,
    );

    jidelnicek[nazevJidla] = souhrnJidla(jidla);
    poradi++;
  }

  // denní solver – jídelní porce se skládají lokálně, díry do cílů
  // (±3 % kcal, ±5 % B/S/T) doladí celodenní pohled
  doladujDen(jidelnicek, podily, cileCiste, podleId, kategorie, pouziteId, pouziteKlice, denniPosun, poolMin, minuleDny);

  const celkem: SouhrnJidlaBezJidel = {
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };
  for (const souhrn of Object.values(jidelnicek)) {
    celkem.kalorie += souhrn.kalorie;
    celkem.bilkoviny += souhrn.bilkoviny;
    celkem.sacharidy += souhrn.sacharidy;
    celkem.tuky += souhrn.tuky;
    celkem.cena += souhrn.cena;
    celkem.cenaBezna += souhrn.cenaBezna;
  }

  celkem.kalorie = Math.round(celkem.kalorie);
  celkem.bilkoviny = Math.round(celkem.bilkoviny * 10) / 10;
  celkem.sacharidy = Math.round(celkem.sacharidy * 10) / 10;
  celkem.tuky = Math.round(celkem.tuky * 10) / 10;
  celkem.cena = Math.round(celkem.cena * 100) / 100;
  celkem.cenaBezna = Math.round(celkem.cenaBezna * 100) / 100;

  return { jidelnicek, celkem };
}

/* ============================================================
 * DENNÍ SOLVER – dolaďování maker přes celý den
 * ============================================================ */

/**
 * Skládání jídla z lokálních podílů nechává díry do denních cílů
 * (velikosti porcí, stropy maker). Solver postupuje jako dietolog:
 *   1) přeškáluje bílkovinové kotvy → 2) sacharidové přílohy
 *   3) tukové doplňky; 4) když porce narazí na reálné stropy,
 *      přidá do jídla s největším kalorickým prostorem celou
 *      potravinu (vejce, ořechy, olej, pečivo).
 * Cíl: ±3 % kcal, ±5 % na B/S/T. Max 4 průchody – pak vrátí
 * nejbližší dosažitelný stav (malý katalog = menší přesnost).
 */
function doladujDen(
  jidelnicek: Record<string, SouhrnJidla>,
  podily: Record<string, number>,
  cile: Cile,
  podleId: Map<string, Kandidat>,
  kategorie: KategorieMap,
  pouziteId: string[],
  pouziteKlice: Set<string>,
  denniPosun: number | null,
  poolMin: number,
  minuleDny: ReadonlyMap<string, number>,
): void {
  if (cile.kalorie <= 0) return;

  const vTol = (chyba: number, cil: number, tol: number) =>
    Math.abs(chyba) <= Math.max(1.5, cil * tol);
  const TOL_MAKRO = 0.05;
  const TOL_KCAL = 0.03;

  const soucty = () => {
    let b = 0, s = 0, t = 0, k = 0;
    for (const souhrn of Object.values(jidelnicek)) {
      b += souhrn.bilkoviny;
      s += souhrn.sacharidy;
      t += souhrn.tuky;
      k += souhrn.kalorie;
    }
    return { b, s, t, k };
  };

  const prepocitej = (souhrn: SouhrnJidla) => {
    const n = souhrnJidla(souhrn.jidla);
    souhrn.kalorie = n.kalorie;
    souhrn.bilkoviny = n.bilkoviny;
    souhrn.sacharidy = n.sacharidy;
    souhrn.tuky = n.tuky;
    souhrn.cena = n.cena;
    souhrn.cenaBezna = n.cenaBezna;
  };

  /** přeškáluje položky dané role; chyba >0 navyšuje, <0 krátí.
   * Krácení začíná u NEJTĚŽŠÍHO jídla vůči svému podílu a navyšování
   * u NEJLEHČÍHO – jinak se stává, že oběd dostane 40 g masa,
   * zatímco snídaně drží přetlak. */
  const doskaluj = (role: RoleJidla[], makro: "bilkoviny" | "sacharidy" | "tuky", chyba: number): boolean => {
    let zmena = false;
    const razeni = serazenaJidla();
    const poradi = chyba < 0 ? [...razeni].reverse() : razeni;
    for (const cil of poradi) {
      if (Math.abs(chyba) < 0.5) break;
      const souhrn = cil.s;
      let souhrnZmena = false;
      for (const j of souhrn.jidla) {
        if (Math.abs(chyba) < 0.5) break;
        if (!role.includes(j.role ?? "kotva")) continue;
        const p = podleId.get(j.id);
        if (!p) continue;
        const naGram = Math.max(p[makro], 0.1) / 100;
        const stara = j[makro];
        const nova = zaokrouhliGramaz(
          p,
          j.gramy + chyba / naGram,
          j.role ?? "kotva",
          cil.typJ,
          chyba < 0,
        );
        if (nova === j.gramy) continue;
        const nove = vytvorJidlo(p, nova);
        // položka kvantizovaná na porci nesmí reziduum přestřelit o
        // víc než dvojnásob – 8 g krok rýže by –0,7 g sacharidů
        // rozhoupal přes celou toleranční pásmo (zmenšit + zvětšit)
        if (Math.abs(nove[makro] - stara) > Math.abs(chyba) * 2 + 0.5) continue;
        if (j.role !== undefined) nove.role = j.role;
        const popisek = popisekKusu(p.nazev, nova);
        if (popisek !== undefined) nove.popisekMnozstvi = popisek;
        Object.assign(j, nove);
        chyba -= j[makro] - stara;
        zmena = true;
        souhrnZmena = true;
      }
      if (souhrnZmena) prepocitej(souhrn);
    }
    return zmena;
  };

  /** Jídla seřazená od „nejlehčího" vůči svému kalorickému podílu. */
  const serazenaJidla = () =>
    Object.entries(jidelnicek)
      .map(([nazev, s]) => ({
        nazev,
        s,
        typJ: typJidlaZ_nazvu(nazev),
        podil: podily[nazev] ?? 0.25,
      }))
      .sort(
        (a, b) =>
          a.s.kalorie / Math.max(cile.kalorie * a.podil, 1) -
          b.s.kalorie / Math.max(cile.kalorie * b.podil, 1),
      );

  /** přidá jednu celou potravinu do jídla s největším kalorickým prostorem. */
  const pridejDoplnek = (makro: "bilkoviny" | "sacharidy" | "tuky", chyba: number): boolean => {
    if (chyba <= 1) return false;
    for (const cil of serazenaJidla()) {
      let pool: Kandidat[];
      const zakazane = (p: { nazev: string }) => zakazaneProTyp(p, cil.typJ);
      if (makro === "tuky") {
        // olej patří do hlavního jídla (10 g k pokrmu), k snídani/svačině
        // preferujeme ořechy a sýry – čistý tuk v jídelní formě
        const vsechny = kategorie.tukova.filter((p) => !zakazane(p) && !TUK_ANTI_RE.test(p.nazev));
        const oleje = vsechny.filter((p) => OLEJ_TUK_RE.test(p.nazev) && jePrisada(p));
        // jídelní tuky nesmí být přísady – 45 g hořčice k snídani
        // není tukový doplněk (olej do hlavního jídla ano)
        const jidlova = vsechny.filter((p) => !jePrisada(p));
        pool =
          cil.typJ === "obedVecere"
            ? oleje.length > 0
              ? oleje
              : jidlova
            : jidlova;
      } else if (makro === "bilkoviny") {
        const antiKotva = kotvaAntiRe(cil.typJ);
        // kotva musí být opravdovým zdrojem bílkovin (≥4 g/100 g) –
        // špenát „bilkovinový" poměrem B:kcal doplněk neudělá
        pool = kategorie.bilkovinova.filter(
          (p) => !jePrisada(p) && !zakazane(p) && !antiKotva.test(p.nazev) && p.bilkoviny >= MIN_B_KOTVA,
        );
        // měkce – chudý katalog nesmí skončit bez bílkovinového doplňku
        if (pool.length === 0) {
          pool = kategorie.bilkovinova.filter((p) => !jePrisada(p) && !zakazane(p) && !antiKotva.test(p.nazev));
        }
        if (pool.length === 0) {
          pool = kategorie.bilkovinova.filter((p) => !jePrisada(p) && !zakazane(p));
        }
      } else {
        // sacharidový doplněk musí pasovat k jídlu – rýže k obědu,
        // vločky/pečivo k snídani, ovoce/pečivo ke svačině
        const vse = kategorie.sacharidova.filter((p) => !jePrisada(p) && !zakazane(p));
        const re = cil.typJ === "obedVecere" ? PRILOHA_RE : cil.typJ === "snidane" ? SNIDANE_RE : SVACINA_RE;
        const vhodne = vse.filter(
          (p) => re.test(p.nazev) && (cil.typJ !== "obedVecere" || !PRILOHA_ANTI_RE.test(p.nazev)),
        );
        pool = vhodne.length > 0 ? vhodne : vse;
      }
      // preferujeme nepoužité; tuk smí zopakovat (olej dvakrát je normální)
      const nove = pool.filter((p) => !pouziteId.includes(p.id));
      const fond = nove.length > 0 ? nove : makro === "tuky" ? pool : [];
      if (fond.length === 0) continue;
      const role: RoleJidla = makro === "bilkoviny" ? "kotva" : makro === "sacharidy" ? "sacharid" : "tuk";
      // kandidáti od nejlepšího skóre; minimální reálná porce se musí
      // vejít do makro-headroomu (+5 %), jinak trvale přestřelí cíl
      const prvni = vyberKandidata(
        fond, 0, pouziteId, denniPosun, poolMin, null, null, pouziteKlice, minuleDny,
      );
      const zbytek = fond
        .filter((x) => x.id !== prvni?.id)
        .sort((a, b) => b.skore - a.skore);
      const poradi = prvni !== null ? [prvni, ...zbytek] : zbytek;
      const akt = soucty();
      const cilMakro = makro === "bilkoviny" ? cile.bilkoviny : makro === "sacharidy" ? cile.sacharidy : cile.tuky;
      const aktMakro = makro === "bilkoviny" ? akt.b : makro === "sacharidy" ? akt.s : akt.t;
      const hlava = cilMakro * 1.05 - aktMakro;
      for (const kandidat of poradi) {
        const gramy = zaokrouhliGramaz(
          kandidat, chyba / (Math.max(kandidat[makro], 0.5) / 100), role, cil.typJ,
        );
        if (gramy <= 0) continue;
        const addMakro = (kandidat[makro] * gramy) / 100;
        if (addMakro > hlava + 0.5) continue;
        const jidlo = vytvorJidlo(kandidat, gramy);
        jidlo.role = role;
        const popisek = popisekKusu(kandidat.nazev, gramy);
        if (popisek !== undefined) jidlo.popisekMnozstvi = popisek;
        cil.s.jidla.push(jidlo);
        pouziteId.push(kandidat.id);
        pouziteKlice.add(klicPodobnosti(kandidat.nazev));
        prepocitej(cil.s);
        return true;
      }
    }
    return false;
  };

  /**
   * Reziduální kcal: makra jsou v toleranci, chybí energie. Přidává
   * NEJMENŠÍ porce, které se celé vejdou do makro-headroomu (±5 %)
   * – žádné makro se nesmí přestřelit jen kvůli kaloriím.
   */
  const pridejMalyDoplnek = (chybaK: number): boolean => {
    const s = soucty();
    const hlavy = {
      bilkoviny: cile.bilkoviny * 1.05 - s.b,
      sacharidy: cile.sacharidy * 1.05 - s.s,
      tuky: cile.tuky * 1.05 - s.t,
    };
    for (const cil of serazenaJidla()) {
      const zakazane = (p: { nazev: string }) => zakazaneProTyp(p, cil.typJ);
      // sacharidový doplněk má sedět k jídlu – jinak končí jogurt
      // jako „příloha" oběda
      const reSach =
        cil.typJ === "obedVecere" ? PRILOHA_RE : cil.typJ === "snidane" ? SNIDANE_RE : SVACINA_RE;
      const antiKotva = kotvaAntiRe(cil.typJ);
      const filtr = (p: Potravina) =>
        !zakazane(p) &&
        // zelenina se přidává slotem oběd/večeře – jako kalorický
        // doplněk by zde vznikaly směšné 20 g okurky za 3 kcal
        !ZELENINA_RE.test(p.nazev) &&
        // bílkovinový filler je de facto kotva – stejná kulinářská
        // pravidla (sušený hrach není snídaňová bílkovina)
        (kategoriePotraviny(p) !== "bilkovinova" ||
          (!antiKotva.test(p.nazev) && p.bilkoviny >= MIN_B_KOTVA)) &&
        (kategoriePotraviny(p) !== "sacharidova" ||
          (reSach.test(p.nazev) &&
            (cil.typJ !== "obedVecere" || !PRILOHA_ANTI_RE.test(p.nazev)))) &&
        (kategoriePotraviny(p) !== "tukova" || !TUK_ANTI_RE.test(p.nazev)) &&
        // suroviny jen tukové (5 g oleje dává smysl, 5 g cukru ne)
        // a přísady zase jen do hlavního jídla (olej ke svačině ne)
        (!jePrisada(p) ||
          (cil.typJ === "obedVecere" &&
            OLEJ_TUK_RE.test(p.nazev) &&
            kategoriePotraviny(p) === "tukova"));
      const zaklad = [...kategorie.bilkovinova, ...kategorie.sacharidova, ...kategorie.tukova];
      // preferujeme dnes ještě nepoužité; když je katalog malý a
      // nepoužité došly, opakujeme – 2× vločky ve dni je pořád lepší
      // než kcal pod cílem
      let vsechny = zaklad.filter((p) => filtr(p) && !pouziteId.includes(p.id));
      if (vsechny.length === 0) {
        const vJidle = new Set(cil.s.jidla.map((x) => x.id));
        vsechny = zaklad.filter((p) => filtr(p) && !vJidle.has(p.id));
      }
      // porce míří na ~75 % chybějících kcal a je SEŘÍZNUTA makro-
      // headroomem (50 g brambor → 40 g, když na sacharidy zbývá
      // jen ~7 g); vybírá se nejblíže k deficitu
      const kandidati = vsechny
        .map((p) => {
          const kat = kategoriePotraviny(p);
          const role: RoleJidla = kat === "bilkovinova" ? "kotva" : kat === "sacharidova" ? "sacharid" : "tuk";
          const cilK = chybaK * 0.75;
          const hlavyG = Math.min(
            p.bilkoviny > 0 ? hlavy.bilkoviny / (p.bilkoviny / 100) : Infinity,
            p.sacharidy > 0 ? hlavy.sacharidy / (p.sacharidy / 100) : Infinity,
            p.tuky > 0 ? hlavy.tuky / (p.tuky / 100) : Infinity,
          );
          const gramy = zaokrouhliGramaz(
            p,
            Math.min(cilK / (Math.max(p.kalorie, 1) / 100), hlavyG),
            role,
            cil.typJ,
          );
          return { p, role, gramy, addK: (p.kalorie * gramy) / 100 };
        })
        // přestřelit smíme nejvýš do horní hrany kcal tolerance
        // (2 kcal pod cílem vyřeší 5 g oleje lépe než nic)
        .filter((x) => x.gramy > 0 && x.addK > 15 && x.addK <= chybaK + cile.kalorie * TOL_KCAL)
        .sort((a, b) => Math.abs(a.addK - chybaK) - Math.abs(b.addK - chybaK));
      for (const k of kandidati) {
        const addB = (k.p.bilkoviny * k.gramy) / 100;
        const addS = (k.p.sacharidy * k.gramy) / 100;
        const addT = (k.p.tuky * k.gramy) / 100;
        // striktně pod stropem – kdyby přidání protlo +5 % makra,
        // další kolo ho doskaluj zase odebere a solver se jen houpe
        if (
          addB <= hlavy.bilkoviny &&
          addS <= hlavy.sacharidy &&
          addT <= hlavy.tuky
        ) {
          const jidlo = vytvorJidlo(k.p, k.gramy);
          jidlo.role = k.role;
          const popisek = popisekKusu(k.p.nazev, k.gramy);
          if (popisek !== undefined) jidlo.popisekMnozstvi = popisek;
          cil.s.jidla.push(jidlo);
          pouziteId.push(k.p.id);
          pouziteKlice.add(klicPodobnosti(k.p.nazev));
          prepocitej(cil.s);
          return true;
        }
      }
    }
    return false;
  };

  /** Reziduální kcal bez nové položky – navýší gramáž existujícího
   * jídla o další zaokrouhlovací krok, když přírůstek maker drží
   * headroom (jablko +20 g ≈ +12 kcal, +2,8 g sacharidů). Nová
   * položka je kvantovaná hruběji a často o pár deci promine. */
  const navisDoplnek = (): boolean => {
    const s = soucty();
    const hlavy = {
      bilkoviny: cile.bilkoviny * 1.05 - s.b,
      sacharidy: cile.sacharidy * 1.05 - s.s,
      tuky: cile.tuky * 1.05 - s.t,
    };
    let pokrok = false;
    for (const cil of serazenaJidla()) {
      for (const j of cil.s.jidla) {
        const p = podleId.get(j.id);
        if (!p) continue;
        const nova = zaokrouhliGramaz(p, j.gramy + 5, j.role ?? "kotva", cil.typJ);
        if (nova === j.gramy) continue;
        const dB = (p.bilkoviny * (nova - j.gramy)) / 100;
        const dS = (p.sacharidy * (nova - j.gramy)) / 100;
        const dT = (p.tuky * (nova - j.gramy)) / 100;
        if (dB <= hlavy.bilkoviny && dS <= hlavy.sacharidy && dT <= hlavy.tuky) {
          const nove = vytvorJidlo(p, nova);
          if (j.role !== undefined) nove.role = j.role;
          const popisek = popisekKusu(p.nazev, nova);
          if (popisek !== undefined) nove.popisekMnozstvi = popisek;
          Object.assign(j, nove);
          hlavy.bilkoviny -= dB;
          hlavy.sacharidy -= dS;
          hlavy.tuky -= dT;
          pokrok = true;
          prepocitej(cil.s);
          if (soucty().k >= cile.kalorie * (1 - TOL_KCAL)) return true;
        }
      }
    }
    return pokrok;
  };

  /** Přebytečné „fantómové" kcal – makra jsou v toleranci, ale
   * součet deklarovaných kcal přebíhá (typicky ryba v oleji, kde OFF
   * počítá kalorie i z nálevu, nebo vláknina počítaná jako sacharid).
   * Krátí položky s největším fantómovým kcal/gram – makra klesají
   * jen do dolní hrany tolerance, ne ping-pong jako škrt sacharidů. */
  const uberPhantomKcal = (prebytek: number): boolean => {
    const celk = soucty();
    const dolni = {
      b: cile.bilkoviny * (1 - TOL_MAKRO),
      s: cile.sacharidy * (1 - TOL_MAKRO),
      t: cile.tuky * (1 - TOL_MAKRO),
    };
    const kandidati = Object.entries(jidelnicek)
      .flatMap(([nazev, souhrn]) =>
        souhrn.jidla.map((j) => ({
          nazev,
          souhrn,
          j,
          phantom:
            (j.kalorie - (4.1 * (j.bilkoviny + j.sacharidy) + 9.3 * j.tuky)) /
            Math.max(j.gramy, 1),
        })),
      )
      .filter((x) => x.phantom > 0.15)
      .sort((a, b) => b.phantom - a.phantom);
    let zmena = false;
    for (const x of kandidati) {
      if (prebytek < 10) break;
      const p = podleId.get(x.j.id);
      if (!p) continue;
      const nova = zaokrouhliGramaz(p, x.j.gramy * 0.6, x.j.role ?? "kotva", typJidlaZ_nazvu(x.nazev), true);
      if (nova >= x.j.gramy) continue;
      const nove = vytvorJidlo(p, nova);
      if (x.j.role !== undefined) nove.role = x.j.role;
      const dB = x.j.bilkoviny - nove.bilkoviny;
      const dS = x.j.sacharidy - nove.sacharidy;
      const dT = x.j.tuky - nove.tuky;
      if (celk.b - dB < dolni.b || celk.s - dS < dolni.s || celk.t - dT < dolni.t) continue;
      const popisek = popisekKusu(p.nazev, nova);
      if (popisek !== undefined) nove.popisekMnozstvi = popisek;
      const dK = x.j.kalorie - nove.kalorie;
      Object.assign(x.j, nove);
      prepocitej(x.souhrn);
      celk.b -= dB;
      celk.s -= dS;
      celk.t -= dT;
      prebytek -= dK;
      zmena = true;
    }
    return zmena;
  };

  /** Krátí položky dané role směrem ke kalorickému cíli, ale NIKDY
   * pod spodní hranu daného makra (tol −5 %). Slouží přebytku kcal
   * při makrech v toleranci: tuk dá 9,3 kcal/g, sacharidy 4,1 –
   * pořadí volání rozhoduje, co se obětuje dřív. */
  const uberDoSpodku = (
    role: RoleJidla[],
    makro: "bilkoviny" | "sacharidy" | "tuky",
    cilK: number,
  ): boolean => {
    const idx = makro === "bilkoviny" ? "b" : makro === "sacharidy" ? "s" : "t";
    const spodek =
      (makro === "bilkoviny" ? cile.bilkoviny : makro === "sacharidy" ? cile.sacharidy : cile.tuky) *
      (1 - TOL_MAKRO);
    let zmena = false;
    // krátíme od nejtěžšího jídla vůči podílu
    for (const cil of [...serazenaJidla()].reverse()) {
      for (const j of cil.s.jidla) {
        if (!role.includes(j.role ?? "kotva")) continue;
        const p = podleId.get(j.id);
        if (!p) continue;
        const akt = soucty();
        const smimK = akt.k - cilK;
        if (smimK <= 0) return zmena;
        const smimMakro = akt[idx] - spodek;
        if (smimMakro <= 0) return zmena;
        const potrebaG = smimK / (Math.max(p.kalorie, 1) / 100);
        const stropG = smimMakro / (Math.max(p[makro], 0.1) / 100);
        const nova = zaokrouhliGramaz(
          p, j.gramy - Math.min(potrebaG, stropG), j.role ?? "kotva", cil.typJ, true,
        );
        if (nova >= j.gramy) continue;
        const nove = vytvorJidlo(p, nova);
        // zaokrouhlení nesmí propadnout pod spodek makra ani pod
        // spodek kcal – velký kusový krok by sestřelil −10 %
        if (j[makro] - nove[makro] > smimMakro) continue;
        if (akt.k - j.kalorie + nove.kalorie < cile.kalorie * (1 - TOL_KCAL)) continue;
        if (j.role !== undefined) nove.role = j.role;
        const popisek = popisekKusu(p.nazev, nova);
        if (popisek !== undefined) nove.popisekMnozstvi = popisek;
        Object.assign(j, nove);
        prepocitej(cil.s);
        zmena = true;
      }
    }
    return zmena;
  };

  for (let kolo = 0; kolo < 4; kolo++) {
    const s = soucty();
    const chybi = {
      b: cile.bilkoviny - s.b,
      s: cile.sacharidy - s.s,
      t: cile.tuky - s.t,
      k: cile.kalorie - s.k,
    };
    if (
      vTol(chybi.b, cile.bilkoviny, TOL_MAKRO) &&
      vTol(chybi.s, cile.sacharidy, TOL_MAKRO) &&
      vTol(chybi.t, cile.tuky, TOL_MAKRO) &&
      vTol(chybi.k, cile.kalorie, TOL_KCAL)
    ) {
      return;
    }

    let pokrok = false;
    // 1) kotvy → 2) sacharidy → 3) tuky (pořadí vyvažování);
    // jen mimo toleranci – krok porce (~8 g rýže) by podtoleranční
    // reziduum (~1 g) překvantoval přes celé pásmo
    if (!vTol(chybi.b, cile.bilkoviny, TOL_MAKRO)) {
      pokrok = doskaluj(["kotva", "suplement"], "bilkoviny", chybi.b) || pokrok;
    }
    if (!vTol(chybi.s, cile.sacharidy, TOL_MAKRO)) {
      pokrok = doskaluj(["sacharid"], "sacharidy", chybi.s) || pokrok;
    }
    if (!vTol(chybi.t, cile.tuky, TOL_MAKRO)) {
      pokrok = doskaluj(["tuk"], "tuky", chybi.t) || pokrok;
    }
    // stropy porcí → přidej celou potravinu do nejlehčího jídla
    if (!vTol(chybi.b, cile.bilkoviny, TOL_MAKRO) && chybi.b > 0) {
      pokrok = pridejDoplnek("bilkoviny", chybi.b) || pokrok;
    }
    if (!vTol(chybi.s, cile.sacharidy, TOL_MAKRO) && chybi.s > 0) {
      pokrok = pridejDoplnek("sacharidy", chybi.s) || pokrok;
    }
    if (!vTol(chybi.t, cile.tuky, TOL_MAKRO) && chybi.t > 0) {
      pokrok = pridejDoplnek("tuky", chybi.t) || pokrok;
    }
    // reziduální kcal: makra v toleranci → malé položky v headroomu
    // (opakovaně, dokud něco vejde); přebytek → ubrání sacharidů.
    // Měří se AŽ po doskalování/pridejDoplnek – chybi z úvodu kola
    // je zastaralá a jinak se reziduum nikdy nespustí.
    const po = soucty();
    const chybiPo = {
      b: cile.bilkoviny - po.b,
      s: cile.sacharidy - po.s,
      t: cile.tuky - po.t,
      k: cile.kalorie - po.k,
    };
    if (
      !vTol(chybiPo.k, cile.kalorie, TOL_KCAL) &&
      vTol(chybiPo.b, cile.bilkoviny, TOL_MAKRO) &&
      vTol(chybiPo.s, cile.sacharidy, TOL_MAKRO) &&
      vTol(chybiPo.t, cile.tuky, TOL_MAKRO)
    ) {
      if (chybiPo.k > 0) {
        let zbytek = chybiPo.k;
        for (let i = 0; i < 8 && !vTol(zbytek, cile.kalorie, TOL_KCAL); i++) {
          if (pridejMalyDoplnek(zbytek)) {
            zbytek = cile.kalorie - soucty().k;
            pokrok = true;
            continue;
          }
          if (!navisDoplnek()) break;
          zbytek = cile.kalorie - soucty().k;
          pokrok = true;
        }
      } else {
        // přebytek kcal s makry v toleranci = fantómové kcal z
        // katalogu – krátit viníky; pak tuk a sacharidy po spodní
        // hranu tolerance (tuk 9,3 kcal/g, sacharid 4,1 – tuk dřív)
        pokrok = uberPhantomKcal(-chybiPo.k) || pokrok;
        const kStrop = cile.kalorie * (1 + TOL_KCAL);
        // míří na cíl, ne na strop – 1 kcal nad stropem by žádný
        // kvantovaný krok nechytil a den by zůstal +0,03 % venku
        if (soucty().k > kStrop) {
          pokrok = uberDoSpodku(["tuk"], "tuky", cile.kalorie) || pokrok;
        }
        if (soucty().k > kStrop) {
          pokrok = uberDoSpodku(["sacharid"], "sacharidy", cile.kalorie) || pokrok;
        }
      }
    }
    if (!pokrok) return;
  }
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
          baleniG: jidlo.baleniG ?? null,
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

  // rodiny potravin použité v předchozích dnech – stupňovaný malus,
  // ať se týden skutečně různí (ne 7× sušené maso + křupavý sýr)
  const tydenniKlice = new Map<string, number>();
  for (let den = 1; den <= 7; den++) {
    const vysledek = vygenerujJidelnicek(potraviny, cile, den, 0.6, pocetJidel, filtr, tydenniKlice);
    dny[den] = vysledek;
    for (const souhrn of Object.values(vysledek.jidelnicek)) {
      for (const j of souhrn.jidla) {
        const klic = klicPodobnosti(j.nazev);
        tydenniKlice.set(klic, (tydenniKlice.get(klic) ?? 0) + 1);
      }
    }

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
  // i „rodiny" použitých potravin se vyhýbáme – náhrada má být opravdu jiná
  const pouziteKlice = new Set(
    Object.values(den.jidelnicek).flatMap((s) => s.jidla.map((j) => klicPodobnosti(j.nazev))),
  );
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
    nazevJidla,
    pouziteKlice,
    new Map(),
    true,
  );
  // vyberKandidata padá zpět na použité potraviny, když je fond malý –
  // vynutitNepouzite takový doplněk vynechá (jídlo bez něj pořád platí);
  // kdyby i tak vyšla použitá potravina nebo nic, náhradu odmítneme
  // (UI ukáže hlášku, že náhrada neexistuje).
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
