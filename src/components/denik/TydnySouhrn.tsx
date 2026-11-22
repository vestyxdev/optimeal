import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, Drumstick } from "lucide-react";
import type { PoznamkaDeniku } from "@/lib/data/denik";
import { nactiCenoveHladiny } from "@/lib/data/nakup";
import { formatujKcal, formatujMakro, formatujCastku } from "@/lib/cena";
import { cn } from "@/lib/cn";

/**
 * Týdenní souhrn deníku: Ø kcal/den a Ø bílkoviny/den proti cíli
 * + odhad týdenního výdaje za zapsané potraviny.
 *
 * Výdaj je odhad – cena za 100 g aktuálně nejlevnější nabídky
 * (stejná data jako Cenovka). Položky bez živé ceny se do součtu
 * nepočítají a jejich počet se ukáže pod čarou – nic se nedohaduje.
 */

interface Cile {
  kalorie?: number | null;
  bilkoviny?: number | null;
}

export function TydnySouhrn({
  poznamky,
  cile,
}: {
  poznamky: PoznamkaDeniku[];
  cile: Cile | null;
}) {
  // denní součty jen z reálně zapsaných dnů – prázdný den nesmí
  // průměr uměle srážet (uživatel třeba jen nezapisoval)
  const dny = useMemo(() => {
    const m = new Map<string, { kcal: number; b: number }>();
    for (const p of poznamky) {
      const d = m.get(p.zapsanoDne) ?? { kcal: 0, b: 0 };
      d.kcal += (p.kalorie * p.mnozstviG) / 100;
      d.b += (p.bilkoviny * p.mnozstviG) / 100;
      m.set(p.zapsanoDne, d);
    }
    return m;
  }, [poznamky]);

  // ceny jen pro potraviny, co v týdnu opravdu jsou (žádné nadbytečné fetch)
  const foodIds = useMemo(
    () => [...new Set(poznamky.map((p) => p.foodId).filter((x): x is string => Boolean(x)))].sort(),
    [poznamky],
  );
  const klicIds = foodIds.join(",");
  const dotazCeny = useQuery({
    queryKey: ["ceny_tyden", klicIds],
    queryFn: () => nactiCenoveHladiny(foodIds),
    enabled: foodIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const soucet = useMemo(() => {
    const n = dny.size;
    if (n === 0) return null;
    let kcal = 0, b = 0;
    for (const d of dny.values()) {
      kcal += d.kcal;
      b += d.b;
    }
    // odhad výdaje: nejlevnější dostupná nabídka na potravinu
    const hladiny = dotazCeny.data;
    let vydaj = 0;
    let bezCeny = 0;
    if (hladiny) {
      for (const p of poznamky) {
        if (p.mnozstviG <= 0) continue;
        const nabidky = p.foodId ? hladiny.get(p.foodId) : undefined;
        const nej = nabidky?.length
          ? nabidky.reduce((m, c) => (c.cena < m.cena ? c : m)).cena
          : null;
        if (nej === null) {
          bezCeny += 1;
          continue;
        }
        vydaj += (p.mnozstviG / 100) * nej;
      }
    }
    return { kcal: kcal / n, b: b / n, n, vydaj, bezCeny, cenyHotove: Boolean(hladiny) };
  }, [dny, poznamky, dotazCeny.data]);

  if (!soucet) return null;

  const cilKcal = cile?.kalorie ?? 0;
  const cilB = cile?.bilkoviny ?? 0;
  const pctKcal = cilKcal > 0 ? Math.round((soucet.kcal / cilKcal) * 100) : null;
  const pctB = cilB > 0 ? Math.round((soucet.b / cilB) * 100) : null;
  // splnění = 90–110 % cíle (hubnutí i nabírání snáší desetinu volně)
  const vCili = (pct: number | null) => pct !== null && pct >= 90 && pct <= 110;

  return (
    <section className="om-karta p-4" aria-label="Souhrn posledních 7 dnů">
      <h2 className="om-display flex items-center gap-2 text-sm font-bold tracking-tight">
        <TrendingUp className="size-4 text-primary" aria-hidden />
        Týden v kostce
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted">Ø kcal / den</p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums">
            {formatujKcal(soucet.kcal)}
          </p>
          {pctKcal !== null && (
            <p
              className={cn(
                "text-xs font-semibold tabular-nums",
                vCili(pctKcal) ? "text-ok" : "text-muted",
              )}
            >
              {pctKcal} % cíle
            </p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Drumstick className="size-3" aria-hidden />
            Ø bílkoviny / den
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums">
            {formatujMakro(soucet.b)} g
          </p>
          {pctB !== null && (
            <p
              className={cn(
                "text-xs font-semibold tabular-nums",
                vCili(pctB) ? "text-ok" : "text-muted",
              )}
            >
              {pctB} % cíle
            </p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Wallet className="size-3" aria-hidden />
            Odhad výdaje
          </p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums">
            {soucet.cenyHotove ? `~${formatujCastku(soucet.vydaj)} Kč` : "…"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        z {soucet.n} {soucet.n === 1 ? "dne" : soucet.n < 5 ? "dnů" : "dní"} se zápisy
        {soucet.bezCeny > 0 && ` · ${soucet.bezCeny} položek bez ceny mimo odhad`}
      </p>
    </section>
  );
}
