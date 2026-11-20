import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Armchair, Check, Dumbbell, Flame, Mars, Minus,
  Pencil, Plus, Scale, TrendingDown, TrendingUp, Venus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { nactiProfil, ulozCile, ulozProfil } from "@/lib/data/profil";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import { cn } from "@/lib/cn";
import type { Aktivita, Cile, CilTela, Pohlavi } from "@/lib/vyziva/cile";
import {
  aktivitaZTreninku,
  CILE_TELA,
  odhadTerminu,
  rozsahTempa,
  spocitejPlan,
  TRENINKY,
  cileZKcal,
  cileZGramu,
  type TreninkyTydne,
} from "@/lib/vyziva/plan";

/**
 * Průvodce cíli (Cal AI styl) – otázka za otázkou, automatické
 * posunutí po výběru karty, živý výpočet BMR/TDEE, tempo hubnutí
 * či nabírání s termínem a souhrn s ručně upravitelnými makry.
 * Přihlášenému se uloží do Supabase (profil + aktivní cíle),
 * hostovi do localStorage – při prvním přihlášení se přenese
 * automaticky (migrace v AuthPoskytovatel).
 */

export const LS_CILE_HOST = "om-cile-host";

type Krok = "pohlavi" | "treninky" | "udaje" | "cil" | "tempo" | "souhrn";
const KROKY: Krok[] = ["pohlavi", "treninky", "udaje", "cil", "tempo", "souhrn"];

const IKONY_CILE: Record<CilTela, LucideIcon> = {
  zhubnout: TrendingDown,
  udrzet: Scale,
  zhodnotit: TrendingUp,
};
const IKONY_TRENINKU: Record<TreninkyTydne, LucideIcon> = {
  "0-2": Armchair,
  "3-5": Dumbbell,
  "6+": Flame,
};

interface Stav {
  pohlavi: Pohlavi | null;
  treninky: TreninkyTydne | null;
  vek: string;
  vyska: string;
  vaha: string;
  cilTela: CilTela | null;
  cilovaVaha: string;
  tempo: number;
}

const VYCHOZI: Stav = {
  pohlavi: null,
  treninky: null,
  vek: "30",
  vyska: "175",
  vaha: "80",
  cilTela: null,
  cilovaVaha: "70",
  tempo: 0.5,
};

