import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Flame,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GramazPill } from "@/components/ui/GramazPill";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Prstenec } from "@/components/ui/Prstenec";
import { VyberPotraviny, type PolozkaVyberu } from "@/components/ui/VyberPotraviny";
import {
  makraProMnozstvi,
  podilNaCili,
  receptNaPoznamku,
  sectiPrijem,
  TYPY_JIDLA,
  zapisDoDeniku,
  type NovaPoznamka,
  type PoznamkaDeniku,
  type TypJidla,
} from "@/lib/data/denik";
import { alergenyReceptu, nactiRecepty, stopyReceptu, type Recept } from "@/lib/data/recepty";
import { ALERGEN_NAZVY } from "@/lib/data/potraviny";
import { bezDiakritiky, skoreShody } from "@/lib/vyhledavani";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import { sklonuj } from "@/lib/sklonovani";
import type { Cile } from "@/lib/vyziva/cile";

/**
 * Zápis do jídelního deníku – fullscreencový sheet (na mobilu
 * celá obrazovka, na desktopu centrovaný modal). Obsahuje výběr
 * typu jídla, datum+čas, seznam položek s gramáží a panel
 * „Vliv na příjem“ – kolik % denního cíle položky přidají.
 */

interface PolozkaZapisu extends NovaPoznamka {
  /** klíč pro stabilní React key – lokální, nikoli DB id */
  klic: string;
  baleniG?: number | null;
}

