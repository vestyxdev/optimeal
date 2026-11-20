import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * React.lazy s pojistkou proti zastaralým chunkům po novém deployi.
 *
 * Stará verze index.html v prohlížeči uživatele odkazuje na hashované
 * soubory, které po redeployi na CDN už neexistují – Vercel na ně
 * odpoví SPA fallbackem (text/html) a dynamický import selže chybou
 * „not a valid JavaScript MIME type". Namísto error screenu jednou
 * tvrdě reloadneme: nové index.html přitáhne aktuální hashe.
 *
 * Když se import nepovede ani po reloadu (výpadek CDN, offline),
 * příznak zůstane a chyba propadne do ErrorBoundary – žádná
 * nekonečná reload smyčka.
 */
const KLIC = "om-chunk-reload";

/** Typické texty chyb mrtvého dynamického importu napříč prohlížeči. */
const CHUNK_VZORY = [
  "text/html",
  "MIME type",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "ChunkLoadError",
];

/**
 * Pozná chybu zastaralého chunku – k ní vždy vede jediné
 * skutečné řešení: tvrdý reload dokumentu (React.lazy si
 * zamítaný import pamatuje napořád, samotný retry nestačí).
 */
export function jeChybaChunku(chyba: unknown): boolean {
  const zprava = chyba instanceof Error ? chyba.message : String(chyba ?? "");
  return CHUNK_VZORY.some((v) => zprava.includes(v));
}

/** Import s jednorázovým reloadem při selhání (zastaralý chunk). */
async function importSObnovou<T>(nacti: () => Promise<T>): Promise<T> {
  try {
    const modul = await nacti();
    try {
      sessionStorage.removeItem(KLIC);
    } catch {
      /* sessionStorage nedostupný – nevadí */
    }
    return modul;
  } catch (chyba) {
    let uzObnoveno = true;
    try {
      uzObnoveno = sessionStorage.getItem(KLIC) === "1";
      if (!uzObnoveno) sessionStorage.setItem(KLIC, "1");
    } catch {
      /* privátní režim apod. – prostě chybu propagovat */
    }
    if (!uzObnoveno) {
      window.location.reload();
      // reload překreslí stránku; promise záměrně neodpovídá,
      // ať React nevykreslí fallback/error screen mezitím
      return new Promise<T>(() => {});
    }
    try {
      sessionStorage.removeItem(KLIC);
    } catch {
      /* ignorovat */
    }
    throw chyba;
  }
}

// komponenty mají různé props – stejná signatura jako React.lazy (ComponentType<any>)

/** Lazy routa – modul s pojmenovaným exportem komponenty. */
export function lazyRoute<C extends ComponentType<any>>(
  nacti: () => Promise<Record<string, unknown>>,
  exportovane: string,
): LazyExoticComponent<C> {
  return lazy(async () => {
    const modul = await importSObnovou(nacti);
    return { default: modul[exportovane] as C };
  });
}

/**
 * Lazy vnitřní komponenta s default exportem (grafy, těžké části
 * stránky) – stejná pojistka jako lazyRoute, jinak by selhání
 * sdíleného chunku propadlo do ErrorBoundary.
 */
export function lazyKomponenta<C extends ComponentType<any>>(
  nacti: () => Promise<{ default: C }>,
): LazyExoticComponent<C> {
  return lazy(() => importSObnovou(nacti));
}