function cislo(h: string): number {
  const n = Number(h.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function CilPruvodce() {
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();
  const [krok, setKrok] = useState(0);
  const [smer, setSmer] = useState<"vpred" | "zpet">("vpred");
  const [stav, setStav] = useState<Stav>(VYCHOZI);
  const [upravy, setUpravy] = useState<Cile | null>(null);
  const casovac = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nadpisRef = useRef<HTMLHeadingElement>(null);

  // předvyplnění z profilu přihlášeného (jednorázově po načtení)
  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });
  const [predvyplneno, setPredvyplneno] = useState(false);
  const profil = dotazProfil.data;
  if (profil && !predvyplneno) {
    setPredvyplneno(true);
    setStav((s) => ({
      ...s,
      pohlavi: profil.pohlavi ?? s.pohlavi,
      treninky: aktivitaNaKartu(profil.aktivita) ?? s.treninky,
      vek: profil.vekRoku ? String(profil.vekRoku) : s.vek,
      vyska: profil.vyskaCm ? String(profil.vyskaCm) : s.vyska,
      vaha: profil.vahaKg ? String(profil.vahaKg) : s.vaha,
      cilTela: profil.cilTela ?? s.cilTela,
      cilovaVaha: profil.cilovaVahaKg ? String(profil.cilovaVahaKg) : s.cilovaVaha,
      tempo: profil.tempoKgTydne ?? s.tempo,
    }));
  }

  const cilTela = stav.cilTela;
  const krokyViditelne = useMemo(
    () => KROKY.filter((k) => k !== "tempo" || (cilTela !== null && cilTela !== "udrzet")),
    [cilTela],
  );
  const aktualniKrok = krokyViditelne[krok] ?? "souhrn";

  // po změně kroku přesunout fokus na otázku (screen reader + klávesnice)
  useEffect(() => {
    nadpisRef.current?.focus();
  }, [aktualniKrok]);

  const cisla = useMemo(
    () => ({ vek: cislo(stav.vek), vyska: cislo(stav.vyska), vaha: cislo(stav.vaha), cilovaVaha: cislo(stav.cilovaVaha) }),
    [stav.vek, stav.vyska, stav.vaha, stav.cilovaVaha],
  );

  // průběžný plán – počítá se živě na kroku tempo i souhrn
  const plan = useMemo(() => {
    if (!stav.pohlavi || !stav.treninky || !cilTela) return null;
    if (!platnyVek(cisla.vek) || !platnaVyska(cisla.vyska) || !platnaVaha(cisla.vaha)) return null;
    return spocitejPlan({
      pohlavi: stav.pohlavi,
      treninky: stav.treninky,
      vekRoku: cisla.vek,
      vyskaCm: cisla.vyska,
      vahaKg: cisla.vaha,
      cilTela,
      ...(cilTela !== "udrzet" ? { cilovaVahaKg: cisla.cilovaVaha } : {}),
      tempoKgTydne: stav.tempo,
    });
  }, [stav.pohlavi, stav.treninky, stav.tempo, cilTela, cisla]);

  const cile = upravy ?? plan?.cile ?? null;

  const mutaceUlozit = useMutation({
    mutationFn: async (c: Cile) => {
      if (!uzivatel) {
        // host – cíle se přenesou při prvním přihlášení
        try {
          localStorage.setItem(LS_CILE_HOST, JSON.stringify({
            vstupy: {
              pohlavi: stav.pohlavi, aktivita: aktivitaZTreninku(stav.treninky!),
              cilTela, vahaKg: cisla.vaha, vyskaCm: cisla.vyska, vekRoku: cisla.vek,
              cilovaVahaKg: cilTela === "udrzet" ? null : cisla.cilovaVaha,
              tempoKgTydne: cilTela === "udrzet" ? null : stav.tempo,
            },
            cile: c,
          }));
        } catch {
          throw new Error("Lokální úložiště není dostupné – cíle se nepodařilo uložit.");
        }
        return;
      }
      await ulozProfil({
        pohlavi: stav.pohlavi,
        aktivita: aktivitaZTreninku(stav.treninky!),
        cilTela,
        vahaKg: cisla.vaha,
        vyskaCm: cisla.vyska,
        vekRoku: cisla.vek,
        cilovaVahaKg: cilTela === "udrzet" ? null : cisla.cilovaVaha,
        tempoKgTydne: cilTela === "udrzet" ? null : stav.tempo,
      });
      await ulozCile(c, upravy ? "manual" : "auto");
    },
    onSuccess: () => {
      void klientQ.invalidateQueries({ queryKey: ["cile"] });
      void klientQ.invalidateQueries({ queryKey: ["profil"] });
      toast.success(uzivatel ? "Plán uložen – jede se!" : "Plán uložen v zařízení – po přihlášení se přenese.");
      if (uzivatel) naviguj(-1);
      else naviguj("/");
    },
    onError: (e) => toast.error(`Plán se neuložil: ${(e as Error).message}`),
  });

  function zrusAuto() {
    if (casovac.current) {
      clearTimeout(casovac.current);
      casovac.current = null;
    }
  }
  function dalsi() {
    zrusAuto();
    setSmer("vpred");
    setKrok((k) => k + 1);
  }
  function zpet() {
    zrusAuto();
    setSmer("zpet");
    setKrok((k) => Math.max(0, k - 1));
  }
  /** Výběr karty → krátká animace zaškrtnutí a automatický posun dál. */
  function vyberADalsi(aplikuj: () => void) {
    aplikuj();
    zrusAuto();
    casovac.current = setTimeout(() => {
      casovac.current = null;
      setSmer("vpred");
      setKrok((k) => k + 1);
    }, 300);
  }

  const muzeDalsi = validujKrok(aktualniKrok, stav, cisla);
  const posledniKrok = krok === krokyViditelne.length - 1;
  const jeKarty = aktualniKrok === "pohlavi" || aktualniKrok === "treninky" || aktualniKrok === "cil";

  return (
    <div
      className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col"
      onKeyDown={(e) => {
        // Enter v číselných polích posune dál
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && !posledniKrok && muzeDalsi) {
          e.preventDefault();
          dalsi();
        }
      }}
    >
      {/* tenký průběhový proužek + čítač kroků */}
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>Krok {krok + 1} z {krokyViditelne.length}</span>
        <span>{TITULEK_KROKU[aktualniKrok]}</span>
      </div>
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((krok + 1) / krokyViditelne.length) * 100)}
        aria-label="Postup průvodce"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${((krok + 1) / krokyViditelne.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 py-6">
        <div key={aktualniKrok} className={smer === "vpred" ? "om-krok-vpred" : "om-krok-zpet"}>
          {aktualniKrok === "pohlavi" && (
            <KrokOtazka ref={nadpisRef} otazka="Jaké je tvé pohlaví?" podtitul="Ovlivňuje výpočet bazálního metabolismu.">
              <VyberKarty
                volby={[
                  { klic: "m" as const, titul: "Muž", popis: "", ikona: Mars },
                  { klic: "z" as const, titul: "Žena", popis: "", ikona: Venus },
                ]}
                vybrano={stav.pohlavi}
                naVyber={(k) => vyberADalsi(() => setStav({ ...stav, pohlavi: k }))}
              />
            </KrokOtazka>
          )}

          {aktualniKrok === "treninky" && (
            <KrokOtazka ref={nadpisRef} otazka="Kolikrát týdně trénuješ?" podtitul="Určuje tvůj faktor aktivity (TDEE).">
              <VyberKarty
                volby={TRENINKY.map((t) => ({ klic: t.klic, titul: t.titul, popis: t.popis, ikona: IKONY_TRENINKU[t.klic] }))}
                vybrano={stav.treninky}
                naVyber={(k) => vyberADalsi(() => setStav({ ...stav, treninky: k }))}
              />
            </KrokOtazka>
          )}

          {aktualniKrok === "udaje" && (
            <KrokOtazka ref={nadpisRef} otazka="Věk, výška a váha" podtitul="Z nich vypočítáme tvůj základní výdej energie.">
              <div className="space-y-2">
                <VolicCisla id="cile-vek" popis="Věk" jednotka="let" hodnota={stav.vek}
                  naZmenu={(v) => setStav({ ...stav, vek: v })} min={10} max={100} />
                <VolicCisla id="cile-vyska" popis="Výška" jednotka="cm" hodnota={stav.vyska}
                  naZmenu={(v) => setStav({ ...stav, vyska: v })} min={120} max={230} />
                <VolicCisla id="cile-vaha" popis="Váha" jednotka="kg" hodnota={stav.vaha}
                  naZmenu={(v) => setStav({ ...stav, vaha: v })} min={30} max={300} />
              </div>
              {plan && (
                <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-muted">
                  Odhad základního výdeje: <span className="font-semibold text-fg">{formatujKcal(plan.bmr)} kcal</span>,
                  s aktivitou <span className="font-semibold text-fg">{formatujKcal(plan.tdee)} kcal</span> denně.
                </p>
              )}
            </KrokOtazka>
          )}

          {aktualniKrok === "cil" && (
            <KrokOtazka ref={nadpisRef} otazka="Jaký je tvůj cíl?" podtitul="Podle něj nastavíme kalorie a makra.">
              <VyberKarty
                volby={CILE_TELA.map((c) => ({ klic: c.klic, titul: c.titul, popis: c.popis, ikona: IKONY_CILE[c.klic] }))}
                vybrano={stav.cilTela}
                naVyber={(k) => vyberADalsi(() => {
                  const rozsah = rozsahTempa(k);
                  setStav({
                    ...stav,
                    cilTela: k,
                    tempo: rozsah.vychozi || stav.tempo,
                    cilovaVaha:
                      k === "udrzet" ? stav.cilovaVaha
                      : Number.isFinite(cisla.cilovaVaha) && cisla.cilovaVaha !== cisla.vaha
                        ? stav.cilovaVaha
                        : String(cisla.vaha + (k === "zhubnout" ? -5 : 3)),
                  });
                })}
              />
            </KrokOtazka>
          )}

          {aktualniKrok === "tempo" && cilTela && cilTela !== "udrzet" && (
            <KrokTempo nadpisRef={nadpisRef} stav={stav} cisla={cisla} cilTela={cilTela} plan={plan} setStav={setStav} />
          )}

          {aktualniKrok === "souhrn" && plan && cile && (
            <KrokSouhrn nadpisRef={nadpisRef} plan={plan} cile={cile} setUpravy={setUpravy} cilTela={cilTela!}
              aktualniVaha={cisla.vaha} cilovaVaha={cisla.cilovaVaha} />
          )}
        </div>
      </div>

      {/* navigace */}
      <div className="flex items-center gap-3 pb-2">
        {krok > 0 && (
          <Button varianta="ghost" onClick={zpet} aria-label="Zpět">
            <ArrowLeft className="size-4" /> Zpět
          </Button>
        )}
        <div className="flex-1" />
        {!posledniKrok ? (
          jeKarty ? (
            <p className="text-xs text-muted">Vyber možnost – půjdeš dál automaticky</p>
          ) : (
            <Button onClick={dalsi} disabled={!muzeDalsi}>
              Pokračovat <ArrowRight className="size-4" />
            </Button>
          )
        ) : (
          <Button
            onClick={() => cile && mutaceUlozit.mutate(cile)}
            disabled={!cile || mutaceUlozit.isPending}
            className="h-12 px-6 text-base"
          >
            <Check className="size-5" />
            {mutaceUlozit.isPending ? "Ukládám…" : uzivatel ? "Uložit plán a začít" : "Uložit do zařízení"}
          </Button>
        )}
      </div>
    </div>
  );
}

