import { useEffect } from "react";

/**
 * Titulky stránek – nastavuje document.title ve tvaru „Název · OptiMeal"
 * podle aktuální cesty (záložka prohlížeče, sdílené odkazy, screen reader).
 */

const ZAKLAD = "OptiMeal – jezte lépe, šetřete peníze";

/** Přesné shody cest uvnitř shellu. */
const PRESNE: Record<string, string> = {
  "/": "Přehled",
  "/jidelnicek": "Jídelníček",
  "/recepty": "Recepty",
  "/recepty/novy": "Nový recept",
  "/potraviny": "Katalog potravin",
  "/mealprep": "Mealprep",
  "/nakup": "Nákupní seznamy",
  "/denik": "Jídelní deník",
  "/ucet": "Můj účet",
  "/nastaveni": "Nastavení",
};

/** Prefixy pro dynamické cesty (detail receptu, detail plánu, editace). */
const PREFIXY: [string, string][] = [
  ["/recepty/", "Recept"],
  ["/plany/", "Plán"],
];

export function titulekProCestu(pathname: string): string {
  const nazev =
    PRESNE[pathname] ??
    PREFIXY.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  return nazev ? `${nazev} · OptiMeal` : ZAKLAD;
}

/** Hook pro samostatné stránky mimo shell (přihlášení, registrace…). */
export function useTitulek(nazev: string) {
  useEffect(() => {
    const predchozi = document.title;
    document.title = `${nazev} · OptiMeal`;
    return () => {
      document.title = predchozi;
    };
  }, [nazev]);
}
