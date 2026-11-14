import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/Nacitani";

/**
 * Ochrana rout – nepřihlášeného uživatele přesměruje na přihlášení
 * a zapamatuje si cílovou adresu (po přihlášení se vrátí zpět).
 */
export function VyzadujePrihlaseni({ children }: { children: ReactNode }) {
  const { uzivatel, nacitaSe } = useAuth();
  const lokalita = useLocation();

  if (nacitaSe) {
    return (
      <div className="space-y-3" aria-label="Načítám">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!uzivatel) {
    return (
      <Navigate
        to="/prihlaseni"
        state={{ zpetNa: lokalita.pathname + lokalita.search }}
        replace
      />
    );
  }
  return <>{children}</>;
}
