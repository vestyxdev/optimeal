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
}

/** Jedna aktuální cena potraviny u konkrétního obchodu. */
export interface CenaObchodu {
  obchodId: string;
  obchod: string;
  cena: number;
  jeSleva: boolean;
  pozorovanoAt: string;
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

/** Vytvoří seznam z položek (gramy, cena, obchod, sleva); volitelně vázaný na plán. */
export async function ulozNakupniSeznam(
  nazev: string,
  polozky: { foodId?: string | null; nazev: string; gramy: number; cenaZa100g: number | null; obchod: string | null; jeSleva: boolean; kategorie?: string }[],
  planId?: string | null,
): Promise<string> {
  const klient = supabase;
  if (!klient) throw new Error("Supabase není připojeno.");

  const { data: uzivatel } = await klient.auth.getUser();
  if (!uzivatel.user) throw new Error("Není přihlášen.");

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
    .select("id, nazev, gramy, cena_za_100g, obchod, je_sleva, koupeno, vlastni, kategorie, food_id, potravina:foods(obrazek)")
    .eq("list_id", idSeznamu)
    .order("id");
  // před migrací 0009 foods.obrazek neexistuje → fallback bez joinu
  if (error && /obrazek/i.test(error.message)) {
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
    .select("food_id, retailer_id, cena, je_sleva, pozorovano_at, obchod:retailers(nazev)")
    .in("food_id", ids)
    .gte("pozorovano_at", new Date(Date.now() - 30 * 86400e3).toISOString())
    .order("pozorovano_at", { ascending: false });
  if (error) throw new Error(`Ceny obchodů se nenačetly: ${error.message}`);

  const videno = new Set<string>();
  for (const r of data ?? []) {
    const klic = `${r.food_id}:${r.retailer_id}`;
    if (videno.has(klic)) continue;
    videno.add(klic);
    const naz = r.obchod as { nazev?: string } | { nazev?: string }[] | null;
    const obchod = (Array.isArray(naz) ? naz[0]?.nazev : naz?.nazev) ?? "Obchod";
    const radka: CenaObchodu = {
      obchodId: r.retailer_id as string,
      obchod,
      cena: Number(r.cena),
      jeSleva: Boolean(r.je_sleva),
      pozorovanoAt: r.pozorovano_at as string,
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
