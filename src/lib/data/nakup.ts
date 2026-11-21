import { rpcChybi, supabase } from "@/lib/supabase";

/**
 * Nákupní seznamy – ukládání a správa (shopping_lists + items).
 * RLS chrání vlastní seznamy; položky dědí vlastnictví přes seznam.
 */

export interface NakupniSeznam {
  id: string;
  nazev: string;
  hotovo: boolean;
  vytvoreno: string;
}

export interface PolozkaNakupu {
  id: string;
  nazev: string;
  gramy: number;
  cenaZa100g: number | null;
  obchod: string | null;
  jeSleva: boolean;
  koupeno: boolean;
  vlastni: boolean;
  kategorie: string;
  obrazek?: string | null;
  /** vazba na katalog – ruční položky ji nemají (nelze porovnávat) */
  foodId?: string | null;
  /** gramáž prodávaného balení z katalogu – pro „co se koupí" */
  baleniG?: number | null;
  /** alergeny napojené potraviny – pro varování v seznamu */
  alergeny?: string[];
  /** podmnožina jen ze stop – „může obsahovat", jemnější varování */
  alergenyStopy?: string[];
}

/** Jedna aktuální cena potraviny u konkrétního obchodu. */
export interface CenaObchodu {
  obchodId: string;
  obchod: string;
  cena: number;
  jeSleva: boolean;
  pozorovanoAt: string;
  /** gramáž balení u tohoto obchodu (obs.baleni_g ?? foods.baleni_g) */
  baleniG: number | null;
  /** ověřená původní (přeškrtnutá) cena za 100 g – null bez
   *  zdrojového ověření (leták/eshop/kupi) nebo pack-mismatch
   *  artefaktu (>2,5× akční / >2× běžná – stejné meze jako view) */
  puvodniCena: number | null;
}

