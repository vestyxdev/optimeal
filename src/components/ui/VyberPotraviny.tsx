import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Barcode, ChevronDown, Plus, Search, X } from "lucide-react";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { podporujeSkenovaniKodu, SkenovaniEan } from "@/components/potraviny/SkenovaniEan";
import { hledejPodleEanLokalne } from "@/lib/data/potraviny";
import { cn } from "@/lib/cn";

/**
 * Hledací výběr potraviny – full-screen search sheet ve stylu
 * kalorických tabulek: tisícový katalog se prohledává psaním
 * (bez diakritiky), skenem EAN, nebo výběrem z řádků s fotkou
 * a kcal/100 g. Náhrada nativního <select>, který s velkým
 * katalogem nejde použít.
 */

export interface PolozkaVyberu {
  id: string;
  nazev: string;
  kalorie: number;
  aktualniCena: number;
  sleva: boolean;
  obrazek?: string | null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MAX_VYSLEDKU = 80;

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
  const [skenuje, setSkenuje] = useState(false);

  const vybrana = useMemo(
    () => potraviny.find((p) => p.id === hodnota) ?? null,
    [potraviny, hodnota],
  );

  const filtrovane = useMemo(() => {
    const d = norm(dotaz.trim());
    if (d === "") return potraviny.slice(0, MAX_VYSLEDKU);
    return potraviny.filter((p) => norm(p.nazev).includes(d)).slice(0, MAX_VYSLEDKU);
  }, [potraviny, dotaz]);

  // zámek posouvání pozadí + Escape zavře
  useEffect(() => {
    if (!otevreno) return;
    const stary = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtevreno(false);
    };
    document.addEventListener("keydown", naKlavesu);
    return () => {
      document.documentElement.style.overflow = stary;
      document.removeEventListener("keydown", naKlavesu);
    };
  }, [otevreno]);

  const otevri = () => {
    setDotaz("");
    setSkenuje(false);
    setOtevreno(true);
  };

  const vyber = (id: string) => {
    onZmena(id);
    setOtevreno(false);
  };

  const naKod = async (kod: string) => {
    setSkenuje(false);
    try {
      const hit = await hledejPodleEanLokalne(kod.replace(/\s+/g, ""));
      if (hit) {
        vyber(hit.id);
        toast.success(`Nalezeno: ${hit.nazev}`);
      } else {
        toast.error("Tento kód v katalogu není – zkuste hledat názvem.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hledání podle kódu selhalo.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={otevri}
        aria-label={ariaLabel ?? "Vybrat potravinu"}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-surface px-2 text-left text-sm text-fg focus:outline-2 focus:outline-primary",
          chyba ? "border-danger" : "border-border",
        )}
      >
        {vybrana ? (
          <>
            <MiniaturaPotraviny obrazek={vybrana.obrazek} velikost="size-7" />
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

      {otevreno && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Výběr potraviny">
          {/* hlavička: zavřít + hledání + sken */}
          <div className="flex items-center gap-2 border-b border-border p-3">
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              aria-label="Zavřít výběr"
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-5" />
            </button>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={dotaz}
                onChange={(e) => setDotaz(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtrovane.length > 0) {
                    e.preventDefault();
                    vyber(filtrovane[0]!.id);
                  }
                }}
                placeholder="Hledat potravinu…"
                aria-label="Hledat potravinu"
                className="h-10 w-full rounded-full border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
              />
            </div>
            {podporujeSkenovaniKodu() && (
              <button
                type="button"
                onClick={() => setSkenuje((s) => !s)}
                aria-label="Naskenovat čárový kód"
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2",
                  skenuje ? "bg-primary/15 text-primary" : "text-muted hover:text-fg",
                )}
              >
                <Barcode className="size-5" />
              </button>
            )}
          </div>

          {/* skener nebo seznam */}
          {skenuje ? (
            <div className="p-4">
              <SkenovaniEan naKod={naKod} naZavreni={() => setSkenuje(false)} />
            </div>
          ) : (
            <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto">
              {filtrovane.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.id === hodnota}
                    onClick={() => vyber(p.id)}
                    className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors hover:bg-surface"
                  >
                    <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{p.nazev}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span className="tabular-nums">{p.kalorie} kcal / 100 g</span>
                        {p.sleva && (
                          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                            SLEVA
                          </span>
                        )}
                        {p.aktualniCena > 0 && (
                          <span className="tabular-nums">{p.aktualniCena.toFixed(2)} Kč/100 g</span>
                        )}
                      </span>
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Plus className="size-4" />
                    </span>
                  </button>
                </li>
              ))}
              {filtrovane.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted">
                  Nic nenalezeno – zkuste jiný dotaz.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
