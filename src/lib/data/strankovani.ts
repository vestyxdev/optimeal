/**
 * Stránkování přes PostgREST limit (max_rows = 1000).
 * Dotazy na velké katalogy (aktualni_ceny po hromadném ingestu)
 * by jinak tiše vrátily jen prvních 1000 řádků.
 */

const STRANA = 1000;

/** Strukturální minimum, co potřebujeme od PostgREST dotazu. */
export interface StrankovatelnyDotaz<T> {
  range(od: number, do_: number): PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>;
}

/** Postaví dotaz znovu pro každou stránku a posbírá všechny řádky. */
export async function nactiVse<T>(
  stavDotaz: () => StrankovatelnyDotaz<T>,
): Promise<T[]> {
  const vse: T[] = [];
  let od = 0;
  for (;;) {
    const { data, error } = await stavDotaz().range(od, od + STRANA - 1);
    if (error) throw new Error(`Načtení selhalo: ${error.message}`);
    if (!data || data.length === 0) break;
    vse.push(...data);
    if (data.length < STRANA) break;
    od += STRANA;
  }
  return vse;
}