/** Načte seznamy přihlášeného uživatele (novější první). */
export async function nactiMeNakupniSeznamy(): Promise<NakupniSeznam[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data, error } = await klient
    .from("shopping_lists")
    .select("id, nazev, hotovo, vytvoreno")
    .order("vytvoreno", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Nákupní seznamy se nenačetly: ${error.message}`);
  return data ?? [];
}

/**
 * Sloučí duplicitní položky před uložením – stejná potravina
 * (foodId, případně stejný normalizovaný název) se sečte přes gramy.
 * U sloučených oceněných řádků držíme levnější nabídku (reálná cena,
 * kterou uživatel zvolil při generování seznamu).
 */
export function deduplikujPolozky<
  T extends { foodId?: string | null; nazev: string; gramy: number; cenaZa100g: number | null; obchod: string | null; jeSleva: boolean; baleniG?: number | null },
>(polozky: T[]): T[] {
  const mapa = new Map<string, T>();
  const vysledek: T[] = [];
  for (const p of polozky) {
    const klic = p.foodId ?? `nazev:${p.nazev.trim().toLowerCase()}`;
    const stavajici = mapa.get(klic);
    if (!stavajici) {
      mapa.set(klic, p);
      vysledek.push(p);
      continue;
    }
    // merge do NOVÉHO objektu – mutace stavajici by tiše měnila i
    // položku ve volajícího poli (sdílená reference)
    const levnejsi =
      stavajici.cenaZa100g === null ||
      (p.cenaZa100g !== null && p.cenaZa100g < stavajici.cenaZa100g);
    const sloucena: T = {
      ...stavajici,
      gramy: stavajici.gramy + p.gramy,
      ...(levnejsi
        ? { cenaZa100g: p.cenaZa100g, obchod: p.obchod, jeSleva: p.jeSleva }
        : {}),
      // gramáž balení přežije merge – vezmeme první známou
      baleniG: stavajici.baleniG ?? p.baleniG ?? null,
    };
    mapa.set(klic, sloucena);
    vysledek[vysledek.indexOf(stavajici)] = sloucena;
  }
  return vysledek;
}

/** Vytvoří seznam z položek (gramy, cena, obchod, sleva); volitelně vázaný na plán. */
export async function ulozNakupniSeznam(
  nazev: string,
  polozky: { foodId?: string | null; nazev: string; gramy: number; cenaZa100g: number | null; obchod: string | null; jeSleva: boolean; kategorie?: string; baleniG?: number | null }[],
  planId?: string | null,
): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

  // stejná potravina z více receptů/jídel se sečte na jeden řádek
  polozky = deduplikujPolozky(polozky);

  // atomická RPC (migrace 0008) – seznam + položky v transakci
  const { data: rpcId, error: errRpc } = await klient.rpc("uloz_nakupni_seznam", {
    p_nazev: nazev,
    p_plan_id: planId ?? null,
    p_polozky: polozky.map((p) => ({
      food_id: p.foodId ?? null,
      nazev: p.nazev,
      gramy: p.gramy,
      cena_za_100g: p.cenaZa100g,
      obchod: p.obchod,
      je_sleva: p.jeSleva,
      kategorie: p.kategorie ?? "ostatni",
    })),
  });
  if (!errRpc) return rpcId as string;
  if (!rpcChybi(errRpc)) throw new Error(`Seznam se neuložil: ${errRpc.message}`);
  // funkce není nasazená → kompenzovaný PostgREST zápis

  const { data: seznam, error } = await klient
    .from("shopping_lists")
    .insert({ user_id: uzivatel.user.id, nazev, plan_id: planId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`Seznam se neuložil: ${error.message}`);
  const idSeznamu = seznam.id as string;

  if (polozky.length > 0) {
    const { error: err } = await klient.from("shopping_list_items").insert(
      polozky.map((p) => ({
        list_id: idSeznamu,
        food_id: p.foodId ?? null,
        nazev: p.nazev,
        gramy: Math.round(p.gramy),
        cena_za_100g: p.cenaZa100g,
        obchod: p.obchod,
        je_sleva: p.jeSleva,
        kategorie: p.kategorie ?? "ostatni",
      })),
    );
    if (err) {
      // kompenzace – jinak zůstane osiřelý prázdný seznam
      // (PostgREST nemá multi-table transakce; ideálně RPC)
      await klient.from("shopping_lists").delete().eq("id", idSeznamu);
      throw new Error(`Položky se neuložily: ${err.message}`);
    }
  }

  return idSeznamu;
}

/** Načte položky jednoho seznamu. */
export async function nactiPolozkySeznamu(idSeznamu: string): Promise<PolozkaNakupu[]> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  let { data, error } = await klient
    .from("shopping_list_items")
    .select("id, nazev, gramy, cena_za_100g, obchod, je_sleva, koupeno, vlastni, kategorie, food_id, potravina:foods(obrazek, baleni_g, alergeny, alergeny_stopy)")
    .eq("list_id", idSeznamu)
    .order("id");
  // před migrací 0009/0055 foods.obrazek/alergeny_stopy neexistuje → fallback bez joinu
  if (error && /obrazek|alergeny_stopy/i.test(error.message)) {
    const znovu = await klient
      .from("shopping_list_items")
      .select("id, nazev, gramy, cena_za_100g, obchod, je_sleva, koupeno, vlastni, kategorie, food_id")
      .eq("list_id", idSeznamu)
      .order("id");
    data = znovu.data as unknown as typeof data;
    error = znovu.error;
  }
  if (error) throw new Error(`Položky se nenačetly: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    nazev: p.nazev,
    gramy: p.gramy,
    cenaZa100g: p.cena_za_100g === null ? null : Number(p.cena_za_100g),
    obchod: p.obchod,
    jeSleva: p.je_sleva,
    koupeno: p.koupeno,
    vlastni: p.vlastni,
    obrazek: (Array.isArray(p.potravina)
      ? (p.potravina[0]?.obrazek ?? null)
      : ((p.potravina as { obrazek?: string | null } | null)?.obrazek ?? null)) as string | null,
    kategorie: p.kategorie,
    foodId: (p.food_id ?? null) as string | null,
    baleniG: (Array.isArray(p.potravina)
      ? (p.potravina[0]?.baleni_g ?? null)
      : ((p.potravina as { baleni_g?: number | null } | null)?.baleni_g ?? null)) as number | null,
    alergeny: (Array.isArray(p.potravina)
      ? (p.potravina[0]?.alergeny ?? [])
      : ((p.potravina as { alergeny?: string[] | null } | null)?.alergeny ?? [])) as string[],
    alergenyStopy: (Array.isArray(p.potravina)
      ? (p.potravina[0]?.alergeny_stopy ?? [])
      : ((p.potravina as { alergeny_stopy?: string[] | null } | null)?.alergeny_stopy ?? [])) as string[],
  }));
}

/**
 * Aktuální ceny napříč obchody pro dané potraviny – základ Cenovky.
 * price_observations čte authenticated (ceny_cteni); posledních 30 dní
 * drží objem dotazu malý i při denním scrapingu. Redukce na nejnovější
 * obs na dvojici (potravina, obchod) – řadíme sestupně, první výskyt vyhrává.
 */
