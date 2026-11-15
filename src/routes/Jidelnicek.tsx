import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, Printer, Save, ShoppingBasket, Trash2 } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Nacitani";
import { DenniVysledek, TydennyVysledek } from "@/components/jidelnicek/Vysledky";
import { nactiPotravinySeSlevami, nactiMePlany, smazPlan, ulozPlan } from "@/lib/data/plany";
import { ulozNakupniSeznam } from "@/lib/data/nakup";
import { nactiAktivniCile, nactiProfil } from "@/lib/data/profil";
import { formatujKc } from "@/lib/cena";
import { useAuth } from "@/lib/auth";
import {
  filtrujPotraviny,
  sestavNakupniSeznam,
  vygenerujJidelnicek,
  vygenerujTydenniPlan,
  vymenJidlo,
  vymenJidloVTydnu,
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
  const t = hodnota.trim();
  if (t === "") return vychozi;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : vychozi;
}

/** České názvy pro indikaci aktivních filtrů z profilu. */
const DIETA_NAZVY: Record<string, string> = {
  vegetariansky: "vegetariánská",
  vegansky: "veganská",
  bezlepkovy: "bezlepková",
};
const ALERGEN_NAZVY: Record<string, string> = {
  lepek: "lepek", korisi: "korýši", vejce: "vejce", ryby: "ryby",
  arasidy: "arašídy", soja: "sója", mleko: "mléko", orisky: "ořechy",
  skorocel: "celer", horcice: "hořčice", sezam: "sezam",
  sulfit: "oxid siřičitý", lupina: "lupina", vodnany: "měkkýši",
};

/** Výchozí cíle – použité i jako záchrana při neplatném vstupu. */
const VYCHOZI_CILE: Cile = { kalorie: 2450, bilkoviny: 184, sacharidy: 244, tuky: 82 };

