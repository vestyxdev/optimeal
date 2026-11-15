import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";

/**
 * Společný rámec auth stránek (přihlášení, registrace, hesla).
 * Desktop: brand panel vlevo (cenovka + účtenka = identita produktu),
 * formulář vpravo. Mobil: kompaktní logotyp nad kartou.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel – jen desktop */}
      <div className="om-hero hidden flex-col justify-between bg-primary-hero p-10 text-white lg:flex">
        <Link to="/" className="flex w-fit items-center gap-2.5" aria-label="Zpět na přehled">
          <span className="grid size-9 place-items-center rounded-lg bg-white/10">
            <Leaf className="size-5" />
          </span>
          <span className="om-display text-lg font-extrabold tracking-tight">OptiMeal</span>
        </Link>

        <div className="relative space-y-8">
          <div className="max-w-sm space-y-3">
            <p className="om-display text-4xl font-extrabold leading-[1.1] tracking-tight">
              Jídelníček, který šetří.
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              Plány skládané z akčních cen českých supermarketů – a účtenka,
              která rovnou ukáže, kolik jste ušetřili.
            </p>
          </div>
          <UctenkaUkazka />
        </div>

        <p className="text-xs text-white/50">
          Ceny z letáků každý týden · Albert · Billa · Kaufland · Lidl · Penny · Tesco
        </p>
      </div>

      {/* formulář */}
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <Link
          to="/"
          className="mb-8 flex flex-col items-center gap-2.5 lg:hidden"
          aria-label="Zpět na přehled"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-fg">
            <Leaf className="size-6" />
          </span>
          <span className="om-display text-2xl font-extrabold tracking-tight">OptiMeal</span>
          <span className="text-sm text-muted">Jezte lépe, šetřete peníze.</span>
        </Link>
        <div className="om-karta w-full max-w-sm p-6">{children}</div>
      </div>
    </div>
  );
}

/** Papírová účtenka s ukázkou úspor – hero vizuál brand panelu. */
function UctenkaUkazka() {
  return (
    <div className="relative w-fit drop-shadow-xl" aria-hidden="true">
      <div className="om-uctenka w-56 px-4 pb-7 pt-4 text-[11px] leading-relaxed">
        <div className="text-center font-bold tracking-wide">OPTIMEAL</div>
        <div className="text-center text-[10px] opacity-70">váš týdenní nákup</div>
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        {[
          ["Kuřecí prsa 0,4 kg", "52 Kč"],
          ["Rýže 1 kg", "24 Kč"],
          ["Tvaroh 2 ks", "26 Kč"],
          ["Brokolice 0,3 kg", "14 Kč"],
        ].map(([nazev, cena]) => (
          <div key={nazev} className="flex justify-between gap-2">
            <span className="truncate">{nazev}</span>
            <span className="shrink-0 tabular-nums">{cena}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        <div className="flex justify-between font-bold">
          <span>CELKEM</span>
          <span className="tabular-nums">116 Kč</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>UŠETŘENO SLEVAMI</span>
          <span className="tabular-nums">−31 Kč</span>
        </div>
      </div>
      <span className="om-cenovka absolute -right-3 -top-3 rotate-6 text-xs">AKCE</span>
    </div>
  );
}
