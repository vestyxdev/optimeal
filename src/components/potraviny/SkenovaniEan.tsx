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

/**
 * Pravda, když má prohlížeč kameru – detekci kódů umíme všude:
 * nativní BarcodeDetector (Chrome, Edge, Android), jinde se
 * za běhu dotáhne ZXing knihovna (Firefox, Safari iOS).
 */
export function podporujeSkenovaniKodu(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/**
 * Panel skenování čárového kódu kamerou.
 * Nativní BarcodeDetector, kde je; jinde lazy ZXing fallback,
 * takže skenování funguje i ve Firefoxu a na iPhonu.
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
  // naKod v refu – rodič předává inline funkci, která se mění každý
  // render; bez refu by efekt restartoval kameru při každém renderu
  const naKodRef = useRef(naKod);
  naKodRef.current = naKod;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let zruseno = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let behi = false;
    // ZXing ovládání – vrací se z decodeFromConstraints (0.1.x)
    let ovladani: { stop: () => void } | null = null;

    async function spustNativne(konstruktor: NonNullable<typeof window.BarcodeDetector>) {
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
          if (nalezy.length > 0 && !zruseno) naKodRef.current(nalezy[0]!.rawValue);
        } catch {
          /* nečitelný snímek – zkoušíme dál */
        } finally {
          behi = false;
        }
      }, 350);
    }

    /** ZXing cesta – Firefox/Safari; knihovna se dotáhne až tady. */
    async function spustZxing() {
      const video = videoRef.current;
      if (!video) return;
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] =
          await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (zruseno) return;
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
            ],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        ovladani = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          video,
          (vysledek) => {
            if (vysledek && !zruseno) naKodRef.current(vysledek.getText());
          },
        );
      } catch {
        if (!zruseno) {
          setChyba("Nepodařilo se spustit kameru – zkontrolujte oprávnění prohlížeče.");
        }
      }
    }

    const konstruktor = window.BarcodeDetector;
    if (konstruktor) {
      void spustNativne(konstruktor);
    } else {
      void spustZxing();
    }

    return () => {
      zruseno = true;
      if (interval) clearInterval(interval);
      ovladani?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
