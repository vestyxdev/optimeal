import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { SkeletonText } from "@/components/ui/Nacitani";
import { DenniVysledek, TydennyVysledek, KartaNakupu } from "@/components/jidelnicek/Vysledky";
import { nactiPlan, smazPlan } from "@/lib/data/plany";
import { formatujCastku, formatujKcal, formatujKc, formatujMakro } from "@/lib/cena";
import { sklonuj } from "@/lib/sklonovani";
import type { Cile, DenVysledek, NakupniPolozka, TydenniPlan } from "@/lib/generator/generator";

/**
 * Mé plány – detail uloženého plánu (JSONB obsah). RLS zaručuje,
 * že uživatel vidí jen své plány.
 */

export function PlanyDetail() {
  const { id } = useParams<{ id: string }>();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();
  const [potvrditSmazani, setPotvrditSmazani] = useState(false);

  const dotaz = useQuery({
    queryKey: ["plan", id],
    queryFn: () => nactiPlan(id as string),
    enabled: id !== undefined,
  });

  const mutaceSmazat = useMutation({
    mutationFn: () => smazPlan(id as string),
    onSuccess: () => {
      toast.success("Plán smazán.");
      void klientQ.invalidateQueries({ queryKey: ["me_plany"] });
      void naviguj("/jidelnicek");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (dotaz.isLoading) {
    return (
      <div className="space-y-4">
        <Zpet />
        <SkeletonText radky={3} className="max-w-lg" />
      </div>
    );
  }

  if (dotaz.isError || !dotaz.data) {
    return (
      <div className="space-y-4">
        <Zpet />
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotaz.error as Error | undefined)?.message ?? "Plán nenalezen."}
        </Card>
      </div>
    );
  }

  const plan = dotaz.data;
  const cile: Cile = {
    kalorie: plan.cil_kalorie,
    bilkoviny: plan.cil_bilkoviny,
    sacharidy: plan.cil_sacharidy,
    tuky: plan.cil_tuky,
  };
  const obsah = plan.data?.vysledek ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Zpet />
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {plan.typ === "tyden" ? "Týdenní plán" : plan.typ === "mealprep" ? "Mealprep plán" : "Denní plán"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Uloženo {new Date(plan.vytvoreno).toLocaleString("cs-CZ")} · cíl{" "}
            {plan.cil_kalorie} kcal (B {plan.cil_bilkoviny} / S {plan.cil_sacharidy} / T{" "}
            {plan.cil_tuky} g)
          </p>
        </div>
        <div className="flex gap-2">
          <Button varianta="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Tisk
          </Button>
          <Button
            varianta="ghost"
            onClick={() => setPotvrditSmazani(true)}
            className="text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-4" /> Smazat
          </Button>
          <PotvrdDialog
            otevren={potvrditSmazani}
            naZavreni={() => setPotvrditSmazani(false)}
            naPotvrzeni={() => mutaceSmazat.mutate()}
            nadpis="Smazat plán"
            text="Opravdu smazat tento uložený plán? Akce je nevratná."
            potvrdit="Smazat"
            destruktivni
          />
        </div>
      </div>

      {obsah === null ? (
        <Card className="text-sm text-muted">Obsah plánu se nepodařilo načíst.</Card>
      ) : plan.typ === "mealprep" ? (
        <MealprepDetail obsah={obsah} />
      ) : plan.typ === "den" ? (
        <DenniVysledek den={obsah as DenVysledek} cile={cile} />
      ) : (
        <TydennyVysledek plan={obsah as TydenniPlan} cile={cile} />
      )}
    </div>
  );
}

function Zpet() {
  return (
    <Link
      to="/jidelnicek"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" /> Zpět na Jídelníček
    </Link>
  );
}

/** Render uloženého mealprep (JSONB: vstupy, soucty, detaily, polozky). */
function MealprepDetail({ obsah }: { obsah: unknown }) {
  const m = obsah as {
    vstupy?: { receptId: string; porce: number }[];
    soucty?: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number; cena: number; cenaBezna: number };
    detaily?: { receptId: string; nazev: string; porce: number; kalorie: number; cena: number }[];
    polozky?: NakupniPolozka[];
  } | null;

  if (!m?.soucty || !m.polozky) {
    return <Card className="text-sm text-muted">Obsah plánu se nepodařilo načíst.</Card>;
  }

  const porceCelkem = m.vstupy?.reduce((s, v) => s + v.porce, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="py-4">
          <div className="text-xs font-medium text-muted">Porce celkem</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums">{porceCelkem}</div>
          <div className="text-xs text-muted">
            {m.detaily?.length ?? 0} {sklonuj(m.detaily?.length ?? 0, "recept", "recepty", "receptů")}
          </div>
        </Card>
        <Card className="py-4">
          <div className="text-xs font-medium text-muted">Nakupujte za</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums">{formatujCastku(m.soucty.cena)} Kč</div>
        </Card>
        <Card className="py-4">
          <div className="text-xs font-medium text-muted">Ušetříte slevami</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-ok">
            {formatujKc(m.soucty.cenaBezna - m.soucty.cena)} Kč
          </div>
        </Card>
        <Card className="py-4">
          <div className="text-xs font-medium text-muted">Výživa celkem</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums">{formatujKcal(m.soucty.kalorie)} kcal</div>
          <div className="text-xs text-muted">
            B {formatujMakro(m.soucty.bilkoviny)} · S {formatujMakro(m.soucty.sacharidy)} · T {formatujMakro(m.soucty.tuky)} g
          </div>
        </Card>
      </div>

      {m.detaily && m.detaily.length > 0 && (
        <Card>
          <CardNadpis className="mb-3">Rozpad podle receptů</CardNadpis>
          <ul className="divide-y divide-border text-sm">
            {m.detaily.map((d) => (
              <li key={d.receptId} className="flex items-center justify-between py-2">
                <span className="font-medium">
                  {d.nazev}{" "}
                  <span className="text-muted">
                    × {d.porce} {sklonuj(d.porce, "porce", "porce", "porcí")}
                  </span>
                </span>
                <span className="tabular-nums text-muted">
                  {formatujKcal(d.kalorie)} kcal · {formatujCastku(d.cena)} Kč
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <KartaNakupu polozky={m.polozky} soucetPopisek={`Celkem za ${porceCelkem} ${sklonuj(porceCelkem, "porce", "porce", "porcí")}`} />
    </div>
  );
}
