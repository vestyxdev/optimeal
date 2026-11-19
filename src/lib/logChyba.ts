/**
 * Centrální hlášení chyb – jediné místo, kam míří nezachycené
 * i zachycené chyby v produkci. Dnes: strukturovaný console.error;
 * připraveno na napojení Sentry nebo Supabase error tabulky
 * (stačí doplnit odeslání v `zpracujChybu`).
 */

export interface KontextChyby {
  /** odkud chyba pochází – „error-boundary" | „window" | „unhandled-rejection" | vlastní */
  zdroj: string;
  /** cesta nebo komponenta */
  misto?: string;
  /** případný stack komponenty z ErrorBoundary */
  stack?: string;
}

/** Externí odesílač – např. Sentry.captureException nebo insert do error_log. */
type OdeslacFce = (chyba: Error, kontext: KontextChyby) => void;
let externiOdesilac: OdeslacFce | null = null;

/** Registrace externího odesílače (Sentry init v produkci). */
export function nastavOdesilacChyb(fce: OdeslacFce): void {
  externiOdesilac = fce;
}

/**
 * Zapíše chybu – konzole vždy (strukturovaně), externí odesílač
 * když je nastavený. Nikdy nehází – logování nesmí samo spadnout.
 */
export function logChyba(chyba: unknown, kontext: KontextChyby): void {
  const err = chyba instanceof Error ? chyba : new Error(String(chyba));
  try {
    // eslint-disable-next-line no-console -- strukturovaný diagnostický výstup
    console.error(`[${kontext.zdroj}]`, err.message, {
      misto: kontext.misto,
      stack: kontext.stack ?? err.stack,
    });
    externiOdesilac?.(err, kontext);
  } catch {
    /* logování nesmí shodit aplikaci */
  }
}
