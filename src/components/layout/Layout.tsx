import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Carrot,
  ChefHat,
  CookingPot,
  Ellipsis,
  Leaf,
  Moon,
  NotebookPen,
  Receipt,
  Settings,
  ShoppingBasket,
  Sun,
  UserRound,
  UtensilsCrossed,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { titulekProCestu } from "@/lib/titulky";
import { useAuth } from "@/lib/auth";
import { useMotiv } from "@/lib/motiv";
import { Button } from "@/components/ui/Button";

/**
 * Aplikační shell – desktop: úzké boční menu, mobil: spodní lišta
 * s nabídkou „Více“ pro sekundární sekce.
 */

interface Sekce {
  cesta: string;
  nazev: string;
  ikona: typeof Leaf;
  /** v mobilní spodní liště (primární položky) */
  vListe?: boolean;
}

const SEKCE: Sekce[] = [
  { cesta: "/", nazev: "Přehled", ikona: Receipt, vListe: true },
  { cesta: "/jidelnicek", nazev: "Jídelníček", ikona: UtensilsCrossed, vListe: true },
  { cesta: "/recepty", nazev: "Recepty", ikona: ChefHat, vListe: true },
  { cesta: "/nakup", nazev: "Nákup", ikona: ShoppingBasket, vListe: true },
  { cesta: "/denik", nazev: "Deník", ikona: NotebookPen, vListe: true },
  // ostatní sekce jsou na mobilu v nabídce „Více“ – spodní lišta má jen 5+1 slotů
  { cesta: "/potraviny", nazev: "Potraviny", ikona: Carrot },
  { cesta: "/mealprep", nazev: "Mealprep", ikona: CookingPot },
  { cesta: "/ucet", nazev: "Můj účet", ikona: UserRound },
  { cesta: "/nastaveni", nazev: "Nastavení", ikona: Settings },
];

/** Sekce schované na mobilu do menu „Více“ (pořadí zachovává SEKCE). */
const SEKCE_VICE = SEKCE.filter((s) => !s.vListe);

