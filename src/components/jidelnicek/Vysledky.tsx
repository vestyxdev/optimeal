import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  sestavNakupniSeznam,
  type Cile,
  type DenVysledek,
  type NakupniPolozka,
  type TydenniPlan,
} from "@/lib/generator/generator";

/**
 * Sdílené renderování výsledků generátoru – používá Jídelníček
 * i detail uloženého plánu (Mé plány).
 */

export const DENY: Record<string, string> = {
  1: "Pondělí", 2: "Úterý", 3: "Středa", 4: "Čtvrtek", 5: "Pátek", 6: "Sobota", 7: "Neděle",
};

/** Denní souhrny – metrika cíle vs. realita. */
function Metrika({ nazev, hodnota, cilyJednotka }: { nazev: string; hodnota: number; cilyJednotka: string }) {
  return (
    <Card className="py-4">
      <div className="text-xs font-medium text-muted">{nazev}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{hodnota}</div>
      <div className="text-xs text-muted">{cilyJednotka}</div>
    </Card>
  );
}

function KartaNakupu({ polozky, soucetPopisek }: { polozky: NakupniPolozka[]; soucetPopisek: string }) {
  const celkem = polozky.reduce((s, x) => s + x.cenaCelkem, 0);
  const usetreno = polozky.reduce((s, x) => s + x.usetreno, 0);

  return (
    <Card className="p-0">
      <div className="border-b border-border px-5 py-4">
        <CardNadpis className="mb-0">🛒 Nákupní seznam</CardNadpis>
      </div>
      {usetreno > 0 && (
        <div className="border-b border-border bg-ok-soft px-5 py-2 text-sm text-ok">
          💰 Díky dnešním slevám šetříte {usetreno.toFixed(2)} Kč
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-5 py-2 font-medium">Potravina</th>
            <th className="px-2 py-2 text-right font-medium">Množství</th>
            <th className="px-2 py-2 text-right font-medium">Cena/100 g</th>
            <th className="px-2 py-2 font-medium">Obchod</th>
            <th className="px-2 py-2 text-right font-medium">Ušetřeno</th>
            <th className="px-5 py-2 text-right font-medium">Cena</th>
          </tr>
        </thead>
        <tbody>
          {polozky.map((x) => (
            <tr key={x.id} className="border-b border-border last:border-0">
              <td className="px-5 py-2 font-medium">
                {x.nazev}
                {x.sleva && <Badge tono="warning" className="ml-2">SLEVA</Badge>}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{Math.round(x.gramy)} g</td>
              <td className="px-2 py-2 text-right tabular-nums">{x.cenaZa100g.toFixed(2)} Kč</td>
              <td className="px-2 py-2">{x.obchod ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ok">
                {x.usetreno > 0 ? `−${x.usetreno.toFixed(2)} Kč` : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular-nums font-semibold">{x.cenaCelkem.toFixed(2)} Kč</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-2">
            <td className="px-5 py-2 text-right font-semibold" colSpan={5}>{soucetPopisek}</td>
            <td className="px-5 py-2 text-right font-extrabold tabular-nums">{celkem.toFixed(2)} Kč</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

export function DenniVysledek({ den, cile }: { den: DenVysledek; cile: Cile }) {
  const nakup = sestavNakupniSeznam(den.jidelnicek);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrika nazev="Kalorie" hodnota={Math.round(den.celkem.kalorie)} cilyJednotka={`z ${cile.kalorie} kcal`} />
        <Metrika nazev="Bílkoviny" hodnota={den.celkem.bilkoviny} cilyJednotka={`z ${cile.bilkoviny} g`} />
        <Metrika nazev="Sacharidy" hodnota={den.celkem.sacharidy} cilyJednotka={`z ${cile.sacharidy} g`} />
        <Metrika nazev="Tuky" hodnota={den.celkem.tuky} cilyJednotka={`z ${cile.tuky} g`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(den.jidelnicek).map(([nazevJidla, souhrn]) => (
          <Card key={nazevJidla} className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold">{nazevJidla}</span>
              <span className="text-xs text-muted">{Math.round(souhrn.kalorie)} kcal</span>
            </div>
            {souhrn.jidla.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Bez jídel</p>
            ) : (
              <ul className="divide-y divide-border">
                {souhrn.jidla.map((j, i) => (
                  <li key={`${j.id}-${i}`} className="px-4 py-3">
                    <div className="flex justify-between gap-2 text-sm font-medium">
                      <span>{j.nazev}</span>
                      <span className="tabular-nums">{Math.round(j.gramy)} g</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
                      <span>
                        B {j.bilkoviny} · S {j.sacharidy} · T {j.tuky} g
                      </span>
                      {j.sleva && <Badge tono="warning">SLEVA {j.obchod}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border px-4 py-2 text-xs text-muted">
              Cena jídla: <strong className="text-fg">{souhrn.cena.toFixed(2)} Kč</strong>
            </div>
          </Card>
        ))}
      </div>

      <KartaNakupu polozky={nakup} soucetPopisek="Celkem za den" />
    </div>
  );
}

export function TydennyVysledek({ plan, cile }: { plan: TydenniPlan; cile: Cile }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrika nazev="Kalorie za týden" hodnota={Math.round(plan.tyden.kalorie)} cilyJednotka={`z ${cile.kalorie * 7} kcal`} />
        <Metrika nazev="Bílkoviny za týden" hodnota={Math.round(plan.tyden.bilkoviny)} cilyJednotka={`z ${cile.bilkoviny * 7} g`} />
        <Metrika nazev="Cena za týden" hodnota={Math.round(plan.tyden.cena)} cilyJednotka="Kč za 7 dní" />
        <Metrika nazev="Ušetřeno slevami" hodnota={Math.round(plan.tyden.cenaBezna - plan.tyden.cena)} cilyJednotka="Kč v rámci týdne" />
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <CardNadpis className="mb-0">📅 Týdenní souhrn</CardNadpis>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium">Den</th>
                <th className="px-2 py-2 text-right font-medium">Kalorie</th>
                <th className="px-2 py-2 text-right font-medium">Bílkoviny</th>
                <th className="px-2 py-2 text-right font-medium">Cena</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(plan.dny).map(([den, vysledek]) => (
                <tr key={den} className="border-b border-border last:border-0">
                  <td className="px-5 py-2 font-medium">{DENY[Number(den)]}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{Math.round(vysledek.celkem.kalorie)} kcal</td>
                  <td className="px-2 py-2 text-right tabular-nums">{vysledek.celkem.bilkoviny} g</td>
                  <td className="px-5 py-2 text-right tabular-nums">{vysledek.celkem.cena.toFixed(2)} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <KartaNakupu polozky={plan.nakup} soucetPopisek="Celkem za týden" />
    </div>
  );
}
