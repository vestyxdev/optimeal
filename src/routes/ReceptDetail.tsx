import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { alergenyReceptu, nactiRecept, smazRecept, spocitejRecept, KATEGORIE_NAZVY } from "@/lib/data/recepty";
import { nactiPotravinySeSlevami } from "@/lib/data/plany";

/**
 * Detail receptu – suroviny s živými cenami, výživa na porci i celkem,
 * postup krok za krokem. Cena je z aktuálních slev.
 */

export function ReceptDetail() {
  const { id } = useParams<{ id: string }>();
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();

  const dotazRecept = useQuery({
    queryKey: ["recept", id],
    queryFn: () => nactiRecept(id as string),
    enabled: id !== undefined,
  });
  const dotazCeny = useQuery({ queryKey: ["aktualni_ceny"], queryFn: nactiPotravinySeSlevami });

  const mutaceSmazat = useMutation({
    mutationFn: () => smazRecept(id as string),
    onSuccess: () => {
      toast.success("Recept byl smazán.");
      void klientQ.invalidateQueries({ queryKey: ["recepty"] });
      naviguj("/recepty");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recept = dotazRecept.data ?? null;
  const ceny = dotazCeny.data ?? null;
  const vlastni = recept !== null && uzivatel !== null && recept.userId === uzivatel.id;

  const kroky = recept
    ? recept.postup
        .split(/\r?\n/)
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/recepty"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-4" /> Zpět na recepty
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {recept?.nazev ?? "Recept"}
          </h1>
          {recept?.popis && <p className="mt-1 max-w-xl text-sm text-muted">{recept.popis}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tono="neutral">{KATEGORIE_NAZVY[recept?.kategorie ?? ""] ?? recept?.kategorie}</Badge>
            {vlastni && <Badge tono="primary">Vlastní recept</Badge>}
            <span>{recept?.porce ?? "—"} × porce</span>
            {recept?.casMinuty != null && <span>⏱ {recept.casMinuty} min</span>}
            <span>zdroj: {recept?.zdroj}</span>
            {recept && alergenyReceptu(recept).length > 0 && (
              <span>alergeny: {alergenyReceptu(recept).join(", ")}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {vlastni && (
            <>
              <Button varianta="outline" onClick={() => naviguj(`/recepty/${id}/upravit`)}>
                <Pencil className="size-4" /> Upravit
              </Button>
              <Button
                varianta="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => {
                  if (window.confirm("Opravdu smazat tento recept?")) mutaceSmazat.mutate();
                }}
                disabled={mutaceSmazat.isPending}
              >
                <Trash2 className="size-4" /> Smazat
              </Button>
            </>
          )}
          <Button varianta="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Tisk
          </Button>
        </div>
      </div>

      {dotazRecept.isLoading && <p className="text-sm text-muted">Načítám recept…</p>}
      {dotazRecept.isError && (
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotazRecept.error as Error).message}
        </Card>
      )}

      {recept && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* suroviny */}
          <Card className="p-0 lg:col-span-3">
            <div className="border-b border-border px-5 py-4">
              <CardNadpis className="mb-0">🥣 Suroviny</CardNadpis>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-2 font-medium">Potravina</th>
                  <th className="px-2 py-2 text-right font-medium">Na porci</th>
                  <th className="px-2 py-2 text-right font-medium">Celkem</th>
                  <th className="px-2 py-2 font-medium">Obchod</th>
                  <th className="px-5 py-2 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {recept.suroviny.map((s) => {
                  const p = ceny?.find((x) => x.id === s.foodId);
                  const celkemG = s.gramyNaPorce * recept.porce;
                  const cena = p ? (p.aktualniCena * celkemG) / 100 : null;
                  return (
                    <tr key={s.foodId} className="border-b border-border last:border-0">
                      <td className="px-5 py-2 font-medium">
                        {s.nazev}
                        {s.poznamka && <span className="ml-1 text-xs text-muted">({s.poznamka})</span>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{Math.round(s.gramyNaPorce)} g</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{Math.round(celkemG)} g</td>
                      <td className="px-2 py-2">{p?.sleva ? `${p.obchod} 🏷` : p?.obchod ?? "—"}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold">
                        {cena == null ? "—" : `${cena.toFixed(2)} Kč`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* výživa */}
          <div className="space-y-4 lg:col-span-2">
            {(() => {
              const rozbor = spocitejRecept(recept, ceny);
              return (
                <>
                  <Card>
                    <CardNadpis>Na porci</CardNadpis>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Kalorie</div>
                        <div className="text-lg font-extrabold">{rozbor.naPorci.kalorie} kcal</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Cena</div>
                        <div className="text-lg font-extrabold">{rozbor.naPorci.cena.toFixed(2)} Kč</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Bílkoviny</div>
                        <div className="text-lg font-extrabold">{rozbor.naPorci.bilkoviny} g</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Sacharidy</div>
                        <div className="text-lg font-extrabold">{rozbor.naPorci.sacharidy} g</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Tuky</div>
                        <div className="text-lg font-extrabold">{rozbor.naPorci.tuky} g</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      Celý recept ({recept.porce} porcí): {rozbor.celkem.cena.toFixed(2)} Kč ·{" "}
                      {rozbor.celkem.kalorie} kcal
                    </p>
                  </Card>

                  <Card>
                    <CardNadpis>👨‍🍳 Postup</CardNadpis>
                    <ol className="list-decimal space-y-2 pl-5 text-sm">
                      {kroky.map((krok, i) => (
                        <li key={i}>{krok}</li>
                      ))}
                    </ol>
                  </Card>

                  {rozbor.chybejiciCeny.length > 0 && (
                    <Card className="bg-warning-soft text-sm text-warning">
                      Cenu zatím neznáme u: {rozbor.chybejiciCeny.join(", ")} (čeká na scraper).
                    </Card>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
