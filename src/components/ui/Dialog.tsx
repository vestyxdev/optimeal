import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

/**
 * Modální dialog systému – nevrstvený, s fokusem dovnitř,
 * Escape zavře, klik na pozadí zavře. Používá nativní <dialog>.
 */
export function Dialog({
  otevren,
  naZavreni,
  nadpis,
  deti,
  paticka,
}: {
  otevren: boolean;
  naZavreni: () => void;
  nadpis: ReactNode;
  deti: ReactNode;
  paticka?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (otevren && !el.open) el.showModal();
    if (!otevren && el.open) el.close();
  }, [otevren]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const zavri = () => naZavreni();
    el.addEventListener("cancel", zavri);
    el.addEventListener("close", zavri);
    return () => {
      el.removeEventListener("cancel", zavri);
      el.removeEventListener("close", zavri);
    };
  }, [naZavreni]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        // klik na pozadí (mimo obsah) zavře
        if (e.target === ref.current) naZavreni();
      }}
      className={cn(
        "m-auto w-[min(92vw,26rem)] rounded-card border border-border bg-surface p-0 text-fg",
        "shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h2 className="text-base font-bold">{nadpis}</h2>
        <button
          type="button"
          onClick={naZavreni}
          aria-label="Zavřít"
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-3 text-sm">{deti}</div>
      {paticka && <div className="flex justify-end gap-2 px-5 pb-5">{paticka}</div>}
    </dialog>
  );
}

/**
 * Potvrzovací dialog pro destruktivní / důležité akce.
 * Nahrazuje window.confirm – konzistentní vzhled i motiv.
 */
export function PotvrdDialog({
  otevren,
  naZavreni,
  naPotvrzeni,
  nadpis,
  text,
  potvrdit = "Potvrdit",
  destruktivni = false,
}: {
  otevren: boolean;
  naZavreni: () => void;
  naPotvrzeni: () => void;
  nadpis: string;
  text: ReactNode;
  potvrdit?: string;
  destruktivni?: boolean;
}) {
  return (
    <Dialog
      otevren={otevren}
      naZavreni={naZavreni}
      nadpis={nadpis}
      deti={<p className="text-muted">{text}</p>}
      paticka={
        <>
          <Button varianta="outline" velikost="sm" onClick={naZavreni}>
            Zrušit
          </Button>
          <Button
            varianta={destruktivni ? "danger" : "primary"}
            velikost="sm"
            onClick={() => {
              naPotvrzeni();
              naZavreni();
            }}
          >
            {potvrdit}
          </Button>
        </>
      }
    />
  );
}
