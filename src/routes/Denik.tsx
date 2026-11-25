import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Plus, Repeat, Target, Trash2, TriangleAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GramazPill } from "@/components/ui/GramazPill";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Skeleton } from "@/components/ui/Nacitani";
import { Prstenec } from "@/components/ui/Prstenec";
import { VyberPotraviny, type PolozkaVyberu } from "@/components/ui/VyberPotraviny";
import { DenikZapis } from "@/components/denik/DenikZapis";
import { SerieKarta } from "@/components/denik/SerieKarta";
import { TydnySouhrn } from "@/components/denik/TydnySouhrn";
import {
  dnesISO,
  dnyVTextu,
  makraProMnozstvi,
  nactiDenik,
  nactiDenikRozsah,
  nactiSerii,
  podilNaCili,
  posledniPredchoziDen,
  posunDen,
  sectiPrijem,
  smazPoznamkuDeniku,
  TYPY_JIDLA,
  upravPoznamkuDeniku,
  zapisDoDeniku,
  zkopirujZaznamy,
  type NovaPoznamka,
  type PoznamkaDeniku,
  type TypJidla,
} from "@/lib/data/denik";
import { najdiPotravinu, parsujRychlyZapis } from "@/lib/rychlyZapis";
import { ALERGEN_NAZVY, nactiKatalogPotravin } from "@/lib/data/potraviny";
import { obsahujeAlergen } from "@/lib/generator/generator";
import { efektivniAlergieProfilu, nactiAktivniCile, nactiProfil } from "@/lib/data/profil";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import { sklonuj } from "@/lib/sklonovani";
import { lazyKomponenta } from "@/lib/lazyRoute";

const DenikTyden = lazyKomponenta(() => import("@/components/denik/DenikTyden"));

/**
 * Jídelní deník – denní přehled snědených jídel.
 * Horní souhrn ukazuje příjem vůči aktivním cílům (kruhy),
 * pod ním sekce podle typu jídla a záznamy s možností smazání.
 * Zápis nových položek probíhá ve sheetu DenikZapis.
 */

