import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";

/**
 * Společný rámec auth stránek (přihlášení, registrace, hesla) –
 * vertikálně centrovaný, s logotypem značky a návratem na přehled.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8 flex flex-col items-center gap-2.5" aria-label="Zpět na přehled">
        <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-fg">
          <Leaf className="size-6" />
        </span>
        <span className="om-display text-2xl font-extrabold tracking-tight">
          OptiMeal
        </span>
        <span className="text-sm text-muted">Jezte lépe, šetřete peníze.</span>
      </Link>
      <div className="om-karta w-full max-w-sm p-6">{children}</div>
    </div>
  );
}
