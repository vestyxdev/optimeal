import { Link } from "react-router-dom";
import { Leaf, SearchX } from "lucide-react";

/**
 * 404 – neexistující cesta. Místo tichého přesměrování řekne uživateli,
 * že stránka neexistuje, a nabídne cestu zpět.
 */
export function Nenalezeno() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-fg">
          <Leaf className="size-6" />
        </div>
        <p className="mt-6 text-sm font-semibold text-muted">Chyba 404</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          Stránka nebyla nalezena
        </h1>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted">
          <SearchX className="size-4" />
          Adresa, kterou hledáte, neexistuje – možná byla přesunuta nebo smazána.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
        >
          Zpět na přehled
        </Link>
      </div>
    </div>
  );
}
