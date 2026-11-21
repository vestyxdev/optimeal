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

/* ============================================================
 * SMART CART OPTIMIZER – 1 obchod / 2 obchody / kusově
 * ============================================================ */

export type RezimOptimalizace = "jeden" | "dva" | "kusove";

export interface VysledekOptimalizace {
  /** item.id → nabídka v přiřazeném obchodě (null = v režimu nekrytá) */
  prirazeni: Map<string, CenaObchodu | null>;
  /** názvy obchodů v přiřazení (pořadí podle pokrytí) */
  obchody: string[];
  /** položek ocenitelných u vybraných obchodů */
  pokryti: number;
  /** kolik položek má vůbec živou nabídku (jmenovatel pokrytí) */
  cenitelnych: number;
  /** balenkový součet u přiřazených obchodů (Kč, celá balení) */
  celkem: number;
}

interface OptimalizovatelnaPolozka {
  id: string;
  foodId?: string | null;
  nazev: string;
  gramy: number;
  baleniG?: number | null;
}

/**
 * Přiřadí položky obchodům podle režimu a vrátí balenkový součet.
 *
 * „jeden" / „dva": vybere obchod (pár obchodů) s nejvyšším pokrytím,
 * při shodě nejnižší součet celých balení. Položku přiřadíme tomu
 * z vybraných obchodů, kde má nejnižší cenu/100 g (stejné baleniG →
 * nejnižší balenková cena). Položky bez nabídky u vybraných obchodů
 * zůstávají nekryté (prirazeni = null) – UI je nechá na vlastní ceně.
 *
 * „kusove": každá položka jde na svou globálně nejlevnější nabídku.
 */
export function optimalizujNakup(
  polozky: OptimalizovatelnaPolozka[],
  ceny: Map<string, CenaObchodu[]>,
  rezim: RezimOptimalizace,
): VysledekOptimalizace {
  const balenkovaCena = (p: OptimalizovatelnaPolozka, c: CenaObchodu): number =>
    spocitejNakupniBaleni({
      nazev: p.nazev,
      gramy: p.gramy,
      baleniG: c.baleniG ?? p.baleniG ?? null,
      cenaZa100g: c.cena,
      cenaBeznaZa100g: c.puvodniCena ?? null,
    }).cenaCelkem ?? 0;

  const ocenitelne = polozky.filter(
    (p) => p.foodId != null && (ceny.get(p.foodId)?.length ?? 0) > 0,
  );

  if (rezim === "kusove") {
    const prirazeni = new Map<string, CenaObchodu | null>();
    const pocty = new Map<string, number>();
    let celkem = 0;
    for (const p of ocenitelne) {
      const nej = nejlevnejsiObchod(ceny.get(p.foodId as string));
      prirazeni.set(p.id, nej);
      if (nej) {
        celkem += balenkovaCena(p, nej);
        pocty.set(nej.obchod, (pocty.get(nej.obchod) ?? 0) + 1);
      }
    }
    return {
      prirazeni,
      obchody: [...pocty.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o),
      pokryti: ocenitelne.filter((p) => prirazeni.get(p.id)).length,
      cenitelnych: ocenitelne.length,
      celkem: Math.round(celkem * 100) / 100,
    };
  }

  // unikátní obchody z nabídek (id → název)
  const obchodyMap = new Map<string, string>();
  for (const nabidka of ceny.values()) {
    for (const c of nabidka) obchodyMap.set(c.obchodId, c.obchod);
  }
  const ids = [...obchodyMap.keys()];

  // skóre skupiny obchodů: pokrytí (primární) + balenkový součet (tiebreak)
  const skoreSkupiny = (skupina: string[]) => {
    let pokryti = 0;
    let celkem = 0;
    for (const p of ocenitelne) {
      const nabidka = (ceny.get(p.foodId as string) ?? []).filter((c) =>
        skupina.includes(c.obchodId),
      );
      const nej = nabidka.length
        ? nabidka.reduce((m, c) => (c.cena < m.cena ? c : m))
        : null;
      if (nej) {
        pokryti++;
        celkem += balenkovaCena(p, nej);
      }
    }
    return { pokryti, celkem };
  };

  const lepsi = (
    a: { skupina: string[]; pokryti: number; celkem: number } | null,
    b: { skupina: string[]; pokryti: number; celkem: number },
  ) => a === null || b.pokryti > a.pokryti || (b.pokryti === a.pokryti && b.celkem < a.celkem);

  let best: { skupina: string[]; pokryti: number; celkem: number } | null = null;
  if (rezim === "jeden") {
    for (const id of ids) {
      const s = skoreSkupiny([id]);
      if (lepsi(best, { skupina: [id], ...s })) best = { skupina: [id], ...s };
    }
  } else {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const skupina = [ids[i]!, ids[j]!];
        const s = skoreSkupiny(skupina);
        if (lepsi(best, { skupina, ...s })) best = { skupina, ...s };
      }
    }
  }

  const prirazeni = new Map<string, CenaObchodu | null>();
  const pocty = new Map<string, number>();
  let celkem = 0;
  let pokryti = 0;
  if (best) {
    for (const p of ocenitelne) {
      const nabidka = (ceny.get(p.foodId as string) ?? []).filter((c) =>
        best.skupina.includes(c.obchodId),
      );
      const nej = nabidka.length
        ? nabidka.reduce((m, c) => (c.cena < m.cena ? c : m))
        : null;
      prirazeni.set(p.id, nej);
      if (nej) {
        pokryti++;
        celkem += balenkovaCena(p, nej);
        pocty.set(nej.obchod, (pocty.get(nej.obchod) ?? 0) + 1);
      }
    }
  }
  return {
    prirazeni,
    obchody: [...pocty.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o),
    pokryti,
    cenitelnych: ocenitelne.length,
    celkem: Math.round(celkem * 100) / 100,
  };
}
