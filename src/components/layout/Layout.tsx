import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Carrot,
  ChefHat,
  CookingPot,
  Leaf,
  Moon,
  Receipt,
  Settings,
  ShoppingBasket,
  Sun,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { useMotiv } from "@/lib/motiv";
import { Button } from "@/components/ui/Button";

/**
 * Aplikační shell – desktop: úzké boční menu, mobil: spodní lišta.
 * Sekce se přidávají postupně, jak dává smysl – žádné mrtvé odkazy.
 * (Mealprep, slevy… přijdou v dalších fázích buildu.)
 */

interface Sekce {
  cesta: string;
  nazev: string;
  ikona: typeof Leaf;
  /** v mobilní spodní liště */
  vListe?: boolean;
}

const SEKCE: Sekce[] = [
  { cesta: "/", nazev: "Přehled", ikona: Receipt, vListe: true },
  { cesta: "/jidelnicek", nazev: "Jídelníček", ikona: UtensilsCrossed, vListe: true },
  { cesta: "/recepty", nazev: "Recepty", ikona: ChefHat, vListe: true },
  { cesta: "/potraviny", nazev: "Potraviny", ikona: Carrot },
  { cesta: "/mealprep", nazev: "Mealprep", ikona: CookingPot, vListe: true },
  { cesta: "/nakup", nazev: "Nákup", ikona: ShoppingBasket, vListe: true },
  { cesta: "/ucet", nazev: "Můj účet", ikona: UserRound, vListe: true },
  { cesta: "/nastaveni", nazev: "Nastavení", ikona: Settings },
];

export function Layout() {
  const { uzivatel, odhlasit } = useAuth();
  const { motiv, nastavMotiv } = useMotiv();
  const naviguj = useNavigate();

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
      {/* ---- desktop: boční menu ---- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg">
            <Leaf className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">OptiMeal</span>
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
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {/* mobilní horní lišta */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg">
              <Leaf className="size-4" />
            </span>
            <span className="text-base font-extrabold">OptiMeal</span>
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

        <main className="om-kontejner w-full flex-1 py-6">
          <Outlet />
        </main>
      </div>

      {/* ---- mobil: spodní navigace ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden">
        {SEKCE.filter((s) => s.vListe).map((s) => odkazSekce(s, true))}
      </nav>
    </div>
  );
}
