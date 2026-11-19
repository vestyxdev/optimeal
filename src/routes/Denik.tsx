import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Flame, NotebookPen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GramazPill } from "@/components/ui/GramazPill";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Skeleton } from "@/components/ui/Nacitani";
import { Prstenec } from "@/components/ui/Prstenec";
import type { PolozkaVyberu } from "@/components/ui/VyberPotraviny";
import { DenikZapis } from "@/components/denik/DenikZapis";
import {
  dnesISO,
  makraProMnozstvi,
  nactiDenik,
  nactiDenikRozsah,
  podilNaCili,
  posunDen,
  sectiPrijem,
  smazPoznamkuDeniku,
  TYPY_JIDLA,
  upravPoznamkuDeniku,
  type PoznamkaDeniku,
  type TypJidla,
} from "@/lib/data/denik";
import { nactiKatalogPotravin } from "@/lib/data/potraviny";
import { nactiAktivniCile } from "@/lib/data/profil";
import { formatujKcal, formatujMakro } from "@/lib/cena";

const DenikTyden = lazy(() => import("@/components/denik/DenikTyden"));

/**
 * Jídelní deník – denní přehled snědených jídel.
 * Horní souhrn ukazuje příjem vůči aktivním cílům (kruhy),
 * pod ním sekce podle typu jídla a záznamy s možností smazání.
 * Zápis nových položek probíhá ve sheetu DenikZapis.
 */

