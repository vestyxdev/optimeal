import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Package, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Hledací combobox pro výběr potraviny – náhrada nativního <select>,
 * který s tisícovým katalogem není použitelný (mobilní dropdown
 * se scrollem, hledání bez diakritiky, miniatura + cena).
 */

export interface PolozkaVyberu {
  id: string;
  nazev: string;
  aktualniCena: number;
  sleva: boolean;
  obrazek?: string | null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MAX_VYSLEDKU = 60;

export function VyberPotraviny({
  potraviny,
  hodnota,
  onZmena,
  chyba = false,
  ariaLabel,
}: {
  potraviny: PolozkaVyberu[];
  hodnota: string;
  onZmena: (id: string) => void;
  chyba?: boolean;
  ariaLabel?: string;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [dotaz, setDotaz] = useState("");
  const koren = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const vybrana = useMemo(
    () => potraviny.find((p) => p.id === hodnota) ?? null,
    [potraviny, hodnota],
  );

  const filtrovane = useMemo(() => {
    const d = norm(dotaz.trim());
    if (d === "") return potraviny.slice(0, MAX_VYSLEDKU);
    const shody = potraviny.filter((p) => norm(p.nazev).includes(d));
    return shody.slice(0, MAX_VYSLEDKU);
  }, [potraviny, dotaz]);

  // zavření klikem mimo / Escape
  useEffect(() => {
    if (!otevreno) return;
    const naKlik = (e: MouseEvent) => {
      if (koren.current && !koren.current.contains(e.target as Node)) setOtevreno(false);
    };
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtevreno(false);
    };
    document.addEventListener("mousedown", naKlik);
    document.addEventListener("keydown", naKlavesu);
    return () => {
      document.removeEventListener("mousedown", naKlik);
      document.removeEventListener("keydown", naKlavesu);
    };
  }, [otevreno]);

  useEffect(() => {
    if (otevreno) inputRef.current?.focus();
    else setDotaz("");
  }, [otevreno]);

  const vyber = (id: string) => {
    onZmena(id);
    setOtevreno(false);
  };

  return (
    <div ref={koren} className="relative">
      {otevreno ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={dotaz}
            onChange={(e) => setDotaz(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtrovane.length > 0) {
                e.preventDefault();
                vyber(filtrovane[0]!.id);
              }
            }}
            placeholder="Hledat potravinu…"
            aria-label={ariaLabel ?? "Hledat potravinu"}
            className="h-10 w-full rounded-lg border border-primary bg-surface pl-9 pr-9 text-sm text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
          />
          <button
            type="button"
            onClick={() => setOtevreno(false)}
            aria-label="Zavřít výběr"
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOtevreno(true)}
          aria-label={ariaLabel ?? "Vybrat potravinu"}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border bg-surface px-2 text-left text-sm text-fg focus:outline-2 focus:outline-primary",
            chyba ? "border-danger" : "border-border",
          )}
        >
          {vybrana ? (
            <>
              <Miniatura p={vybrana} />
              <span className="min-w-0 flex-1 truncate">{vybrana.nazev}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {vybrana.aktualniCena > 0 ? `${vybrana.aktualniCena.toFixed(2)} Kč` : "—"}
              </span>
            </>
          ) : (
            <span className="flex-1 text-muted">— potravina —</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      )}

      {otevreno && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-card border border-border bg-surface-2 shadow-lg"
        >
          {filtrovane.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.id === hodnota}
                onClick={() => vyber(p.id)}
                className="flex w-full items-center gap-2 border-b border-border/50 px-2.5 py-2 text-left text-sm text-fg transition-colors last:border-0 hover:bg-surface"
              >
                <Miniatura p={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.nazev}</span>
                </span>
                {p.sleva && (
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                    SLEVA
                  </span>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {p.aktualniCena > 0 ? `${p.aktualniCena.toFixed(2)} Kč/100 g` : "—"}
                </span>
              </button>
            </li>
          ))}
          {filtrovane.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted">
              Nic nenalezeno – zkuste jiný dotaz.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Miniatura({ p }: { p: PolozkaVyberu }) {
  const [chyba, setChyba] = useState(false);
  if (!p.obrazek || chyba) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
        <Package className="size-4" />
      </span>
    );
  }
  return (
    <img
      src={p.obrazek}
      alt=""
      loading="lazy"
      onError={() => setChyba(true)}
      className="size-8 shrink-0 rounded-md bg-white object-contain"
    />
  );
}
