import { Component, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logChyba } from "@/lib/logChyba";
import { jeChybaChunku } from "@/lib/lazyRoute";

interface Stav {
  chyba: Error | null;
}

/**
 * Hranice chyb – zachytí pád při vykreslování a místo bílé obrazovky
 * ukáže ovladatelný stav s možností načíst aplikaci znovu.
 * Chybu vypíše do konzole pro ladění (v produkci by šla do Sentry apod.).
 *
 * U chyb zastaralého chunku po deployi „Zkusit znovu“ nemůže pomoct –
 * React.lazy si zamítnutý import pamatuje trvale. Jediná cesta je tvrdý
 * reload dokumentu, proto pro něj měníme copy i akci tlačítka.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; kompaktni?: boolean },
  Stav
> {
  state: Stav = { chyba: null };

  static getDerivedStateFromError(chyba: Error): Stav {
    return { chyba };
  }

  componentDidCatch(chyba: Error, info: { componentStack: string }) {
    logChyba(chyba, { zdroj: "error-boundary", stack: info.componentStack });
  }

  render() {
    const chyba = this.state.chyba;
    if (!chyba) return this.props.children;

    const mrtvyChunk = jeChybaChunku(chyba);
    const Ikona = mrtvyChunk ? RefreshCw : TriangleAlert;

    // kompaktní varianta pro hranici uvnitř shellu (routa) –
    // zbytek aplikace (navigace, hlavička) zůstane živý
    if (this.props.kompaktni) {
      return (
        <div className="mx-auto max-w-md rounded-card border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-danger-soft text-danger">
            <Ikona className="size-5" />
          </div>
          <h1 className="mt-3 text-lg font-extrabold tracking-tight">
            {mrtvyChunk ? "Je tu nová verze" : "Něco se pokazilo"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mrtvyChunk
              ? "Aplikace se mezitím aktualizovala – stránku stačí načíst znovu a vše poběží dál."
              : "Tato část aplikace narazila na chybu – ostatní sekce fungují dál."}
          </p>
          {!mrtvyChunk && (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
              {chyba.message}
            </p>
          )}
          <div className="mt-4 flex justify-center gap-2">
            {mrtvyChunk ? (
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Načíst novou verzi
              </Button>
            ) : (
              <Button
                varianta="outline"
                onClick={() => this.setState({ chyba: null })}
              >
                Zkusit znovu
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
            <Ikona className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">
            {mrtvyChunk ? "Je tu nová verze" : "Něco se pokazilo"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mrtvyChunk
              ? "Aplikace se mezitím aktualizovala. Načtěte stránku znovu – vaše data jsou v bezpečí na serveru."
              : "Aplikace narazila na neočekávanou chybu. Zkuste stránku načíst znovu – vaše data jsou v bezpečí na serveru."}
          </p>
          {!mrtvyChunk && (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
              {chyba.message}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            {mrtvyChunk ? (
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Načíst novou verzi
              </Button>
            ) : (
              <>
                <Button
                  varianta="outline"
                  onClick={() => this.setState({ chyba: null })}
                >
                  Zkusit znovu
                </Button>
                <Button onClick={() => window.location.assign("/")}>
                  Obnovit aplikaci
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