export function Jidelnicek() {
  const { uzivatel } = useAuth();
  const navigaceQ = useQueryClient();
  const [typ, setTyp] = useState<"den" | "tyden">("den");
  // cíle držíme jako text – jinak pole nejde vyprázdnit (při mazání
  // by se okamžitě vrátila výchozí hodnota) a české desetinné čárky
  // by se rozbily uprostřed psaní; na čísla se převedou až při použití
  const [cileText, setCileText] = useState({
    kalorie: String(VYCHOZI_CILE.kalorie),
    bilkoviny: String(VYCHOZI_CILE.bilkoviny),
    sacharidy: String(VYCHOZI_CILE.sacharidy),
    tuky: String(VYCHOZI_CILE.tuky),
  });
  const cile: Cile = {
    kalorie: Math.round(naCislo(cileText.kalorie, VYCHOZI_CILE.kalorie)),
    bilkoviny: Math.round(naCislo(cileText.bilkoviny, VYCHOZI_CILE.bilkoviny)),
    sacharidy: Math.round(naCislo(cileText.sacharidy, VYCHOZI_CILE.sacharidy)),
    tuky: Math.round(naCislo(cileText.tuky, VYCHOZI_CILE.tuky)),
  };
  const [vysledek, setVysledek] = useState<DenVysledek | TydenniPlan | null>(null);
  const [ulozenyPlanId, setUlozenyPlanId] = useState<string | null>(null);
  const [nakupUlozen, nastavNakupUlozen] = useState(false);
  const [smazanyPlanId, setSmazanyPlanId] = useState<string | null>(null);

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
    if (dotazCile.data) {
      setCileText({
        kalorie: String(dotazCile.data.kalorie),
        bilkoviny: String(dotazCile.data.bilkoviny),
        sacharidy: String(dotazCile.data.sacharidy),
        tuky: String(dotazCile.data.tuky),
      });
    }
  }, [dotazCile.data]);

  const dotazPlany = useQuery({
    queryKey: ["me_plany"],
    queryFn: nactiMePlany,
    enabled: uzivatel !== null,
  });

  // profil: počet jídel denně + týdenní rozpočet
  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });
  const pocetJidel = dotazProfil.data?.pocetJidelDenne ?? 4;
  const rozpocet = dotazProfil.data?.tydennyRozpocetKc ?? null;
  const filtr = dotazProfil.data
    ? { diety: dotazProfil.data.dieta, alergeny: dotazProfil.data.alergie }
    : null;

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
      nastavNakupUlozen(true);
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
    const filtrovane = filtrujPotraviny(potraviny, filtr);
    if (filtrovane.length === 0) {
      toast.error(
        "Vaše diety a alergie vyloučily všechny potraviny z katalogu – zkombinovaný filtr je příliš přísný.",
      );
      return;
    }
    setUlozenyPlanId(null);
    nastavNakupUlozen(false);
    const novy =
      typ === "den"
        ? vygenerujJidelnicek(potraviny, cile, null, 0.85, pocetJidel, filtr)
        : vygenerujTydenniPlan(potraviny, cile, pocetJidel, filtr);
    setVysledek(novy);
    const kcal = "celkem" in novy ? novy.celkem.kalorie : novy.tyden.kalorie;
    if (kcal === 0) {
      toast.warning(
        "Generátor nesestavil žádné jídlo – po vyfiltrování zbývá málo potravin nebo jsou cíle příliš nízké.",
      );
    } else if (filtrovane.length < 12) {
      toast.info(
        `Filtr propustil jen ${filtrovane.length} potravin – plán se bude opakovat.`,
      );
    }
  }

  function vymen(nazevJidla: string) {
    const potraviny = dotazPotraviny.data ?? [];
    if (potraviny.length === 0 || vysledek === null || typ !== "den") return;
    const novy = vymenJidlo(potraviny, vysledek as DenVysledek, nazevJidla, cile, filtr);
    if (novy === null) {
      toast.error("Pro toto jídlo se nepodařilo najít náhradu.");
      return;
    }
    // obsah se změnil – uložený plán / nákup už neodpovídá
    setVysledek(novy);
    setUlozenyPlanId(null);
    nastavNakupUlozen(false);
    toast.success(`${nazevJidla} bylo vyměněno.`);
  }

  function vymenTyden(denIndex: number, nazevJidla: string) {
    const potraviny = dotazPotraviny.data ?? [];
    if (potraviny.length === 0 || vysledek === null || typ !== "tyden") return;
    const novy = vymenJidloVTydnu(potraviny, vysledek as TydenniPlan, denIndex, nazevJidla, cile, filtr);
    if (novy === null) {
      toast.error("Pro toto jídlo se nepodařilo najít náhradu.");
      return;
    }
    setVysledek(novy);
    setUlozenyPlanId(null);
    nastavNakupUlozen(false);
    toast.success(`${nazevJidla} bylo vyměněno.`);
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
              id="kcal" type="number" inputMode="numeric" min={0}
              value={cileText.kalorie}
              onChange={(e) => setCileText({ ...cileText, kalorie: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="b">Bílkoviny (g)</Label>
            <Input
              id="b" type="number" inputMode="numeric" min={0}
              value={cileText.bilkoviny}
              onChange={(e) => setCileText({ ...cileText, bilkoviny: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s">Sacharidy (g)</Label>
            <Input
              id="s" type="number" inputMode="numeric" min={0}
              value={cileText.sacharidy}
              onChange={(e) => setCileText({ ...cileText, sacharidy: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="t">Tuky (g)</Label>
            <Input
              id="t" type="number" inputMode="numeric" min={0}
              value={cileText.tuky}
              onChange={(e) => setCileText({ ...cileText, tuky: e.target.value })}
            />
          </div>
        </div>

        {filtr && (filtr.diety.length > 0 || filtr.alergeny.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>Generátor respektuje vaše nastavení:</span>
            {filtr.diety.map((d) => (
              <Badge key={d} tono="ok">{DIETA_NAZVY[d] ?? d} dieta</Badge>
            ))}
            {filtr.alergeny.map((a) => (
              <Badge key={a} tono="accent">bez {ALERGEN_NAZVY[a] ?? a}</Badge>
            ))}
          </div>
        )}

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
              disabled={mutaceUlozit.isPending || ulozenyPlanId !== null}
            >
              <Save className="size-4" />
              {mutaceUlozit.isPending
                ? "Ukládám…"
                : ulozenyPlanId !== null
                  ? "Plán uložen"
                  : "Uložit plán"}
            </Button>
          )}
          {vysledek && uzivatel && (
            <Button
              varianta="outline"
              onClick={() => mutaceUlozitNakup.mutate()}
              disabled={mutaceUlozitNakup.isPending || nakupUlozen}
            >
              <ShoppingBasket className="size-4" />
              {mutaceUlozitNakup.isPending
                ? "Ukládám…"
                : nakupUlozen
                  ? "Seznam uložen"
                  : "Uložit nákupní seznam"}
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
      {dotazPotraviny.isLoading && <Skeleton className="h-24" />}
      {dotazPotraviny.isError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-danger-soft text-sm text-danger">
          <span>{(dotazPotraviny.error as Error).message}</span>
          <Button
            varianta="outline"
            velikost="sm"
            onClick={() => void dotazPotraviny.refetch()}
          >
            Zkusit znovu
          </Button>
        </Card>
      )}

      {/* výsledek */}
      {vysledek &&
        (typ === "den" ? (
          <DenniVysledek den={vysledek as DenVysledek} cile={cile} naVymenu={vymen} />
        ) : (
          <>
            <TydennyVysledek plan={vysledek as TydenniPlan} cile={cile} naVymenu={vymenTyden} />
            {rozpocet !== null && rozpocet > 0 && (
              <RozpocetKarta cena={(vysledek as TydenniPlan).tyden.cena} rozpocet={rozpocet} />
            )}
          </>
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
                  onClick={() => setSmazanyPlanId(p.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  title="Smazat plán"
                  aria-label="Smazat plán"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PotvrdDialog
        otevren={smazanyPlanId !== null}
        naZavreni={() => setSmazanyPlanId(null)}
        naPotvrzeni={() => {
          if (smazanyPlanId) mutaceSmazat.mutate(smazanyPlanId);
        }}
        nadpis="Smazat plán"
        text="Opravdu smazat tento uložený plán? Akce je nevratná."
        potvrdit="Smazat"
        destruktivni
      />
    </div>
  );
}

/** Porovnání ceny týdenního plánu s rozpočtem z profilu. */
function RozpocetKarta({ cena, rozpocet }: { cena: number; rozpocet: number }) {
  const procento = Math.round((cena / rozpocet) * 100);
  const presahuje = cena > rozpocet;
  return (
    <Card>
      <CardNadpis>Týdenní rozpočet</CardNadpis>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums">
          {formatujKc(cena)} / {formatujKc(rozpocet)} Kč
        </span>
        <span className={presahuje ? "font-semibold text-danger" : "text-muted"}>
          {procento} %
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-pill bg-surface-2">
        <div
          className={presahuje ? "h-full bg-danger" : "h-full bg-primary"}
          style={{ width: `${Math.min(100, procento)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {presahuje
          ? `Plán překračuje rozpočet o ${formatujKc(cena - rozpocet)} Kč – zkuste vyšší podíl slevových potravin.`
          : `Plán se vejde do rozpočtu – rezerva ${formatujKc(rozpocet - cena)} Kč.`}
      </p>
    </Card>
  );
}