export function Layout() {
  const { uzivatel, odhlasit } = useAuth();
  const { motiv, nastavMotiv } = useMotiv();
  const naviguj = useNavigate();
  const { pathname } = useLocation();
  const [viceOtevrene, nastavViceOtevrene] = useState(false);
  const viceDialogRef = useRef<HTMLDivElement>(null);
  const viceTlacitkoRef = useRef<HTMLButtonElement>(null);
  // offline stav – v obchodě se signál ztrácí; upozorníme, že data
  // nemusí být čerstvá a dotazy počkají na síť
  const [online, setOnline] = useState(
    typeof navigator === "undefined" || navigator.onLine,
  );
  useEffect(() => {
    const nahoru = () => setOnline(true);
    const dolu = () => setOnline(false);
    window.addEventListener("online", nahoru);
    window.addEventListener("offline", dolu);
    return () => {
      window.removeEventListener("online", nahoru);
      window.removeEventListener("offline", dolu);
    };
  }, []);

  // titulek záložky podle aktuální cesty
  useEffect(() => {
    document.title = titulekProCestu(pathname);
  }, [pathname]);

  // fokus: při otevření do panelu, při zavření zpět na tlačítko „Více“
  useEffect(() => {
    if (!viceOtevrene) return;
    const panel = viceDialogRef.current;
    const prvni = panel?.querySelector<HTMLElement>("a, button");
    prvni?.focus();
    return () => viceTlacitkoRef.current?.focus();
  }, [viceOtevrene]);

  const odkazSekce = (s: Sekce, mobilni: boolean) => (
    <NavLink
      key={s.cesta}
      to={s.cesta}
      className={({ isActive }) =>
        cn(
          mobilni
            ? "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
            : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? mobilni
              ? "text-primary"
              : "bg-primary-soft text-primary"
            : mobilni
              ? "text-muted"
              : "text-muted hover:bg-surface-2 hover:text-fg",
        )
      }
    >
      <s.ikona className={mobilni ? "size-5" : "size-4.5"} />
      {s.nazev}
    </NavLink>
  );

  return (
    <div className="flex min-h-dvh">
      <a
        href="#obsah"
        className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Přeskočit na obsah
      </a>
      {/* ---- desktop: boční menu ---- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg">
            <Leaf className="size-5" />
          </span>
          <span className="om-display text-lg font-extrabold tracking-tight">OptiMeal</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {SEKCE.map((s) => odkazSekce(s, false))}
        </nav>
        <div className="space-y-3 px-5 py-4 text-xs text-muted">
          <button
            onClick={() => nastavMotiv(motiv === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {motiv === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {motiv === "dark" ? "Světlý motiv" : "Tmavý motiv"}
          </button>
          {uzivatel ? (
            <div className="space-y-2">
              <div className="truncate font-medium text-fg">{uzivatel.email}</div>
              <Button varianta="outline" velikost="sm" onClick={() => void odhlasit()}>
                Odhlásit se
              </Button>
            </div>
          ) : (
            <Button
              velikost="sm"
              onClick={() => naviguj("/prihlaseni")}
              className="w-full"
            >
              Přihlásit se
            </Button>
          )}
        </div>
      </aside>

      {/* ---- obsah ---- */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-xs font-semibold text-warning"
          >
            <WifiOff className="size-4" aria-hidden />
            Jste offline – ceny a zápisy počkají na připojení.
          </div>
        )}
        {/* mobilní horní lišta */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg">
              <Leaf className="size-4" />
            </span>
            <span className="om-display text-base font-extrabold">OptiMeal</span>
          </div>
          {uzivatel ? (
            <Button
              varianta="ghost"
              velikost="sm"
              onClick={() => void odhlasit()}
            >
              Odhlásit
            </Button>
          ) : (
            <Button velikost="sm" onClick={() => naviguj("/prihlaseni")}>
              Přihlásit
            </Button>
          )}
        </header>

        <main id="obsah" className="om-kontejner w-full flex-1 py-6">
          {/* hranice per-routa: pád jedné stránky nezabije navigaci;
              key=pathname hranici při přechodu resetuje */}
          <ErrorBoundary key={pathname} kompaktni>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* minimalistická patička – transparentnost dat + právní odkazy */}
        <footer className="border-t border-border px-4 py-4 text-xs text-muted md:px-6">
          <div className="om-kontejner flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="max-w-xl">
              Ceny a slevy agregujeme z veřejných zdrojů obchodů (letáky, e-shopy,
              Kupi.cz, OpenFoodFacts). Skutečná cena v konkrétní prodejně se může lišit –
              před nákupem ověřte cenovku na regálu.
            </p>
            <nav className="flex gap-4" aria-label="Právní odkazy">
              <NavLink to="/soukromi" className="hover:text-fg hover:underline">
                Ochrana soukromí
              </NavLink>
              <NavLink to="/podminky" className="hover:text-fg hover:underline">
                Podmínky použití
              </NavLink>
            </nav>
          </div>
        </footer>
      </div>

      {/* ---- mobil: spodní navigace ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Hlavní navigace"
      >
        {SEKCE.filter((s) => s.vListe).map((s) => odkazSekce(s, true))}
        <button
          type="button"
          ref={viceTlacitkoRef}
          onClick={() => nastavViceOtevrene(true)}
          aria-expanded={viceOtevrene}
          aria-haspopup="dialog"
          aria-label="Další sekce – Potraviny, Mealprep, Můj účet, Nastavení"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted"
        >
          <Ellipsis className="size-5" />
          Více
        </button>
      </nav>

      {/* ---- mobil: nabídka „Více“ ---- */}
      {viceOtevrene && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => nastavViceOtevrene(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") nastavViceOtevrene(false);
          }}
          role="presentation"
        >
          <div
            ref={viceDialogRef}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-4 pb-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Další sekce"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Tab-trap – fokus zůstává uvnitř panelu
              if (e.key !== "Tab") return;
              const prvky = e.currentTarget.querySelectorAll<HTMLElement>(
                "a[href], button:not([disabled])",
              );
              if (prvky.length === 0) return;
              const prvni = prvky[0]!;
              const posledni = prvky[prvky.length - 1]!;
              if (e.shiftKey && document.activeElement === prvni) {
                posledni.focus();
                e.preventDefault();
              } else if (!e.shiftKey && document.activeElement === posledni) {
                prvni.focus();
                e.preventDefault();
              }
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <nav className="space-y-0.5" aria-label="Další sekce">
              {SEKCE_VICE.map((s) => (
                <NavLink
                  key={s.cesta}
                  to={s.cesta}
                  onClick={() => nastavViceOtevrene(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
                    )
                  }
                >
                  <s.ikona className="size-4.5" />
                  {s.nazev}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => nastavMotiv(motiv === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg hover:bg-surface-2"
              >
                {motiv === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
                {motiv === "dark" ? "Světlý motiv" : "Tmavý motiv"}
              </button>
              {uzivatel && (
                <Button
                  varianta="outline"
                  className="w-full"
                  onClick={() => void odhlasit()}
                >
                  Odhlásit se ({uzivatel.email})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