export async function nactiCenoveHladiny(
  foodIds: string[],
): Promise<Map<string, CenaObchodu[]>> {
  const vysledek = new Map<string, CenaObchodu[]>();
  const klient = supabase;
  const ids = [...new Set(foodIds.filter((id): id is string => Boolean(id)))];
  if (!klient || ids.length === 0) return vysledek;

  const { data, error } = await klient
    .from("price_observations")
    .select("food_id, retailer_id, cena, je_sleva, pozorovano_at, baleni_g, puvodni_cena, puvodni_zdroj, obchod:retailers(nazev), potravina:foods(baleni_g, bezna_cena)")
    .in("food_id", ids)
    // podezřelá pozorování (špatně spárovaná nabídka, >3×/<0,25×
    // per-food mediánu) Cenovka ignoruje – stejně jako view
    .eq("podezrele", false)
    .gte("pozorovano_at", new Date(Date.now() - 30 * 86400e3).toISOString())
    // expirované letákové slevy nikdy nepovrchují jako aktivní –
    // stejné pravidlo jako view aktualni_ceny. Datum LOKÁLNĚ
    // (en-CA = ISO YYYY-MM-DD): UTC řez by po půlnoci na českém
    // čase ještě hodinu dvě ukazoval včera prošlé akce.
    .or("je_sleva.eq.false,platnost_do.is.null,platnost_do.gte." + new Date().toLocaleDateString("en-CA"))
    .order("pozorovano_at", { ascending: false });
  if (error) throw new Error(`Ceny obchodů se nenačetly: ${error.message}`);

  // redukce na 1 obs na (potravina, obchod): preferujeme aktivní
  // slevu, ale jen ČERSTVOU – slevové pozorování starší než týden
  // (letáky běží týdně, slevy bez platnost_do nemají konec) už je
  // mrtvá akce; místo ní vyhrává nejnovější běžná cena. Data přišla
  // desc podle pozorovano_at → [0] je vždy nejnovější obs.
  const CERSTVOST_SLEVY_MS = 7 * 86400e3;
  const podleKlice = new Map<string, NonNullable<typeof data>>();
  for (const r of data ?? []) {
    const klic = `${r.food_id}:${r.retailer_id}`;
    const arr = podleKlice.get(klic) ?? [];
    arr.push(r);
    podleKlice.set(klic, arr);
  }
  for (const arr of podleKlice.values()) {
    const r =
      arr.find(
        (s) =>
          s.je_sleva &&
          Date.now() - new Date(s.pozorovano_at as string).getTime() <=
            CERSTVOST_SLEVY_MS,
      ) ?? arr[0]!;
    const naz = r.obchod as { nazev?: string } | { nazev?: string }[] | null;
    const obchod = (Array.isArray(naz) ? naz[0]?.nazev : naz?.nazev) ?? "Obchod";
    const bal = r.potravina as
      | { baleni_g?: number | null; bezna_cena?: number | null }
      | { baleni_g?: number | null; bezna_cena?: number | null }[]
      | null;
    const baleniObs = r.baleni_g != null ? Number(r.baleni_g) : null;
    const potravina = Array.isArray(bal) ? bal[0] : bal;
    const baleniFood = potravina?.baleni_g ?? null;
    const bezna = potravina?.bezna_cena != null ? Number(potravina.bezna_cena) : null;
    const cena = Number(r.cena);
    const puvodni = r.puvodni_cena != null ? Number(r.puvodni_cena) : null;
    const radka: CenaObchodu = {
      obchodId: r.retailer_id as string,
      obchod,
      cena,
      jeSleva: Boolean(r.je_sleva),
      pozorovanoAt: r.pozorovano_at as string,
      baleniG: baleniObs ?? (baleniFood != null ? Number(baleniFood) : null),
      // stejné podmínky jako view aktualni_ceny (0052): původní cena jen
      // se zdrojovým ověřením, reálná sleva (>1,01×), max 2,5× akční
      // a max 2× běžná cena – jinak pack-mismatch artefakt
      puvodniCena:
        puvodni !== null &&
        r.puvodni_zdroj != null &&
        puvodni > cena * 1.01 &&
        puvodni <= cena * 2.5 &&
        (bezna === null || bezna <= 0 || puvodni <= bezna * 2)
          ? puvodni
          : null,
    };
    const seznam = vysledek.get(r.food_id as string) ?? [];
    seznam.push(radka);
    vysledek.set(r.food_id as string, seznam);
  }
  return vysledek;
}

/** Přepne stav seznamu (hotovo/nehotovo). */
export async function prepnoutHotovo(idSeznamu: string, hotovo: boolean): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_lists").update({ hotovo }).eq("id", idSeznamu);
  if (error) throw new Error(`Seznam se neupravil: ${error.message}`);
}

/** Smazání seznamu (položky kaskádově). */
export async function smazNakupniSeznam(idSeznamu: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_lists").delete().eq("id", idSeznamu);
  if (error) throw new Error(`Seznam se nesmazal: ${error.message}`);
}

/** Přepne „koupeno" u položky. */
export async function prepnoutKoupeno(idPolozky: string, koupeno: boolean): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_list_items").update({ koupeno }).eq("id", idPolozky);
  if (error) throw new Error(`Položka se neupravila: ${error.message}`);
}

/** Ruční položka (není z katalogu – sůl, paprika, sáčky…). */
export async function pridejVlastniPolozku(
  idSeznamu: string,
  nazev: string,
): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const n = nazev.trim();
  if (n.length === 0) throw new Error("Název položky je prázdný.");
  if (n.length > 120) throw new Error("Název položky je moc dlouhý (max 120 znaků).");
  const { error } = await klient.from("shopping_list_items").insert({
    list_id: idSeznamu,
    nazev: n,
    vlastni: true,
  });
  if (error) throw new Error(`Položka se nepřidala: ${error.message}`);
}

/** Smazání jedné položky. */
export async function smazPolozku(idPolozky: string): Promise<void> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");
  const { error } = await klient.from("shopping_list_items").delete().eq("id", idPolozky);
  if (error) throw new Error(`Položka se nesmazala: ${error.message}`);
}
