import { useEffect, useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Detekce {
  rawValue: string;
}
interface Detektor {
  detect(zdroj: HTMLVideoElement): Promise<Detekce[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => Detektor;
  }
}

/** Pravda, když prohlížeč umí nativní detekci čárových kódů (Chrome, Edge, Android). */
export function podporujeSkenovaniKodu(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

/**
 * Panel skenování čárového kódu kamerou.
 * Používá nativní BarcodeDetector – kam nedosáhl (Firefox, Safari),
 * komponentu vůbec nenabízíme a kód zadává uživatel ručně.
 */
export function SkenovaniEan({
  naKod,
  naZavreni,
}: {
  naKod: (kod: string) => void;
  naZavreni: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let zruseno = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let behi = false;

    async function spust() {
      const konstruktor = window.BarcodeDetector;
      if (!konstruktor) {
        setChyba("Tento prohlížeč skenování kódů nepodporuje – opište kód ručně.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (!zruseno) {
          setChyba("Nepodařilo se spustit kameru – zkontrolujte oprávnění prohlížeče.");
        }
        return;
      }
      if (zruseno) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detektor = new konstruktor({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      interval = setInterval(async () => {
        if (behi || zruseno || !videoRef.current) return;
        behi = true;
        try {
          const nalezy = await detektor.detect(videoRef.current);
          if (nalezy.length > 0 && !zruseno) naKod(nalezy[0]!.rawValue);
        } catch {
          /* nečitelný snímek – zkoušíme dál */
        } finally {
          behi = false;
        }
      }, 350);
    }

    spust();
    return () => {
      zruseno = true;
      if (interval) clearInterval(interval);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [naKod]);

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ScanBarcode className="size-4" /> Zamířte kamerou na čárový kód
        </p>
        <button
          type="button"
          onClick={naZavreni}
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface"
          aria-label="Zavřít skenování"
        >
          <X className="size-4" />
        </button>
      </div>
      {chyba ? (
        <p role="alert" className="text-sm text-danger">{chyba}</p>
      ) : (
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.9)]"
          />
        </div>
      )}
      <Button type="button" varianta="outline" onClick={naZavreni}>
        Zavřít
      </Button>
    </div>
  );
}
