import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

/**
 * Ochrana rout – nepřihlášeného uživatele přesměruje na přihlášení
 * a zapamatuje si cílovou adresu (po přihlášení se vrátí zpět).
 */
export function VyzadujePrihlaseni({ children }: { children: ReactNode }) {
  const { uzivatel, nacitaSe } = useAuth();
  const lokalita = useLocation();

  if (nacitaSe) {
    return <p className="text-sm text-muted">Načítám…</p>;
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