function formatujDatum(iso: string): string {
  // „st 19. 11. 2026“ – cs-CZ krátký den
  return new Date(`${iso}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function Denik() {
  const dotazovak = useQueryClient();
  const [datum, setDatum] = useState(dnesISO());
  const [zapisOtevren, setZapisOtevren] = useState<TypJidla | null>(null);

  const dotazDenik = useQuery({
    queryKey: ["denik", datum],
    queryFn: () => nactiDenik(datum),
  });
  const dotazCile = useQuery({ queryKey: ["cile"], queryFn: nactiAktivniCile });
  // trend – 7 dnů končících zvoleným dnem (lazy graf pod souhrnem)
  const dotazTyden = useQuery({
    queryKey: ["denik", "tyden", datum],
    queryFn: () => nactiDenikRozsah(posunDen(datum, -6), datum),
  });
  // katalog se stahuje až při prvním otevření zápisu (6,5k řádků → lazy)
  const dotazKatalog = useQuery({
    queryKey: ["katalog_potravin"],
    queryFn: nactiKatalogPotravin,
    enabled: zapisOtevren !== null,
    staleTime: 10 * 60 * 1000,
  });

  const mutaceSmaz = useMutation({
    mutationFn: smazPoznamkuDeniku,
    onSuccess: () => {
      toast.success("Záznam odebrán.");
      void dotazovak.invalidateQueries({ queryKey: ["denik"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Smazání selhalo."),
  });

  // gramáž uloženého záznamu – optimisticky, součty se přepočítají hned
  const mutaceGramy = useMutation({
    mutationFn: ({ id, gramy }: { id: string; gramy: number }) =>
      upravPoznamkuDeniku(id, gramy),
    onMutate: async ({ id, gramy }) => {
      await dotazovak.cancelQueries({ queryKey: ["denik", datum] });
      const predchozi = dotazovak.getQueryData<PoznamkaDeniku[]>(["denik", datum]);
      dotazovak.setQueryData<PoznamkaDeniku[]>(["denik", datum], (stare) =>
        (stare ?? []).map((p) => (p.id === id ? { ...p, mnozstviG: gramy } : p)),
      );
      return { predchozi };
    },
    onError: (e, _v, ctx) => {
      dotazovak.setQueryData(["denik", datum], ctx?.predchozi);
      toast.error(e instanceof Error ? e.message : "Úprava gramáže selhala.");
    },
    onSettled: () => void dotazovak.invalidateQueries({ queryKey: ["denik"] }),
  });

  const poznamky = useMemo(() => dotazDenik.data ?? [], [dotazDenik.data]);
  const prijem = useMemo(() => sectiPrijem(poznamky), [poznamky]);
  const podleJidel = useMemo(() => {
    const mapa = new Map<TypJidla, PoznamkaDeniku[]>();
    for (const t of TYPY_JIDLA) mapa.set(t.klic, []);
    for (const p of poznamky) mapa.get(p.typJidla)?.push(p);
    return mapa;
  }, [poznamky]);

  const potravinyProVyber: PolozkaVyberu[] = useMemo(
    () =>
      (dotazKatalog.data ?? []).map((k) => ({
        id: k.id,
        nazev: k.nazev,
        kalorie: k.kalorie,
        bilkoviny: k.bilkoviny,
        sacharidy: k.sacharidy,
        tuky: k.tuky,
        aktualniCena: k.aktualniCena,
        sleva: k.sleva,
        slevaProcenta: k.slevaProcenta ?? null,
        platnostDo: k.platnostDo ?? null,
        kategorie: k.kategorie ?? "ostatni",
        obrazek: k.obrazek,
        baleniG: k.baleniG ?? null,
      })),
    [dotazKatalog.data],
  );

  const cile = dotazCile.data ?? null;
  const jeDnes = datum === dnesISO();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* ---- hlavička + navigace dnem ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="om-display flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <NotebookPen className="size-6 text-primary" />
          Jídelní deník
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDatum((d) => posunDen(d, -1))}
            aria-label="Předchozí den"
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="size-5" />
          </button>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold tabular-nums text-fg has-focus:outline-2 has-focus:outline-primary">
            <CalendarDays className="size-4 text-muted" />
            <span className="sr-only">Vybrat den</span>
            <input
              type="date"
              value={datum}
              max={dnesISO()}
              onChange={(e) => e.target.value && setDatum(e.target.value)}
              className="w-[7.5rem] bg-transparent text-sm font-semibold tabular-nums focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setDatum((d) => posunDen(d, 1))}
            disabled={jeDnes}
            aria-label="Následující den"
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
          {!jeDnes && (
            <Button varianta="ghost" velikost="sm" onClick={() => setDatum(dnesISO())}>
              Dnes
            </Button>
          )}
        </div>
      </div>

      {/* ---- souhrn dne ---- */}
      <section className="rounded-2xl bg-surface p-4" aria-label="Souhrn příjmu za den">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-accent" />
          <h2 className="text-sm font-bold text-fg">
            Příjem za {formatujDatum(datum)}
          </h2>
          {!cile && !dotazCile.isPending && (
            <span className="ml-auto text-xs text-muted">cíle nenastavené – vyplňte je v účtu</span>
          )}
        </div>
        {dotazDenik.isPending ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-1">
            <SouhrnSloupec
              nazev="Energie" spotreba={prijem.kalorie} cil={cile?.kalorie ?? 0}
              jednotka="kcal" formatuj={formatujKcal}
            />
            <SouhrnSloupec
              nazev="Bílkoviny" spotreba={prijem.bilkoviny} cil={cile?.bilkoviny ?? 0}
              jednotka="g" formatuj={formatujMakro}
            />
            <SouhrnSloupec
              nazev="Sacharidy" spotreba={prijem.sacharidy} cil={cile?.sacharidy ?? 0}
              jednotka="g" formatuj={formatujMakro}
            />
            <SouhrnSloupec
              nazev="Tuky" spotreba={prijem.tuky} cil={cile?.tuky ?? 0}
              jednotka="g" formatuj={formatujMakro}
            />
          </div>
        )}
      </section>

      {/* ---- trend 7 dnů (lazy – recharts mimo hlavní bundle) ---- */}
      {dotazTyden.data && (
        <Suspense fallback={<Skeleton className="h-44 w-full rounded-2xl" />}>
          <DenikTyden
            poznamky={dotazTyden.data}
            cilKcal={cile?.kalorie ?? 0}
            datum={datum}
          />
        </Suspense>
      )}

      {/* ---- záznamy podle jídel ---- */}
      {dotazDenik.isError ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-danger">
          {dotazDenik.error instanceof Error ? dotazDenik.error.message : "Deník se nenačetl."}
        </p>
      ) : (
        TYPY_JIDLA.map((t) => {
          const polozky = podleJidel.get(t.klic) ?? [];
          const mezisoucet = sectiPrijem(polozky);
          return (
            <section key={t.klic} className="rounded-2xl bg-surface" aria-label={t.nazev}>
              <div className="flex items-center justify-between px-4 pt-3">
                <h3 className="text-sm font-bold text-fg">{t.nazev}</h3>
                <div className="flex items-center gap-2">
                  {polozky.length > 0 && (
                    <span className="text-xs tabular-nums text-muted">
                      {formatujKcal(mezisoucet.kalorie)} kcal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setZapisOtevren(t.klic)}
                    aria-label={`Zapsat ${t.nazev.toLowerCase()}`}
                    className="grid size-8 place-items-center rounded-full bg-primary text-primary-fg transition-transform hover:scale-105"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              {polozky.length === 0 ? (
                <p className="px-4 pb-4 pt-1.5 text-xs text-muted">Nic zapsáno.</p>
              ) : (
                <ul className="divide-y divide-border/50 px-2 pb-2 pt-1">
                  {polozky.map((p) => {
                    const m = makraProMnozstvi(p, p.mnozstviG);
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-2 pl-2">
                        <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-12" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-fg">{p.nazev}</p>
                          <p className="text-xs tabular-nums text-muted">
                            {formatujKcal(m.kalorie)} kcal · B {formatujMakro(m.bilkoviny)} · S{" "}
                            {formatujMakro(m.sacharidy)} · T {formatujMakro(m.tuky)}
                          </p>
                        </div>
                        <GramazPill
                          className="w-24 shrink-0"
                          hodnota={p.mnozstviG}
                          onZmena={(gramy) => mutaceGramy.mutate({ id: p.id, gramy })}
                          ariaLabel={`Množství ${p.nazev}: ${formatujMakro(p.mnozstviG)} g – změnit`}
                        />
                        <button
                          type="button"
                          onClick={() => mutaceSmaz.mutate(p.id)}
                          disabled={mutaceSmaz.isPending}
                          aria-label={`Smazat ${p.nazev}`}
                          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      {/* ---- zápis ---- */}
      {zapisOtevren !== null &&
        (dotazKatalog.isPending ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-bg">
            <p className="text-sm text-muted">Načítám katalog potravin…</p>
          </div>
        ) : (
          <DenikZapis
            potraviny={potravinyProVyber}
            cile={cile}
            typPocatecni={zapisOtevren}
            datumPocatecni={datum}
            naZavreni={() => setZapisOtevren(null)}
          />
        ))}
    </div>
  );
}

/* ---------------- pomocné ---------------- */

/** Kolona souhrnu: prstenec naplnění cíle + čísla spotřeba/cíl. */
function SouhrnSloupec({
  nazev,
  spotreba,
  cil,
  jednotka,
  formatuj,
}: {
  nazev: string;
  spotreba: number;
  cil: number;
  jednotka: "kcal" | "g";
  formatuj: (n: number) => string;
}) {
  const procenta = podilNaCili(spotreba, cil);
  const nad = procenta > 100;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-[11px] font-medium text-muted">{nazev}</span>
      <span className="text-base font-extrabold tabular-nums text-fg">{formatuj(spotreba)}</span>
      {cil > 0 ? (
        <>
          <Prstenec
            procenta={procenta}
            popisek={`${procenta}%`}
            barva={nad ? "var(--danger)" : "var(--primary)"}
          />
          <span className="text-[11px] tabular-nums text-muted">
            z {formatuj(cil)} {jednotka}
          </span>
        </>
      ) : (
        <span className="text-[11px] text-muted">{jednotka}</span>
      )}
    </div>
  );
}