const TITULEK_KROKU: Record<Krok, string> = {
  pohlavi: "Pohlaví",
  treninky: "Aktivita",
  udaje: "Míry",
  cil: "Cíl",
  tempo: "Tempo",
  souhrn: "Plán",
};

function aktivitaNaKartu(a: Aktivita | null): TreninkyTydne | null {
  if (a === "sedava" || a === "mirna") return "0-2";
  if (a === "aktivni") return "3-5";
  if (a === "velmi") return "6+";
  return null;
}

const platnyVek = (n: number) => Number.isFinite(n) && n >= 10 && n <= 100;
const platnaVyska = (n: number) => Number.isFinite(n) && n >= 120 && n <= 230;
const platnaVaha = (n: number) => Number.isFinite(n) && n >= 30 && n <= 300;

function validujKrok(krok: Krok, s: Stav, c: { vek: number; vyska: number; vaha: number; cilovaVaha: number }): boolean {
  switch (krok) {
    case "pohlavi": return s.pohlavi !== null;
    case "treninky": return s.treninky !== null;
    case "udaje": return platnyVek(c.vek) && platnaVyska(c.vyska) && platnaVaha(c.vaha);
    case "cil": return s.cilTela !== null;
    case "tempo": {
      if (!s.cilTela || s.cilTela === "udrzet") return true;
      if (!platnaVaha(c.cilovaVaha)) return false;
      // cílová váha musí odpovídat směru cíle
      return s.cilTela === "zhubnout" ? c.cilovaVaha < c.vaha : c.cilovaVaha > c.vaha;
    }
    case "souhrn": return true;
  }
}

