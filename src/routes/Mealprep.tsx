import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, Printer, ShoppingBasket, Save } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Nacitani";
import { Button } from "@/components/ui/Button";
import { KartaNakupu } from "@/components/jidelnicek/Vysledky";
import { nactiRecepty, spocitejRecept, KATEGORIE_NAZVY } from "@/lib/data/recepty";
import { nactiPotravinySeSlevami, ulozPlan } from "@/lib/data/plany";
import { ulozNakupniSeznam } from "@/lib/data/nakup";
import { sestavMealprep, type MealprepVstup } from "@/lib/mealprep/mealprep";
import { sklonuj } from "@/lib/sklonovani";

/**
 * Mealprep – vaření na zásobu. Vyberete recepty a kolik porcí
 * každého uvaříte; sestaví se konsolidovaný nákupní seznam se
 * slevami, součty výživy a rozpad podle receptů. Vše lze uložit
 * (plán do Mé plány, nákup do nákupních seznamů).
 */

/** krok voliče porcí */
const MAX_PORCI = 8;

function VolicPorci({ porce, nastav }: { porce: number; nastav: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => nastav(Math.max(0, porce - 1))}
        className="grid size-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Snížit porce"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center text-sm font-extrabold tabular-nums">{porce}</span>
      <button
        onClick={() => nastav(Math.min(MAX_PORCI, porce + 1))}
        className="grid size-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Zvětšit porce"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function Mealprep() {
  const klientQ = useQueryClient();
  const [porce, setPorce] = useState<Record<string, number>>({});

  const dotazRecepty = useQuery({ queryKey: ["recepty"], queryFn: nactiRecepty });
  const dotazCeny = useQuery({ queryKey: ["aktualni_ceny"], queryFn: nactiPotravinySeSlevami });

  const recepty = dotazRecepty.data ?? [];
  const vstupy: MealprepVstup[] = useMemo(
    () =>
      recepty
        .map((r) => ({ receptId: r.id, porce: porce[r.id] ?? 0 }))
        .filter((v) => v.porce > 0),
    [recepty, porce],
  );

  const vysledek = useMemo(
    () => sestavMealprep(vstupy, recepty, dotazCeny.data ?? null),
    [vstupy, recepty, dotazCeny.data],
  );

  // podpis aktuální konfigurace – uložení se zamkne, dokud se porce nezmění
  const podpis = useMemo(() => JSON.stringify(vstupy), [vstupy]);
  const [ulozenyPlanPodpis, setUlozenyPlanPodpis] = useState<string | null>(null);
  const [ulozenyNakupPodpis, setUlozenyNakupPodpis] = useState<string | null>(null);

  const mutaceUlozitPlan = useMutation({
    mutationFn: () =>
      ulozPlan({
        typ: "mealprep",
        cile: {
          kalorie: vysledek.soucty.kalorie,
          bilkoviny: vysledek.soucty.bilkoviny,
          sacharidy: vysledek.soucty.sacharidy,
          tuky: vysledek.soucty.tuky,
        },
        vysledek: { vstupy, soucty: vysledek.soucty, detaily: vysledek.detaily, polozky: vysledek.polozky },
      }),
    onSuccess: () => {
      setUlozenyPlanPodpis(podpis);
      toast.success("Mealprep uložen – najdete ho v sekci Mé plány.");
      void klientQ.invalidateQueries({ queryKey: ["me_plany"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutaceUlozitNakup = useMutation({
    mutationFn: () =>
      ulozNakupniSeznam(
        `Mealprep – ${vysledek.porceCelkem} ${sklonuj(vysledek.porceCelkem, "porce", "porce", "porcí")}`,
        vysledek.polozky.map((p) => ({
          foodId: p.id,
          nazev: p.nazev,
          gramy: p.gramy,
          cenaZa100g: p.cenaZa100g,
          obchod: p.obchod,
          jeSleva: p.sleva,
          kategorie: "ostatni",
        })),
      ),
    onSuccess: () => {
      setUlozenyNakupPodpis(podpis);
      toast.success("Nákupní seznam uložen.");
      void klientQ.invalidateQueries({ queryKey: ["me_nakupni_seznamy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aktivni = vysledek.porceCelkem > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mealprep</h1>
        <p className="mt-1 text-sm text-muted">
          Vařte na zásobu – vyberte recepty, nastavte počet porcí a dostanete
          jediný nákupní seznam s dnešními slevami. Stejné suroviny se přes
          recepty sčítají, takže nakoupíte přesně tolik, kolik potřebujete.
        </p>
      </div>

      {/* výběr receptů */}
      <Card>
        <CardNadpis>Které recepty uvaříte?</CardNadpis>
        {dotazRecepty.isLoading && <Skeleton className="h-24" />}
        {dotazRecepty.isError && (
          <Card className="bg-danger-soft text-sm text-danger">
            {(dotazRecepty.error as Error).message}
          </Card>
        )}
        <div className="divide-y divide-border">
          {recepty.map((recept) => {
            const rozbor = spocitejRecept(recept, dotazCeny.data ?? null);
            const vybrano = porce[recept.id] ?? 0;
            return (
              <div key={recept.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{recept.nazev}</span>
                    <span className="text-xs text-muted">
                      {KATEGORIE_NAZVY[recept.kategorie] ?? recept.kategorie}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {rozbor.naPorci.kalorie} kcal · {rozbor.naPorci.cena.toFixed(2)} Kč / porci
                  </div>
                </div>
                <VolicPorci
                  porce={vybrano}
                  nastav={(n) => setPorce((p) => ({ ...p, [recept.id]: n }))}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {aktivni && (
        <>
          {/* souhrn */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="py-4">
              <div className="text-xs font-medium text-muted">Porce celkem</div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">{vysledek.porceCelkem}</div>
              <div className="text-xs text-muted">
                {vysledek.detaily.length} {sklonuj(vysledek.detaily.length, "recept", "recepty", "receptů")}
              </div>
            </Card>
            <Card className="py-4">
              <div className="text-xs font-medium text-muted">Nakupujte za</div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">
                {vysledek.soucty.cena.toFixed(2)} Kč
              </div>
              <div className="text-xs text-muted">bez nákupu osobních doplňků</div>
            </Card>
            <Card className="py-4">
              <div className="text-xs font-medium text-muted">Ušetříte slevami</div>
              <div className="mt-1 text-xl font-extrabold tabular-nums text-ok">
                {Math.round(vysledek.soucty.cenaBezna - vysledek.soucty.cena)} Kč
              </div>
              <div className="text-xs text-muted">proti běžným cenám</div>
            </Card>
            <Card className="py-4">
              <div className="text-xs font-medium text-muted">Výživa celkem</div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">
                {vysledek.soucty.kalorie} kcal
              </div>
              <div className="text-xs text-muted">
                B {vysledek.soucty.bilkoviny} · S {vysledek.soucty.sacharidy} · T{" "}
                {vysledek.soucty.tuky} g
              </div>
            </Card>
          </div>

          {/* rozpad podle receptů */}
          <Card>
            <CardNadpis>Rozpad podle receptů</CardNadpis>
            <ul className="divide-y divide-border text-sm">
              {vysledek.detaily.map((d) => (
                <li key={d.receptId} className="flex items-center justify-between py-2">
                  <span className="font-medium">
                    {d.nazev}{" "}
                    <span className="text-muted">
                      × {d.porce} {sklonuj(d.porce, "porce", "porce", "porcí")}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted">
                    {d.kalorie} kcal · {d.cena.toFixed(2)} Kč
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* akce */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => mutaceUlozitNakup.mutate()}
              disabled={mutaceUlozitNakup.isPending || ulozenyNakupPodpis === podpis}
            >
              <ShoppingBasket className="size-4" />
              {mutaceUlozitNakup.isPending
                ? "Ukládám…"
                : ulozenyNakupPodpis === podpis
                  ? "Seznam uložen"
                  : "Uložit nákupní seznam"}
            </Button>
            <Button
              varianta="outline"
              onClick={() => mutaceUlozitPlan.mutate()}
              disabled={mutaceUlozitPlan.isPending || ulozenyPlanPodpis === podpis}
            >
              <Save className="size-4" />
              {mutaceUlozitPlan.isPending
                ? "Ukládám…"
                : ulozenyPlanPodpis === podpis
                  ? "Plán uložen"
                  : "Uložit jako plán"}
            </Button>
            <Button varianta="ghost" onClick={() => window.print()}>
              <Printer className="size-4" /> Tisk
            </Button>
          </div>

          {/* nákupní seznam */}
          <KartaNakupu polozky={vysledek.polozky} soucetPopisek={`Celkem za ${vysledek.porceCelkem} ${sklonuj(vysledek.porceCelkem, "porce", "porce", "porcí")}`} />

          {vysledek.chybejiciCeny.length > 0 && (
            <Card className="bg-warning-soft text-sm text-warning">
              Cenu zatím neznáme u: {vysledek.chybejiciCeny.join(", ")} (čeká na scraper – výživa
              se počítá, cena ne).
            </Card>
          )}
        </>
      )}

      {!aktivni && !dotazRecepty.isLoading && (
        <Card className="text-center text-sm text-muted">
          Vyberte recepty a počet porcí výše – nákupní seznam se sestaví hned.
        </Card>
      )}
    </div>
  );
}
