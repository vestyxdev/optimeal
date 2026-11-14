import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, Printer, Save, ShoppingBasket, Trash2 } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { DenniVysledek, TydennyVysledek } from "@/components/jidelnicek/Vysledky";
import { nactiPotravinySeSlevami, nactiMePlany, smazPlan, ulozPlan } from "@/lib/data/plany";
import { ulozNakupniSeznam } from "@/lib/data/nakup";
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
 * data ze Supabase. Cíle zadává uživatel (předvyplněné z profilu),
 * cena a úspory vycházejí z aktuálních slev.
 */

function naCislo(hodnota: string, vychozi: number): number {
  const n = Number(hodnota.replace(",", "."));
  return Number.isFinite(n) ? n : vychozi;
}

export function Jidelnicek() {
  const { uzivatel } = useAuth();
  const navigaceQ = useQueryClient();
  const [typ, setTyp] = useState<"den" | "tyden">("den");
  const [cile, setCile] = useState<Cile>({ kalorie: 2450, bilkoviny: 184, sacharidy: 244, tuky: 82 });
  const [vysledek, setVysledek] = useState<DenVysledek | TydenniPlan | null>(null);
  const [ulozenyPlanId, setUlozenyPlanId] = useState<string | null>(null);

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
    onSuccess: (id) => {
      setUlozenyPlanId(id);
      toast.success("Plán byl uložen – najdete ho v sekci Mé plány.");
      void dotazPlany.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutaceUlozitNakup = useMutation({
    mutationFn: () => {
      const polozky: NakupniPolozka[] =
        typ === "den"
          ? sestavNakupniSeznam((vysledek as DenVysledek).jidelnicek)
          : (vysledek as TydenniPlan).nakup;
      const nazev =
        typ === "den"
          ? `Nákup – denní plán ${new Date().toLocaleDateString("cs-CZ")}`
          : `Nákup – týdenní plán ${new Date().toLocaleDateString("cs-CZ")}`;
      return ulozNakupniSeznam(
        nazev,
        polozky.map((p) => ({
          foodId: p.id,
          nazev: p.nazev,
          gramy: p.gramy,
          cenaZa100g: p.cenaZa100g,
          obchod: p.obchod,
          jeSleva: p.sleva,
          kategorie: "ostatni",
        })),
        ulozenyPlanId,
      );
    },
    onSuccess: () => {
      toast.success("Nákupní seznam uložen – najdete ho v sekci Nákup.");
      void navigaceQ.invalidateQueries({ queryKey: ["me_nakupni_seznamy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutaceSmazat = useMutation({
    mutationFn: smazPlan,
    onSuccess: () => {
      toast.success("Plán smazán.");
      void navigaceQ.invalidateQueries({ queryKey: ["me_plany"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function generuj() {
    const potraviny: Potravina[] = dotazPotraviny.data ?? [];
    if (potraviny.length === 0) {
      toast.error("Katalog potravin se nenačetl.");
      return;
    }
    setUlozenyPlanId(null);
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
          {vysledek && uzivatel && (
            <Button
              varianta="outline"
              onClick={() => mutaceUlozitNakup.mutate()}
              disabled={mutaceUlozitNakup.isPending}
            >
              <ShoppingBasket className="size-4" />
              {mutaceUlozitNakup.isPending ? "Ukládám…" : "Uložit nákupní seznam"}
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
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link to={`/plany/${p.id}`} className="font-medium hover:text-primary hover:underline">
                  {p.typ === "tyden" ? "Týdenní" : p.typ === "mealprep" ? "Mealprep" : "Denní"} · {p.cil_kalorie} kcal
                  <span className="text-muted"> · {new Date(p.vytvoreno).toLocaleString("cs-CZ")}</span>
                </Link>
                <button
                  onClick={() => {
                    if (window.confirm("Opravdu smazat tento plán?")) mutaceSmazat.mutate(p.id);
                  }}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  title="Smazat plán"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
