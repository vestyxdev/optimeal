import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Stav {
  chyba: Error | null;
}

/**
 * Hranice chyb – zachytí pád při vykreslování a místo bílé obrazovky
 * ukáže ovladatelný stav s možností načíst aplikaci znovu.
 * Chybu vypíše do konzole pro ladění (v produkci by šla do Sentry apod.).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, Stav> {
  state: Stav = { chyba: null };

  static getDerivedStateFromError(chyba: Error): Stav {
    return { chyba };
  }

  componentDidCatch(chyba: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console -- zachycená chyba patří do konzole
    console.error("Nechycená chyba v Reactu:", chyba, info.componentStack);
  }

  render() {
    if (!this.state.chyba) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">
            Něco se pokazilo
          </h1>
          <p className="mt-2 text-sm text-muted">
            Aplikace narazila na neočekávanou chybu. Zkuste stránku načíst znovu –
            vaše data jsou v bezpečí na serveru.
          </p>
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
            {this.state.chyba.message}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              varianta="outline"
              onClick={() => this.setState({ chyba: null })}
            >
              Zkusit znovu
            </Button>
            <Button onClick={() => window.location.assign("/")}>
              Obnovit aplikaci
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