/** Výchozí slot rychlého zápisu podle denní doby. */
function typPodleCasu(d = new Date()): TypJidla {
  const h = d.getHours();
  if (h < 10) return "snidane";
  if (h < 11) return "svacina";
  if (h < 15) return "obed";
  if (h < 17) return "odpoledne";
  return "vecere";
}

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
  // rychlý zápis – text + cílový slot + ruční úpravy gramáží v náhledu
  const [rychly, setRychly] = useState("");
  const [rychlyTyp, setRychlyTyp] = useState<TypJidla>(typPodleCasu);
  const [rychlyGramy, setRychlyGramy] = useState<Record<number, number>>({});
  // ruční výměna nalezené potraviny – index klauzule → vybrané food id
  const [rychlyShody, setRychlyShody] = useState<Record<number, string>>({});
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const dotazDenik = useQuery({
    queryKey: ["denik", datum],
    queryFn: () => nactiDenik(datum),
  });
  const dotazCile = useQuery({ queryKey: ["cile"], queryFn: nactiAktivniCile });
  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil });
  const mojeAlergie = useMemo(
    () => efektivniAlergieProfilu(dotazProfil.data),
    [dotazProfil.data],
  );
  // trend – 7 dnů končících zvoleným dnem (lazy graf pod souhrnem)
  const dotazTyden = useQuery({
    queryKey: ["denik", "tyden", datum],
    queryFn: () => nactiDenikRozsah(posunDen(datum, -6), datum),
  });
  // série zapisování – klíč pod "denik", takže se po každém zápisu/smazání přenačte sama
  const dotazSerie = useQuery({
    queryKey: ["denik", "serie"],
    queryFn: nactiSerii,
    staleTime: 60 * 1000,
  });
  // katalog se stahuje až při prvním otevření zápisu (6,5k řádků → lazy)
  const dotazKatalog = useQuery({
    queryKey: ["katalog_potravin"],
    queryFn: nactiKatalogPotravin,
    enabled: zapisOtevren !== null || rychly.trim() !== "",
    staleTime: 10 * 60 * 1000,
  });

  const mutaceSmaz = useMutation({
    mutationFn: smazPoznamkuDeniku,
    // optimisticky – řádek zmizí hned; při chybě se cache vrátí
    onMutate: async (id) => {
      await dotazovak.cancelQueries({ queryKey: ["denik", datum] });
      const predchozi = dotazovak.getQueryData<PoznamkaDeniku[]>(["denik", datum]);
      dotazovak.setQueryData<PoznamkaDeniku[]>(["denik", datum], (stare) =>
        (stare ?? []).filter((p) => p.id !== id),
      );
      return { predchozi };
    },
    onSuccess: () => {
      toast.success("Záznam odebrán.");
    },
    onError: (e, _v, ctx) => {
      if (ctx?.predchozi) dotazovak.setQueryData(["denik", datum], ctx.predchozi);
      toast.error(e instanceof Error ? e.message : "Smazání selhalo.");
    },
    onSettled: () => void dotazovak.invalidateQueries({ queryKey: ["denik"] }),
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
    onError: (e) => {
      // refetch ze serveru místo snapshotu – u debouncované série by
      // rollback vracel mezistav série, ne pravý stav řádku
      void dotazovak.invalidateQueries({ queryKey: ["denik"] });
      toast.error(e instanceof Error ? e.message : "Úprava gramáže selhala.");
    },
    onSettled: () => void dotazovak.invalidateQueries({ queryKey: ["denik"] }),
  });

  // gramáž se debouncuje (400 ms klid): každý krok pilule by jinak
  // vystřelil vlastní UPDATE a nezávislé zápisy na stejném řádku se
  // můžou vykonat v jiném pořadí, než uživatel klepal – DB by skončila
  // na hodnotě, kterou uživatel neviděl. Optimistický přepis běží hned,
  // síť až po ustálení; poslední cílová hodnota vyhrává.
  const gramTimer = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const gramCil = useRef(new Map<string, number>());
  useEffect(
    () => () => {
      for (const t of gramTimer.current.values()) clearTimeout(t);
    },
    [],
  );
  const naplanujZmenuGramu = (id: string, gramy: number) => {
    dotazovak.setQueryData<PoznamkaDeniku[]>(["denik", datum], (stare) =>
      (stare ?? []).map((x) => (x.id === id ? { ...x, mnozstviG: gramy } : x)),
    );
    gramCil.current.set(id, gramy);
    const stary = gramTimer.current.get(id);
    if (stary) clearTimeout(stary);
    gramTimer.current.set(
      id,
      setTimeout(() => {
        gramTimer.current.delete(id);
        const g = gramCil.current.get(id);
        gramCil.current.delete(id);
        if (g != null) mutaceGramy.mutate({ id, gramy: g });
      }, 400),
    );
  };

  // „zopakovat předchozí den" – zdroj je nejbližší předchozí den se záznamy
  // v načteném 7denním okně (typ jídla i čas zápisu se zachovají)
  const mutaceKopie = useMutation({
    mutationFn: (radky: PoznamkaDeniku[]) => zkopirujZaznamy(radky, datum),
    onSuccess: (n) => {
      toast.success(n === 1 ? "Zkopírován 1 záznam." : `Zkopírováno ${n} záznamů.`);
      void dotazovak.invalidateQueries({ queryKey: ["denik"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Kopírování selhalo."),
  });

  // rychlý zápis – živý náhled rozpoznaných klauzulí proti katalogu
  const rychlePolozky = useMemo(() => {
    if (rychly.trim() === "") return [];
    const katalog = dotazKatalog.data ?? [];
    return parsujRychlyZapis(rychly).map((p, i) => {
      const rucni = rychlyShody[i] !== undefined
        ? katalog.find((k) => k.id === rychlyShody[i])
        : undefined;
      const shoda = rucni ?? najdiPotravinu(katalog, p.dotaz);
      // nerozpoznané množství → balení potraviny, jinak 100 g
      const gramy = rychlyGramy[i] ?? p.gramy ?? shoda?.baleniG ?? 100;
      const makra = shoda ? makraProMnozstvi(shoda, gramy) : null;
      return { ...p, shoda, gramy, makra };
    });
  }, [rychly, rychlyGramy, rychlyShody, dotazKatalog.data]);

  // „Zapsat vše" – dávkový insert jen nalezených položek do zvoleného slotu
  const mutaceRychly = useMutation({
    mutationFn: (poznamky: NovaPoznamka[]) => zapisDoDeniku(rychlyTyp, datum, "", poznamky),
    // optimisticky – položky se ukážou hned, při chybě se cache vrátí
    onMutate: async (poznamky) => {
      await dotazovak.cancelQueries({ queryKey: ["denik", datum] });
      const predchozi = dotazovak.getQueryData<PoznamkaDeniku[]>(["denik", datum]);
      const zapsanoAt = new Date(`${datum}T12:00:00`).toISOString();
      dotazovak.setQueryData<PoznamkaDeniku[]>(["denik", datum], (stare) => [
        ...(stare ?? []),
        ...poznamky.map((p, i) => ({
          id: `optim-rychly-${i}-${zapsanoAt}`,
          foodId: p.foodId,
          nazev: p.nazev,
          obrazek: p.obrazek,
          typJidla: rychlyTyp,
          mnozstviG: p.mnozstviG,
          kalorie: p.kalorie,
          bilkoviny: p.bilkoviny,
          sacharidy: p.sacharidy,
          tuky: p.tuky,
          zapsanoDne: datum,
          zapsanoAt,
        })),
      ]);
      return { predchozi };
    },
    onSuccess: (_v, zapsane) => {
      setRychly("");
      setRychlyGramy({});
      setRychlyShody({});
      toast.success(`Zapsáno ${zapsane.length} ${sklonuj(zapsane.length, "položka", "položky", "položek")}.`);
    },
    onError: (e, _v, ctx) => {
      if (ctx?.predchozi) dotazovak.setQueryData(["denik", datum], ctx.predchozi);
      toast.error(e instanceof Error ? e.message : "Zápis selhal.");
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
        pozorovanoAt: k.pozorovanoAt ?? null,
        alergeny: k.alergeny ?? [],
        alergenyStopy: k.alergenyStopy ?? [],
      })),
    [dotazKatalog.data],
  );

  const cile = dotazCile.data ?? null;
  const zdrojDen = useMemo(
    () => posledniPredchoziDen(dotazTyden.data ?? [], datum),
    [dotazTyden.data, datum],
  );
  const zdrojovePoznamky = useMemo(
    () =>
      zdrojDen
        ? (dotazTyden.data ?? []).filter((p) => p.zapsanoDne === zdrojDen)
        : [],
    [dotazTyden.data, zdrojDen],
  );
  const jeDnes = datum === dnesISO();

  // oslava – když se po zápisu série prodlouží, krátce poblahopřejeme
  const minulaSerie = useRef<number | null>(null);
  useEffect(() => {
    const s = dotazSerie.data;
    if (!s) return;
    if (
      minulaSerie.current !== null &&
      s.aktualni > minulaSerie.current &&
      s.dnesZapsano
    ) {
      toast.success(`Série: ${s.aktualni} ${dnyVTextu(s.aktualni)} v řadě!`);
    }
    minulaSerie.current = s.aktualni;
  }, [dotazSerie.data]);

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
            className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="size-5" />
          </button>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold tabular-nums text-fg has-focus:outline-2 has-focus:outline-primary">
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
            className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
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

      {/* ---- série zapisování ---- */}
      {dotazSerie.data && <SerieKarta serie={dotazSerie.data} />}

      {/* ---- rychlý zápis ---- */}
      <section className="rounded-2xl bg-surface p-4" aria-label="Rychlý zápis">
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0 text-primary" aria-hidden />
          <Input
            value={rychly}
            onChange={(e) => {
              setRychly(e.target.value);
              // přepsaný text mění význam indexů – ruční výměny zahodit
              setRychlyShody({});
            }}
            placeholder="např. 200g kuřecí prsa, 100 g rýže, 2 vejce"
            aria-label="Rychlý zápis"
            className="min-w-0 flex-1"
          />
          <Select
            value={rychlyTyp}
            onChange={(e) => setRychlyTyp(e.target.value as TypJidla)}
            aria-label="Typ jídla"
            className="w-auto shrink-0"
          >
            {TYPY_JIDLA.map((t) => (
              <option key={t.klic} value={t.klic}>{t.nazev}</option>
            ))}
          </Select>
        </div>
        {rychlePolozky.length > 0 && (
          <>
            <ul className="mt-3 divide-y divide-border/60">
              {rychlePolozky.map((p, i) => (
                <li key={i} className="flex items-center gap-2 py-2 text-sm">
                  {p.shoda ? (
                    <>
                      <MiniaturaPotraviny obrazek={p.shoda.obrazek} velikost="size-7" inline />
                      <button
                        type="button"
                        onClick={() => setSwapIndex(i)}
                        className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary"
                        title="Vyměnit nalezenou potravinu"
                      >
                        {p.shoda.nazev}
                        {p.odhad && (
                          <span className="ml-1.5 text-xs font-normal text-muted">
                            ~{p.jednotka}
                          </span>
                        )}
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={p.gramy}
                        onChange={(e) => {
                          const g = Number(e.target.value);
                          if (g > 0) setRychlyGramy((s) => ({ ...s, [i]: g }));
                        }}
                        aria-label={`Gramáž – ${p.shoda.nazev}`}
                        className="w-[4.5rem] rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums"
                      />
                      <span className="text-xs text-muted">g</span>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                        {p.makra ? formatujKcal(p.makra.kalorie) : "–"}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSwapIndex(i)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-warning"
                      title="Vybrat potravinu ručně"
                    >
                      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">„{p.vstup}" – nenalezeno, vyberte ručně</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {rychlePolozky.filter((p) => p.shoda !== null).length}/{rychlePolozky.length} nalezeno
                {dotazKatalog.isLoading && " · načítám katalog…"}
              </span>
              <Button
                velikost="sm"
                disabled={
                  rychlePolozky.every((p) => p.shoda === null) || mutaceRychly.isPending
                }
                onClick={() =>
                  mutaceRychly.mutate(
                    rychlePolozky
                      .filter((p) => p.shoda !== null)
                      .map((p) => ({
                        foodId: p.shoda!.id,
                        nazev: p.shoda!.nazev,
                        obrazek: p.shoda!.obrazek,
                        mnozstviG: p.gramy,
                        kalorie: p.shoda!.kalorie,
                        bilkoviny: p.shoda!.bilkoviny,
                        sacharidy: p.shoda!.sacharidy,
                        tuky: p.shoda!.tuky,
                      })),
                  )
                }
              >
                Zapsat vše
              </Button>
            </div>
            <VyberPotraviny
              potraviny={potravinyProVyber}
              hodnota={swapIndex !== null ? (rychlePolozky[swapIndex]?.shoda?.id ?? "") : ""}
              onZmena={(id) => {
                if (swapIndex !== null) {
                  setRychlyShody((s) => ({ ...s, [swapIndex]: id }));
                  setSwapIndex(null);
                }
              }}
              bezTlacitka
              otevrenoVnejsi={swapIndex !== null}
              naOtevrenoZmena={(o) => { if (!o) setSwapIndex(null); }}
              mojeAlergie={mojeAlergie}
            />
          </>
        )}
      </section>

      {/* ---- souhrn dne ---- */}
      <section className="rounded-2xl bg-surface p-4" aria-label="Souhrn příjmu za den">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-fg">
            Příjem za {formatujDatum(datum)}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {!cile && !dotazCile.isPending && (
              <span className="text-xs text-muted">cíle nenastavené – vyplňte je v účtu</span>
            )}
            {zdrojDen && zdrojovePoznamky.length > 0 && (
              <Button
                varianta="outline"
                velikost="sm"
                onClick={() => mutaceKopie.mutate(zdrojovePoznamky)}
                disabled={mutaceKopie.isPending}
                title={`Zkopíruje ${zdrojovePoznamky.length} záznamů z ${formatujDatum(zdrojDen)}`}
              >
                <Repeat className="size-3.5" />
                Zopakovat {formatujDatum(zdrojDen).replace(/\s\d{4}$/, "")}
              </Button>
            )}
          </div>
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

      {/* ---- týdenní souhrn: Ø kcal/bílkoviny vs cíl + odhad výdaje ---- */}
      {dotazTyden.data && (
        <TydnySouhrn poznamky={dotazTyden.data} cile={cile} />
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
                    className="grid size-10 place-items-center rounded-full bg-primary text-primary-fg transition-transform hover:scale-105"
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
                          {(() => {
                            const stopySet = new Set(p.alergenyStopy ?? []);
                            const shoda = mojeAlergie.filter((a) => obsahujeAlergen(p, a));
                            const obsah = shoda.filter((a) => !stopySet.has(a));
                            const stopy = shoda.filter((a) => stopySet.has(a));
                            return (
                              <>
                                {obsah.length > 0 && (
                                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
                                    <TriangleAlert className="size-3 shrink-0" aria-hidden />
                                    obsahuje {obsah.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                                  </p>
                                )}
                                {stopy.length > 0 && (
                                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning">
                                    <TriangleAlert className="size-3 shrink-0" aria-hidden />
                                    může obsahovat stopy: {stopy.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                          <p className="text-xs tabular-nums text-muted">
                            {formatujKcal(m.kalorie)} kcal · B {formatujMakro(m.bilkoviny)} · S{" "}
                            {formatujMakro(m.sacharidy)} · T {formatujMakro(m.tuky)}
                          </p>
                        </div>
                        <GramazPill
                          className="w-24 shrink-0"
                          hodnota={p.mnozstviG}
                          onZmena={(gramy) => naplanujZmenuGramu(p.id, gramy)}
                          ariaLabel={`Množství ${p.nazev}: ${formatujMakro(p.mnozstviG)} g – změnit`}
                        />
                        <button
                          type="button"
                          onClick={() => mutaceSmaz.mutate(p.id)}
                          disabled={mutaceSmaz.isPending}
                          aria-label={`Smazat ${p.nazev}`}
                          className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
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
            mojeAlergie={mojeAlergie}
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
