import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Printer, Save } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { nactiPotravinySeSlevami, nactiMePlany, ulozPlan } from "@/lib/data/plany";
import { nactiAktivniCile } from "@/lib/data/profil";
import { useAuth } from "@/lib/auth";
import {
  sestavNakupniSeznam,
  vygenerujJidelnicek,
  vygenerujTydenniPlan,
  type Cile,
  type DenVysledek,
  type NakupniPolozka,
  type Potravina,
  type TydenniPlan,
} from "@/lib/generator/generator";

/**
 * Jídelníček – jádro OptiMeal. Generátor (čisté funkce) + reálná
 * data ze Supabase. Cíle zadává uživatel (ve fázi profilu se
 * předvyplní z TDEE), cena a úspory vycházejí z aktuálních slev.
 */

const DENY: Record<string, string> = {
  1: "Pondělí", 2: "Úterý", 3: "Středa", 4: "Čtvrtek", 5: "Pátek", 6: "Sobota", 7: "Neděle",
};

function naCislo(hodnota: string, vychozi: number): number {
  const n = Number(hodnota.replace(",", "."));
  return Number.isFinite(n) ? n : vychozi;
}

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

function DenniVysledek({ den, cile }: { den: DenVysledek; cile: Cile }) {
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

function TydennyVysledek({ plan, cile }: { plan: TydenniPlan; cile: Cile }) {
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

export function Jidelnicek() {
  const { uzivatel } = useAuth();
  const [typ, setTyp] = useState<"den" | "tyden">("den");
  const [cile, setCile] = useState<Cile>({ kalorie: 2450, bilkoviny: 184, sacharidy: 244, tuky: 82 });
  const [vysledek, setVysledek] = useState<DenVysledek | TydenniPlan | null>(null);

  // katalog potravin s aktuálními cenami
  const dotazPotraviny = useQuery({
    queryKey: ["aktualni_ceny"],
    queryFn: nactiPotravinySeSlevami,
  });

  // aktivní cíle uživatele → předvyplnění
  const dotazCile = useQuery({
    queryKey: ["cile"],
    queryFn: nactiAktivniCile,
    enabled: uzivatel !== null,
  });
  useEffect(() => {
    if (dotazCile.data) setCile(dotazCile.data);
  }, [dotazCile.data]);

  const dotazPlany = useQuery({
    queryKey: ["me_plany"],
    queryFn: nactiMePlany,
    enabled: uzivatel !== null,
  });

  const mutaceUlozit = useMutation({
    mutationFn: () => ulozPlan({ typ, cile, vysledek }),
    onSuccess: () => {
      toast.success("Plán byl uložen – najdete ho v sekci Mé plány.");
      void dotazPlany.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function generuj() {
    const potraviny: Potravina[] = dotazPotraviny.data ?? [];
    if (potraviny.length === 0) {
      toast.error("Katalog potravin se nenačetl.");
      return;
    }
    setVysledek(
      typ === "den"
        ? vygenerujJidelnicek(potraviny, cile)
        : vygenerujTydenniPlan(potraviny, cile),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Jídelníček</h1>
        <p className="mt-1 text-sm text-muted">
          Chytrý generátor sestaví plán na míru vašich cílů – a upřednostní potraviny
          právě ve slevě (ceny živě z katalogu).
        </p>
      </div>

      {/* formulář cílů */}
      <Card>
        <CardNadpis>Vaše denní cíle</CardNadpis>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="kcal">Kalorie (kcal)</Label>
            <Input
              id="kcal" type="number" inputMode="numeric"
              value={cile.kalorie}
              onChange={(e) => setCile({ ...cile, kalorie: Math.round(naCislo(e.target.value, 2450)) })}
            />
          </div>
          <div>
            <Label htmlFor="b">Bílkoviny (g)</Label>
            <Input
              id="b" type="number" inputMode="numeric"
              value={cile.bilkoviny}
              onChange={(e) => setCile({ ...cile, bilkoviny: Math.round(naCislo(e.target.value, 184)) })}
            />
          </div>
          <div>
            <Label htmlFor="s">Sacharidy (g)</Label>
            <Input
              id="s" type="number" inputMode="numeric"
              value={cile.sacharidy}
              onChange={(e) => setCile({ ...cile, sacharidy: Math.round(naCislo(e.target.value, 244)) })}
            />
          </div>
          <div>
            <Label htmlFor="t">Tuky (g)</Label>
            <Input
              id="t" type="number" inputMode="numeric"
              value={cile.tuky}
              onChange={(e) => setCile({ ...cile, tuky: Math.round(naCislo(e.target.value, 82)) })}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={generuj} disabled={dotazPotraviny.isLoading}>
            {typ === "den" ? "Vygenerovat den" : "Vygenerovat týden"}
          </Button>
          <Button
            varianta="outline"
            onClick={() => {
              setTyp(typ === "den" ? "tyden" : "den");
              setVysledek(null);
            }}
          >
            <CalendarDays className="size-4" />
            {typ === "den" ? "Přepnout na týden" : "Přepnout na den"}
          </Button>
          {vysledek && uzivatel && (
            <Button
              varianta="outline"
              onClick={() => mutaceUlozit.mutate()}
              disabled={mutaceUlozit.isPending}
            >
              <Save className="size-4" />
              {mutaceUlozit.isPending ? "Ukládám…" : "Uložit plán"}
            </Button>
          )}
          {vysledek && (
            <Button varianta="ghost" onClick={() => window.print()}>
              <Printer className="size-4" /> Tisk
            </Button>
          )}
        </div>
      </Card>

      {/* načítání / chyba katalogu */}
      {dotazPotraviny.isLoading && <p className="text-sm text-muted">Načítám katalog potravin…</p>}
      {dotazPotraviny.isError && (
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotazPotraviny.error as Error).message}
        </Card>
      )}

      {/* výsledek */}
      {vysledek &&
        (typ === "den" ? (
          <DenniVysledek den={vysledek as DenVysledek} cile={cile} />
        ) : (
          <TydennyVysledek plan={vysledek as TydenniPlan} cile={cile} />
        ))}

      {/* uložené plány */}
      {uzivatel && (dotazPlany.data?.length ?? 0) > 0 && (
        <Card>
          <CardNadpis>Mé plány ({dotazPlany.data?.length})</CardNadpis>
          <ul className="divide-y divide-border text-sm">
            {dotazPlany.data?.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>
                  {p.typ === "tyden" ? "Týdenní" : "Denní"} · {p.cil_kalorie} kcal
                  <span className="text-muted"> · {new Date(p.vytvoreno).toLocaleString("cs-CZ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