export function DenikZapis({
  potraviny,
  cile,
  typPocatecni,
  datumPocatecni,
  mojeAlergie = [],
  naZavreni,
}: {
  potraviny: PolozkaVyberu[];
  cile: Cile | null;
  typPocatecni: TypJidla;
  datumPocatecni: string;
  /** efektivní alergeny uživatele – kolizní položky v pickeru se označí */
  mojeAlergie?: string[];
  naZavreni: () => void;
}) {
  const dotazovak = useQueryClient();
  const [typJidla, setTypJidla] = useState<TypJidla>(typPocatecni);
  const [datum, setDatum] = useState(datumPocatecni);
  const [cas, setCas] = useState(() =>
    new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
  );
  const [polozky, setPolozky] = useState<PolozkaZapisu[]>([]);
  const [vlivOtevren, setVlivOtevren] = useState(true);
  const [receptyOtevreny, setReceptyOtevreny] = useState(false);
  const [dotazRecept, setDotazRecept] = useState("");
  const seznamRef = useRef<HTMLDivElement>(null);

  // katalog makro/100g pro přepočet receptu na porci
  const mapaMakro = useMemo(
    () => new Map(potraviny.map((p) => [p.id, p])),
    [potraviny],
  );
  // recepty se tahají až po otevření sekce (seznam může být velký)
  const dotazRecepty = useQuery({
    queryKey: ["recepty"],
    queryFn: nactiRecepty,
    enabled: receptyOtevreny,
    staleTime: 60 * 1000,
  });
  const filtrovaneRecepty = useMemo(() => {
    const vsechny = dotazRecepty.data ?? [];
    const q = bezDiakritiky(dotazRecept.trim());
    if (!q) return vsechny.slice(0, 20);
    return vsechny
      .map((r) => ({ r, skore: skoreShody(bezDiakritiky(r.nazev), q) }))
      .filter((x) => x.skore > 0)
      .sort((a, b) => b.skore - a.skore)
      .slice(0, 20)
      .map((x) => x.r);
  }, [dotazRecepty.data, dotazRecept]);

  // zámek posouvání pozadí + Escape zavře
  useEffect(() => {
    const stary = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") naZavreni();
    };
    document.addEventListener("keydown", naKlavesu);
    return () => {
      document.documentElement.style.overflow = stary;
      document.removeEventListener("keydown", naKlavesu);
    };
  }, [naZavreni]);

  const pridej = (id: string) => {
    const p = potraviny.find((x) => x.id === id);
    if (!p) return;
    setPolozky((stare) => [
      ...stare,
      {
        klic: `${p.id}-${Date.now()}`,
        foodId: p.id,
        nazev: p.nazev,
        obrazek: p.obrazek ?? null,
        mnozstviG: 100,
        kalorie: p.kalorie,
        bilkoviny: p.bilkoviny ?? 0,
        sacharidy: p.sacharidy ?? 0,
        tuky: p.tuky ?? 0,
        baleniG: p.baleniG ?? null,
      },
    ]);
    // posun dolů na novou položku
    requestAnimationFrame(() => {
      const el = seznamRef.current;
      el?.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
    });
  };

  const pridejRecept = (r: Recept) => {
    const poznamka = receptNaPoznamku(r, mapaMakro);
    if (!poznamka) {
      toast.error("Z receptu nejde makra spočítat – suroviny mimo katalog.");
      return;
    }
    setPolozky((stare) => [
      ...stare,
      { ...poznamka, klic: `recept-${r.id}-${Date.now()}`, baleniG: null },
    ]);
    requestAnimationFrame(() => {
      const el = seznamRef.current;
      el?.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
    });
  };

  const nastavGramy = (klic: string, gramy: number) =>
    setPolozky((stare) =>
      stare.map((p) =>
        p.klic === klic ? { ...p, mnozstviG: Math.min(10000, Math.max(1, gramy)) } : p,
      ),
    );

  const odeber = (klic: string) =>
    setPolozky((stare) => stare.filter((p) => p.klic !== klic));

  const prijemZapisu = useMemo(() => sectiPrijem(polozky), [polozky]);

  const zapis = useMutation({
    mutationFn: () => zapisDoDeniku(typJidla, datum, cas, polozky),
    // optimisticky: položky se ukážou v deníku hned a sheet se zavře –
    // na slabém mobilním spojení uživatel nečeká na INSERT; při chybě
    // se cache vrátí do předchozího stavu a toast vysvětlí důvod
    onMutate: async () => {
      await dotazovak.cancelQueries({ queryKey: ["denik", datum] });
      const predchozi = dotazovak.getQueryData<PoznamkaDeniku[]>(["denik", datum]);
      const zapsanoAt = new Date(`${datum}T${cas || "12:00"}:00`).toISOString();
      dotazovak.setQueryData<PoznamkaDeniku[]>(["denik", datum], (stare) => [
        ...(stare ?? []),
        ...polozky.map((p) => ({
          id: `optim-${p.klic}`,
          foodId: p.foodId,
          nazev: p.nazev,
          obrazek: p.obrazek,
          typJidla,
          mnozstviG: p.mnozstviG,
          kalorie: p.kalorie,
          bilkoviny: p.bilkoviny,
          sacharidy: p.sacharidy,
          tuky: p.tuky,
          zapsanoDne: datum,
          zapsanoAt,
        })),
      ]);
      naZavreni();
      return { predchozi };
    },
    onSuccess: () => {
      toast.success(
        polozky.length === 1 ? "Zapsáno do deníku." : `${polozky.length} položky zapsány do deníku.`,
      );
    },
    onError: (e, _v, ctx) => {
      if (ctx?.predchozi) dotazovak.setQueryData(["denik", datum], ctx.predchozi);
      toast.error(e instanceof Error ? e.message : "Zápis selhal.");
    },
    onSettled: () => void dotazovak.invalidateQueries({ queryKey: ["denik"] }),
  });

  const muzeZapsat = polozky.length > 0 && !zapis.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg sm:bg-black/55 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Zápis do jídelního deníku"
    >
      <button
        type="button"
        aria-label="Zavřít zápis"
        onClick={naZavreni}
        className="absolute inset-0 hidden cursor-default sm:block"
        tabIndex={-1}
      />
      <div className="relative flex min-h-0 flex-1 flex-col bg-bg sm:mx-auto sm:my-[4dvh] sm:max-h-[92dvh] sm:w-full sm:max-w-lg sm:rounded-3xl sm:border sm:border-border sm:shadow-2xl">
        {/* ---- hlavička: zpět | typ jídla | Zapsat ---- */}
        <div className="flex items-center gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={naZavreni}
            aria-label="Zpět bez zápisu"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <select
              value={typJidla}
              onChange={(e) => setTypJidla(e.target.value as TypJidla)}
              aria-label="Typ jídla"
              className="om-display w-full appearance-none border-b-2 border-accent bg-transparent py-1 pr-7 text-xl font-extrabold text-fg focus:outline-none"
            >
              {TYPY_JIDLA.map((t) => (
                <option key={t.klic} value={t.klic}>
                  {t.nazev}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-accent" />
          </div>
          <Button
            varianta="accent"
            onClick={() => zapis.mutate()}
            disabled={!muzeZapsat}
            className="shrink-0 rounded-full px-5"
          >
            {zapis.isPending ? "Zapisuji…" : "Zapsat"}
          </Button>
        </div>

        <div ref={seznamRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-4">
          {/* ---- datum a čas ---- */}
          <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
            <CalendarDays className="size-5 shrink-0 text-muted" />
            <span className="whitespace-nowrap text-sm font-semibold text-fg">
              Datum a čas
            </span>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                aria-label="Datum zápisu"
                className="h-9 rounded-lg border-0 bg-transparent text-sm font-semibold tabular-nums text-accent focus:outline-2 focus:outline-primary"
              />
              <input
                type="time"
                value={cas}
                onChange={(e) => setCas(e.target.value)}
                aria-label="Čas zápisu"
                className="h-9 rounded-lg border-0 bg-transparent text-sm font-semibold tabular-nums text-accent focus:outline-2 focus:outline-primary"
              />
            </div>
          </div>

          {/* ---- položky ---- */}
          {polozky.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-fg">Zatím prázdné.</p>
              <p className="mt-1 text-xs text-muted">
                Vyberte potravinu z katalogu – makra se spočítají automaticky.
              </p>
            </div>
          )}
          {polozky.map((p) => {
            const m = makraProMnozstvi(p, p.mnozstviG);
            return (
              <div key={p.klic} className="rounded-2xl bg-surface p-3">
                <div className="flex items-center gap-3">
                  <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-fg">{p.nazev}</p>
                    <p className="text-xs tabular-nums text-muted">
                      {formatujKcal(m.kalorie)} kcal · B {formatujMakro(m.bilkoviny)} · S{" "}
                      {formatujMakro(m.sacharidy)} · T {formatujMakro(m.tuky)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => odeber(p.klic)}
                    aria-label={`Odebrat ${p.nazev}`}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-danger transition-colors hover:bg-danger/10"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>

                {/* gramáž – pill + popover s předvoleb */}
                <GramazPill
                  className="mt-2.5"
                  hodnota={p.mnozstviG}
                  baleniG={p.baleniG ?? null}
                  onZmena={(g) => nastavGramy(p.klic, g)}
                  ariaLabel={`Množství ${p.nazev}: ${formatujMakro(p.mnozstviG)} g – změnit`}
                />
              </div>
            );
          })}

          {/* ---- přidat potravinu ---- */}
          <VyberPotraviny
            potraviny={potraviny}
            hodnota=""
            onZmena={pridej}
            ariaLabel="Přidat potravinu do deníku"
            mojeAlergie={mojeAlergie}
          />

          {/* ---- přidat porci receptu ---- */}
          <section className="rounded-2xl bg-surface">
            <button
              type="button"
              onClick={() => setReceptyOtevreny((v) => !v)}
              aria-expanded={receptyOtevreny}
              className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
            >
              <ChefHat className="size-4 text-accent" />
              <span className="text-sm font-bold text-fg">Z receptu</span>
              {receptyOtevreny ? (
                <ChevronUp className="ml-auto size-4 text-accent" />
              ) : (
                <ChevronDown className="ml-auto size-4 text-accent" />
              )}
            </button>
            {receptyOtevreny && (
              <div className="px-3 pb-3">
                <input
                  type="search"
                  value={dotazRecept}
                  onChange={(e) => setDotazRecept(e.target.value)}
                  placeholder="Hledat recept…"
                  aria-label="Hledat recept"
                  className="mb-2 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
                />
                {dotazRecepty.isPending ? (
                  <p className="px-1 py-3 text-xs text-muted">Načítám recepty…</p>
                ) : filtrovaneRecepty.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted">
                    {dotazRecepty.data?.length ? "Žádný recept neodpovídá." : "Zatím žádné recepty – vytvořte je v sekci Recepty."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {filtrovaneRecepty.map((r) => {
                      const stopyVse = stopyReceptu(r);
                      const obsah = alergenyReceptu(r).filter(
                        (a) => mojeAlergie.includes(a) && !stopyVse.includes(a),
                      );
                      const stopy = stopyVse.filter((a) => mojeAlergie.includes(a));
                      return (
                        <li key={r.id} className="flex items-center gap-3 py-2">
                          <MiniaturaPotraviny
                            obrazek={r.suroviny.map((s) => s.obrazek).find(Boolean) ?? null}
                            velikost="size-10"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">
                              {r.nazev}
                            </span>
                            <span className="block text-xs text-muted">
                              {r.porce} {sklonuj(r.porce, "porce", "porce", "porcí")}
                            </span>
                            {obsah.length > 0 && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
                                <TriangleAlert className="size-3 shrink-0" aria-hidden />
                                obsahuje {obsah.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                              </span>
                            )}
                            {stopy.length > 0 && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning">
                                <TriangleAlert className="size-3 shrink-0" aria-hidden />
                                může obsahovat stopy: {stopy.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => pridejRecept(r)}
                            aria-label={`Přidat porci receptu ${r.nazev}`}
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-transform hover:scale-105"
                          >
                            <Plus className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ---- vliv na příjem ---- */}
          {polozky.length > 0 && (
            <section className="rounded-2xl bg-surface">
              <button
                type="button"
                onClick={() => setVlivOtevren((v) => !v)}
                aria-expanded={vlivOtevren}
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
              >
                <Flame className="size-4 text-accent" />
                <span className="text-sm font-bold text-fg">Vliv na příjem</span>
                {vlivOtevren ? (
                  <ChevronUp className="ml-auto size-4 text-accent" />
                ) : (
                  <ChevronDown className="ml-auto size-4 text-accent" />
                )}
              </button>
              {vlivOtevren && (
                <div className="grid grid-cols-4 gap-1 px-3 pb-4">
                  <VlivSloupec
                    nazev="Energie"
                    hodnota={prijemZapisu.kalorie}
                    jednotka="kcal"
                    cil={cile?.kalorie ?? 0}
                    formatuj={formatujKcal}
                  />
                  <VlivSloupec
                    nazev="Bílkoviny"
                    hodnota={prijemZapisu.bilkoviny}
                    jednotka="g"
                    cil={cile?.bilkoviny ?? 0}
                    formatuj={formatujMakro}
                  />
                  <VlivSloupec
                    nazev="Sacharidy"
                    hodnota={prijemZapisu.sacharidy}
                    jednotka="g"
                    cil={cile?.sacharidy ?? 0}
                    formatuj={formatujMakro}
                  />
                  <VlivSloupec
                    nazev="Tuky"
                    hodnota={prijemZapisu.tuky}
                    jednotka="g"
                    cil={cile?.tuky ?? 0}
                    formatuj={formatujMakro}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- pomocné ---------------- */

/** Jedna makro kolona panelu „Vliv na příjem“: +hodnota, prstenec %, z cíle. */
function VlivSloupec({
  nazev,
  hodnota,
  jednotka,
  cil,
  formatuj,
}: {
  nazev: string;
  hodnota: number;
  jednotka: "kcal" | "g";
  cil: number;
  formatuj: (n: number) => string;
}) {
  const procenta = podilNaCili(hodnota, cil);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-[11px] font-medium text-muted">{nazev}</span>
      <span className="text-base font-extrabold tabular-nums text-fg">
        +{formatuj(hodnota)}
      </span>
      {cil > 0 ? (
        <>
          <Prstenec procenta={procenta} />
          <span className="text-[11px] tabular-nums text-muted">
            z {formatuj(cil)} {jednotka === "kcal" ? "kcal" : "g"}
          </span>
        </>
      ) : (
        <span className="text-[11px] text-muted">bez cíle</span>
      )}
    </div>
  );
}
