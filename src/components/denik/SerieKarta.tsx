import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import { dnyVTextu, type SerieDeniku } from "@/lib/data/denik";

/** Zkratky dnů pro mini-pás posledních 7 dnů (index = Date.getDay()). */
const ZKRATKY_DNU = ["ne", "po", "út", "st", "čt", "pá", "so"];

/**
 * Vnitřek karty série – plamen, počet dní v řadě a pás posledních
 * 7 dnů. Samostatně od obalu, aby šel použít v Deníku i v kartě
 * na Přehledu.
 */
export function SerieObsah({ serie }: { serie: SerieDeniku }) {
  const ziva = serie.aktualni > 0;
  return (
    <div className="flex items-center gap-4">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          ziva ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
        )}
      >
        <Flame className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        {ziva ? (
          <>
            <p className="om-display text-2xl font-extrabold leading-none tabular-nums text-fg">
              {serie.aktualni}{" "}
              <span className="text-sm font-bold">
                {dnyVTextu(serie.aktualni)} v řadě
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {serie.dnesZapsano
                ? "Dnes zapsáno – série běží dál."
                : "Dnes zatím nic – zapište jídlo, ať série nepřerušíte."}
              {serie.nejdelsi > serie.aktualni &&
                ` Rekord: ${serie.nejdelsi} ${dnyVTextu(serie.nejdelsi)}.`}
            </p>
          </>
        ) : (
          <>
            <p className="om-display text-lg font-extrabold leading-tight text-fg">
              Začněte sérii
            </p>
            <p className="mt-1 text-xs text-muted">
              Zapište dnešní jídlo do deníku a série běží.
            </p>
          </>
        )}
      </div>
      {/* mini-pás posledních 7 dnů */}
      <div className="flex shrink-0 gap-1.5" aria-label="Zápisy za posledních 7 dnů">
        {serie.tyden.map((d) => {
          const jeDnes = d.iso === serie.tyden[serie.tyden.length - 1]?.iso;
          return (
            <div key={d.iso} className="flex w-6 flex-col items-center gap-1">
              <span
                className={cn(
                  "text-[10px] font-medium",
                  jeDnes ? "text-fg" : "text-muted",
                )}
              >
                {ZKRATKY_DNU[new Date(`${d.iso}T12:00:00`).getDay()]}
              </span>
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  d.zapsano
                    ? "bg-primary"
                    : jeDnes
                      ? "border-2 border-dashed border-accent"
                      : "bg-surface-2",
                )}
                title={
                  d.zapsano
                    ? `${d.iso} – zapsáno`
                    : `${d.iso} – bez zápisu`
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Samostatná karta série pro stránku deníku (stejný obal jako souhrn dne). */
export function SerieKarta({ serie }: { serie: SerieDeniku }) {
  return (
    <section
      className="rounded-2xl bg-surface p-4"
      aria-label="Série zapisování do deníku"
    >
      <SerieObsah serie={serie} />
    </section>
  );
}
