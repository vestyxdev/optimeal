import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatujMakro } from "@/lib/cena";
import { cn } from "@/lib/cn";

/**
 * Pilulka gramáže s popoverem předvoleb – sdílený ovládací prvek
 * pro zápis do deníku i receptový formulář.
 *
 * Předvolby 1–250 g + „balení (N g)“ (když je baleniG mimo předvolby)
 * + řádek pro vlastní gramáž. Escape zavře jen popover (capture
 * fáze – nestáhne s sebou nadřazený sheet/modal).
 */

const PORCE_GRAMU = [1, 50, 100, 150, 200, 250];
const MAX_GRAMU = 10000;

export function GramazPill({
  hodnota,
  onZmena,
  baleniG,
  ariaLabel,
  chyba = false,
  className,
}: {
  hodnota: number;
  onZmena: (gramy: number) => void;
  /** gramáž balení v g – přidá předvolbu „balení (N g)“ */
  baleniG?: number | null;
  ariaLabel?: string;
  chyba?: boolean;
  className?: string;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const vlastniRef = useRef<HTMLInputElement>(null);

  // Escape v capture fázi – popover sebere Escape dřív, než ho uvidí
  // nadřazený sheet (DenikZapis), takže se nezavře celý dialog.
  useEffect(() => {
    if (!otevreno) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOtevreno(false);
      }
    };
    document.addEventListener("keydown", naKlavesu, true);
    return () => document.removeEventListener("keydown", naKlavesu, true);
  }, [otevreno]);

  const baleni =
    baleniG && !PORCE_GRAMU.includes(Math.round(baleniG)) ? Math.round(baleniG) : null;

  const zvol = (g: number) => {
    onZmena(Math.min(MAX_GRAMU, Math.max(1, g)));
    setOtevreno(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        aria-expanded={otevreno}
        aria-label={ariaLabel ?? `Množství: ${formatujMakro(hodnota)} g – změnit`}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-full border bg-bg px-4 text-sm font-semibold tabular-nums text-fg transition-colors",
          chyba ? "border-danger" : "border-border hover:border-primary/60",
        )}
      >
        <span className="truncate">{formatujMakro(hodnota)} g</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>

      {otevreno && (
        <>
          <button
            type="button"
            aria-label="Zavřít volbu množství"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOtevreno(false)}
            tabIndex={-1}
          />
          <div
            className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-xl"
            role="menu"
            aria-label="Předvolby množství"
          >
            {PORCE_GRAMU.map((g) => (
              <button
                key={g}
                type="button"
                role="menuitemradio"
                aria-checked={g === hodnota}
                onClick={() => zvol(g)}
                className={cn(
                  "flex w-full items-center px-5 py-3 text-left text-sm tabular-nums transition-colors hover:bg-primary-soft",
                  g === hodnota ? "font-bold text-primary" : "text-fg",
                )}
              >
                {g} g
              </button>
            ))}
            {baleni !== null && (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={baleni === hodnota}
                onClick={() => zvol(baleni)}
                className={cn(
                  "flex w-full items-center px-5 py-3 text-left text-sm tabular-nums transition-colors hover:bg-primary-soft",
                  baleni === hodnota ? "font-bold text-primary" : "text-fg",
                )}
              >
                balení ({baleni} g)
              </button>
            )}
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <label htmlFor="gramaz-vlastni" className="text-sm text-muted">
                vlastní:
              </label>
              <input
                id="gramaz-vlastni"
                ref={vlastniRef}
                type="number"
                min={1}
                max={MAX_GRAMU}
                inputMode="decimal"
                value={hodnota}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  if (Number.isFinite(g) && g > 0) onZmena(Math.min(MAX_GRAMU, g));
                }}
                className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums text-fg focus:outline-2 focus:outline-primary"
              />
              <span className="text-sm text-muted">g</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
