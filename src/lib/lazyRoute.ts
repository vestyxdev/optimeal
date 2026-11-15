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

export function lazyRoute<C extends ComponentType<object>>(
  nacti: () => Promise<Record<string, unknown>>,
  exportovane: string,
): LazyExoticComponent<C> {
  return lazy(async () => {
    try {
      const modul = await nacti();
      try {
        sessionStorage.removeItem(KLIC);
      } catch {
        /* sessionStorage nedostupný – nevadí */
      }
      return { default: modul[exportovane] as C };
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
        return new Promise<{ default: C }>(() => {});
      }
      try {
        sessionStorage.removeItem(KLIC);
      } catch {
        /* ignorovat */
      }
      throw chyba;
    }
  });
}
