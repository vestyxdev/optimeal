import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Správa motivu (světlý / tmavý / systém) – výchozí je systém.
 * Třída `dark` na <html> řídí celý design systém (viz index.css).
 */

type Motiv = "light" | "dark" | "system";

const MotivKontext = createContext<{
  motiv: Motiv;
  nastavMotiv: (m: Motiv) => void;
}>({ motiv: "system", nastavMotiv: () => undefined });

const KLIC = "optimeal-motiv";

function vyhodnotDark(motiv: Motiv): boolean {
  return (
    motiv === "dark" ||
    (motiv === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function MotivPoskytovatel({ children }: { children: ReactNode }) {
  const [motiv, setMotiv] = useState<Motiv>(() => {
    try {
      return (localStorage.getItem(KLIC) as Motiv | null) ?? "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    const usej = () => {
      document.documentElement.classList.toggle("dark", vyhodnotDark(motiv));
    };
    usej();
    try {
      localStorage.setItem(KLIC, motiv);
    } catch {
      /* blokováno – nevadí */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (motiv === "system") {
      mq.addEventListener("change", usej);
      return () => mq.removeEventListener("change", usej);
    }
  }, [motiv]);

  return (
    <MotivKontext.Provider value={{ motiv, nastavMotiv: setMotiv }}>
      {children}
    </MotivKontext.Provider>
  );
}

export function useMotiv() {
  return useContext(MotivKontext);
}