/** Obálka kroku – otázka + obsah; nadpis dostává fokus po přechodu. */
function KrokOtazka({ ref, otazka, podtitul, children }: {
  ref: React.Ref<HTMLHeadingElement>;
  otazka: string;
  podtitul?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 ref={ref} tabIndex={-1} className="text-[1.75rem] font-extrabold tracking-tight outline-none">
          {otazka}
        </h1>
        {podtitul && <p className="mt-1 text-sm text-muted">{podtitul}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Velké výběrové karty s ikonou – jednotlivé volby kroku. */
function VyberKarty<K extends string>({
  volby, vybrano, naVyber,
}: {
  volby: { klic: K; titul: string; popis: string; ikona: LucideIcon }[];
  vybrano: K | null;
  naVyber: (k: K) => void;
}) {
  return (
    <div className="grid gap-2.5" role="radiogroup">
      {volby.map((v) => {
        const aktivni = vybrano === v.klic;
        const Ikona = v.ikona;
        return (
          <button
            key={v.klic}
            type="button"
            role="radio"
            aria-checked={aktivni}
            onClick={() => naVyber(v.klic)}
            className={cn(
              "group flex min-h-[64px] items-center gap-3.5 rounded-card border-2 px-4 py-3.5 text-left",
              "transition-[border-color,background-color,transform] duration-150 active:scale-[0.985]",
              aktivni
                ? "border-primary bg-primary-soft shadow-card"
                : "border-border hover:border-primary/40 hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
                aktivni ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted group-hover:text-fg",
              )}
            >
              <Ikona className="size-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className={cn("block font-bold", aktivni ? "text-primary" : "text-fg")}>{v.titul}</span>
              {v.popis && <span className="block text-sm text-muted">{v.popis}</span>}
            </span>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                aktivni ? "border-primary bg-primary text-primary-fg" : "border-border",
              )}
            >
              {aktivni && <Check className="om-pop size-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Dotykový stepper – velké číslo, tlačítka −/+, pole lze i přepsat. */
function VolicCisla({ id, popis, jednotka, hodnota, naZmenu, min, max, krok = 1 }: {
  id: string; popis: string; jednotka: string; hodnota: string;
  naZmenu: (v: string) => void; min: number; max: number; krok?: number;
}) {
  const n = cislo(hodnota);
  const posun = (d: number) => {
    const zaklad = Number.isFinite(n) ? n : min;
    naZmenu(String(Math.min(max, Math.max(min, Math.round((zaklad + d * krok) * 10) / 10))));
  };
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2">
      <div className="w-16 shrink-0">
        <Label htmlFor={id}>{popis}</Label>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => posun(-1)}
          disabled={Number.isFinite(n) && n <= min}
          aria-label={`Snížit – ${popis}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 active:scale-95"
        >
          <Minus className="size-4" />
        </button>
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={krok}
            value={hodnota}
            onChange={(e) => naZmenu(e.target.value)}
            className="w-24 rounded-lg border-0 bg-transparent py-2 text-center text-2xl font-extrabold tabular-nums focus:bg-surface-2"
            aria-label={popis}
          />
          <span className="pointer-events-none absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[0.65rem] font-medium text-muted">
            {jednotka}
          </span>
        </div>
        <button
          type="button"
          onClick={() => posun(1)}
          disabled={Number.isFinite(n) && n >= max}
          aria-label={`Zvýšit – ${popis}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 active:scale-95"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Krok tempo – cílová váha + posuvník tempa s živým termínem. */
function KrokTempo({ nadpisRef, stav, cisla, cilTela, plan, setStav }: {
  nadpisRef: React.Ref<HTMLHeadingElement>;
  stav: Stav;
  cisla: { vaha: number; cilovaVaha: number };
  cilTela: CilTela;
  plan: ReturnType<typeof spocitejPlan> | null;
  setStav: (s: Stav) => void;
}) {
  const rozsah = rozsahTempa(cilTela);
  const hubnuti = cilTela === "zhubnout";
  const smerChybi = platnaVaha(cisla.cilovaVaha) &&
    (hubnuti ? cisla.cilovaVaha >= cisla.vaha : cisla.cilovaVaha <= cisla.vaha);
  const termin = plan?.terminCile ?? odhadTerminu(cisla.vaha, cisla.cilovaVaha, stav.tempo, cilTela);
  const zony: { nazev: string; hodnota: number }[] = [
    { nazev: "Pomalé", hodnota: rozsah.min },
    { nazev: "Doporučené", hodnota: rozsah.vychozi },
    { nazev: "Agresivní", hodnota: rozsah.max },
  ];
  const aktivniZona =
    Math.abs(stav.tempo - rozsah.vychozi) < 0.03 ? 1
    : stav.tempo < rozsah.vychozi ? 0
    : 2;

  return (
    <KrokOtazka
      ref={nadpisRef}
      otazka={hubnuti ? "Kolik chceš zhubnout a jak rychle?" : "Kolik chceš nabrat a jak rychle?"}
      podtitul="Pomalé tempo drží svaly a lépe se dodržuje."
    >
      <VolicCisla
        id="cile-cilova-vaha"
        popis="Cíl"
        jednotka="kg"
        hodnota={stav.cilovaVaha}
        naZmenu={(v) => setStav({ ...stav, cilovaVaha: v })}
        min={30}
        max={300}
        krok={0.5}
      />
      {smerChybi && (
        <p className="text-xs text-danger">
          {hubnuti
            ? "Pro hubnutí musí být cílová váha nižší než aktuální."
            : "Pro nabírání musí být cílová váha vyšší než aktuální."}
        </p>
      )}

      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="cile-tempo">Tempo</Label>
          <span className="text-lg font-extrabold tabular-nums">
            {stav.tempo.toLocaleString("cs-CZ")} <span className="text-sm font-medium text-muted">kg / týden</span>
          </span>
        </div>
        <input
          id="cile-tempo"
          type="range"
          min={rozsah.min}
          max={rozsah.max}
          step={hubnuti ? 0.1 : 0.05}
          value={stav.tempo}
          onChange={(e) => setStav({ ...stav, tempo: Number(e.target.value) })}
          className="om-posuvnik mt-4"
          aria-describedby="cile-tempo-nazev"
        />
        <div className="mt-2 grid grid-cols-3 text-center text-xs">
          {zony.map((z, i) => (
            <button
              key={z.nazev}
              type="button"
              onClick={() => setStav({ ...stav, tempo: z.hodnota })}
              className={cn(
                "min-h-[36px] rounded-lg font-medium transition-colors",
                i === aktivniZona ? "font-bold text-primary" : "text-muted hover:text-fg",
              )}
            >
              {z.nazev}
            </button>
          ))}
        </div>
        <p id="cile-tempo-nazev" className="sr-only">Zvolené tempo: {zony[aktivniZona]?.nazev}</p>
        {stav.tempo >= 0.8 && hubnuti && (
          <p className="mt-1 text-xs text-danger">
            Agresivní deficit – hrozí úbytek svalů a jojo efekt. Zvaž pomalejší tempo.
          </p>
        )}
      </div>

      {platnaVaha(cisla.cilovaVaha) && !smerChybi && termin && (
        <p className="rounded-card bg-primary-soft px-4 py-3.5 text-sm">
          Cílové váhy <span className="font-bold">{formatujMakro(cisla.cilovaVaha)} kg</span>{" "}
          {hubnuti ? "dosáhneš" : "nabereš"} kolem{" "}
          <span className="font-bold text-primary">
            {termin.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
          </span>
          .
        </p>
      )}
    </KrokOtazka>
  );
}

/** Plynule navyšující se číslo (450 ms ease-out) – živý souhrn kcal. */
function useCitaneCislo(cil: number): number {
  const [v, setV] = useState(cil);
  const posledni = useRef(cil);
  useEffect(() => {
    const od = posledni.current;
    posledni.current = cil;
    const zkracene = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (od === cil || zkracene || typeof requestAnimationFrame !== "function") {
      setV(cil);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tik = (t: number) => {
      const p = Math.min(1, (t - t0) / 450);
      setV(Math.round(od + (cil - od) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tik);
    };
    raf = requestAnimationFrame(tik);
    return () => cancelAnimationFrame(raf);
  }, [cil]);
  return v;
}

/** Prstencový graf podílu makroživin na celkové energii. */
function PrstenceMakro({ cile }: { cile: Cile }) {
  const eP = 4 * cile.bilkoviny;
  const eS = 4 * cile.sacharidy;
  const eT = 9 * cile.tuky;
  const celkem = Math.max(1, eP + eS + eT);
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segmenty = [
    { energie: eP, barva: "var(--primary)" },
    { energie: eS, barva: "var(--accent)" },
    { energie: eT, barva: "var(--muted)" },
  ].map((s) => {
    const podil = s.energie / celkem;
    const seg = { ...s, delka: podil * C, posun: -offset };
    offset += podil * C;
    return seg;
  });

  return (
    <svg viewBox="0 0 140 140" className="size-36 -rotate-90" aria-hidden>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
      {segmenty.map((s, i) => (
        <circle
          key={i}
          cx="70" cy="70" r={R} fill="none"
          stroke={s.barva} strokeWidth="16"
          strokeDasharray={`${Math.max(0, s.delka - 1.5)} ${C}`}
          strokeDashoffset={s.posun}
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-300"
        />
      ))}
    </svg>
  );
}

/** Odhad křivky váhy – přímá linie z aktuální na cílovou váhu. */
function KrivkaVahy({ zVahy, doVahy, termin, hubnuti }: {
  zVahy: number; doVahy: number; termin: Date | null; hubnuti: boolean;
}) {
  const x1 = 14, x2 = 306;
  const y1 = hubnuti ? 18 : 62;
  const y2 = hubnuti ? 62 : 18;
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>Odhad průběhu váhy</span>
        {termin && (
          <span>
            cíl {termin.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}
          </span>
        )}
      </div>
      <svg viewBox="0 0 320 80" className="h-20 w-full" aria-hidden>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 4" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={x1} cy={y1} r="4" fill="var(--primary)" />
        <circle cx={x2} cy={y2} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-xs">
        <span className="font-semibold tabular-nums">{formatujMakro(zVahy)} kg <span className="font-normal text-muted">dnes</span></span>
        <span className="font-semibold tabular-nums">{formatujMakro(doVahy)} kg <span className="font-normal text-muted">cíl</span></span>
      </div>
    </div>
  );
}

/** Souhrn – výsledný plán + ručně upravitelná čísla. */
function KrokSouhrn({ nadpisRef, plan, cile, setUpravy, cilTela, aktualniVaha, cilovaVaha }: {
  nadpisRef: React.Ref<HTMLHeadingElement>;
  plan: ReturnType<typeof spocitejPlan>;
  cile: Cile;
  setUpravy: (c: Cile) => void;
  cilTela: CilTela;
  aktualniVaha: number;
  cilovaVaha: number;
}) {
  const MAKRA: { klic: "bilkoviny" | "sacharidy" | "tuky"; nazev: string; tecka: string }[] = [
    { klic: "bilkoviny", nazev: "Bílkoviny", tecka: "bg-primary" },
    { klic: "sacharidy", nazev: "Sacharidy", tecka: "bg-accent" },
    { klic: "tuky", nazev: "Tuky", tecka: "bg-muted" },
  ];
  const kcal = useCitaneCislo(cile.kalorie);
  const hubnuti = cilTela === "zhubnout";

  return (
    <KrokOtazka ref={nadpisRef} otazka="Tvůj plán" podtitul="Klepnutím na číslo ho doladíš – energie makroživin zůstane přesná.">
      {/* prstenec makroživin + velké kalorie */}
      <div className="relative mx-auto w-fit rounded-card border-2 border-primary/60 bg-primary-soft p-4">
        <PrstenceMakro cile={cile} />
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <EditovatelneCislo
              hodnota={kcal}
              cil={cile.kalorie}
              naZmenu={(n) => setUpravy(cileZKcal(n, cile))}
              velke
            />
            <div className="text-xs font-semibold text-muted">kcal / den</div>
          </div>
        </div>
      </div>
      {plan.pouzitaPodlaha && (
        <p className="text-center text-xs text-danger">
          Výpočet vycházel pod bezpečné minimum – nastavili jsme nejnižší zdravý příjem.
        </p>
      )}

      {/* makra – editovatelné řádky */}
      <div className="space-y-2">
        {MAKRA.map((m) => {
          const energie = cile[m.klic] * (m.klic === "tuky" ? 9 : 4);
          const podil = Math.round((energie / Math.max(1, cile.kalorie)) * 100);
          return (
            <div key={m.klic} className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
              <span className={cn("size-2.5 shrink-0 rounded-full", m.tecka)} aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{m.nazev}</span>
                <span className="block text-xs text-muted">{podil} % energie</span>
              </span>
              <span className="flex items-baseline gap-1">
                <EditovatelneCislo
                  hodnota={cile[m.klic]}
                  naZmenu={(n) =>
                    setUpravy(cileZGramu(
                      m.klic === "bilkoviny" ? n : cile.bilkoviny,
                      m.klic === "sacharidy" ? n : cile.sacharidy,
                      m.klic === "tuky" ? n : cile.tuky,
                    ))
                  }
                />
                <span className="text-sm text-muted">g</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* křivka váhy (kromě udržování) */}
      {cilTela !== "udrzet" && platnaVaha(cilovaVaha) && cilovaVaha !== aktualniVaha && (
        <KrivkaVahy zVahy={aktualniVaha} doVahy={cilovaVaha} termin={plan.terminCile} hubnuti={hubnuti} />
      )}

      {/* stručný rozbor */}
      <div className="rounded-card bg-surface-2 px-4 py-3 text-sm text-muted">
        <p>
          Bazální metabolismus <span className="font-semibold text-fg">{formatujKcal(plan.bmr)} kcal</span>,
          s aktivitou <span className="font-semibold text-fg">{formatujKcal(plan.tdee)} kcal</span>
          {plan.korekceKcal !== 0 && (
            <>, {hubnuti ? "deficit" : "přídavek"}{" "}
            <span className="font-semibold text-fg">{formatujKcal(Math.abs(plan.korekceKcal))} kcal</span></>
          )}
          .
        </p>
      </div>
    </KrokOtazka>
  );
}

/** Číslo, které se po klepnutí změní v editovatelné pole. */
function EditovatelneCislo({ hodnota, cil, naZmenu, velke = false }: {
  hodnota: number;
  /** skutečná hodnota pro aria-label (hodnota může být animovaná) */
  cil?: number;
  naZmenu: (n: number) => void;
  velke?: boolean;
}) {
  const [edituji, setEdituji] = useState(false);
  const [text, setText] = useState(String(hodnota));
  const labelHodnota = cil ?? hodnota;

  if (!edituji) {
    return (
      <button
        type="button"
        onClick={() => { setText(String(labelHodnota)); setEdituji(true); }}
        className={cn(
          "group inline-flex min-h-[44px] items-center gap-1.5 rounded-lg font-extrabold tabular-nums",
          velke ? "px-2 text-[2rem] leading-none" : "px-1.5 text-lg hover:bg-surface-2",
        )}
        aria-label={`Upravit hodnotu ${labelHodnota}`}
      >
        {formatujKcal(hodnota)}
        <Pencil className={cn("text-muted opacity-0 transition-opacity group-hover:opacity-100", velke ? "size-4" : "size-3")} />
      </button>
    );
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = cislo(text);
        if (Number.isFinite(n) && n > 0) naZmenu(Math.round(n));
        setEdituji(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") setEdituji(false);
      }}
      className={cn(
        "w-28 rounded-lg border-2 border-primary bg-surface px-2 py-1 text-center font-extrabold tabular-nums",
        velke ? "text-3xl" : "text-lg",
      )}
    />
  );
}
