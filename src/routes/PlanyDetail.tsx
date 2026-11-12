import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DenniVysledek, TydennyVysledek } from "@/components/jidelnicek/Vysledky";
import { nactiPlan, smazPlan } from "@/lib/data/plany";
import type { Cile, DenVysledek, TydenniPlan } from "@/lib/generator/generator";

/**
 * Mé plány – detail uloženého plánu (JSONB obsah). RLS zaručuje,
 * že uživatel vidí jen své plány.
 */

export function PlanyDetail() {
  const { id } = useParams<{ id: string }>();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();

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
    return <p className="text-sm text-muted">Načítám plán…</p>;
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
            {plan.typ === "tyden" ? "Týdenní plán" : "Denní plán"}
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
            onClick={() => {
              if (window.confirm("Opravdu smazat tento plán?")) mutaceSmazat.mutate();
            }}
            className="text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-4" /> Smazat
          </Button>
        </div>
      </div>

      {obsah === null ? (
        <Card className="text-sm text-muted">Obsah plánu se nepodařilo načíst.</Card>
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
