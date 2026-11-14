import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Carrot, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardNadpis } from "@/components/ui/Card";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Nacitani";
import { useAuth } from "@/lib/auth";
import { sklonuj } from "@/lib/sklonovani";
import {
  hledejOpenFoodFacts,
  nactiKatalogPotravin,
  pridejPotravinu,
  smazPotravinu,
  type KatalogPotravina,
} from "@/lib/data/potraviny";

/**
 * Katalog potravin – živá data z `aktualni_ceny` (včetně slev a obchodu),
 * filtrace + přidání vlastní potraviny s dohledáním nutric z OpenFoodFacts.
 */

const KATEGORIE: Record<string, string> = {
  maso_ryby: "Maso a ryby",
  mlecne_vyrobky: "Mléčné výrobky",
  ovoce_zelenina: "Ovoce a zelenina",
  peckoviny_obily: "Pečivo a obiloviny",
  suchary_testoviny: "Suchary a těstoviny",
  ostatni: "Ostatní",
};

const ALERGEN_NAZVY: Record<string, string> = {
  lepek: "lepek", korisi: "korýši", vejce: "vejce", ryby: "ryby",
  arasidy: "arašídy", soja: "sója", mleko: "mléko", orisky: "ořechy",
  skorocel: "celer", horcice: "hořčice", sezam: "sezam",
  sulfit: "oxid siřičitý", lupina: "lupina", vodnany: "měkkýši",
};

const DIETA_NAZVY: Record<string, string> = {
  vegetariansky: "veg", vegansky: "vegan", bezlepkovy: "bez lepku",
};

interface FormPotravina {
  nazev: string;
  kategorie: string;
  kalorie: string;
  bilkoviny: string;
  sacharidy: string;
  tuky: string;
  cena: string;
}

const PRAZDNY_FORM: FormPotravina = {
  nazev: "",
  kategorie: "ostatni",
  kalorie: "",
  bilkoviny: "",
  sacharidy: "",
  tuky: "",
  cena: "",
};

export function Potraviny() {
  const { uzivatel } = useAuth();
  const dotaz = useQuery({ queryKey: ["katalog_potravin"], queryFn: nactiKatalogPotravin });
  const [hledat, setHledat] = useState("");
  const [kategorie, setKategorie] = useState<string>("vse");
  const [formZobrazen, setFormZobrazen] = useState(false);

  const potraviny = dotaz.data ?? [];
  const filtrovane = useMemo(() => {
    const dot = hledat.trim().toLowerCase();
    return potraviny.filter(
      (p) =>
        (kategorie === "vse" || p.kategorie === kategorie) &&
        (dot === "" || p.nazev.toLowerCase().includes(dot)),
    );
  }, [potraviny, hledat, kategorie]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Katalog potravin</h1>
          <p className="mt-1 text-sm text-muted">
            {dotaz.isLoading
              ? "Načítám…"
              : `${potraviny.length} ${sklonuj(potraviny.length, "potravina", "potraviny", "potravin")} s aktuálními cenami. Generátor je používá automaticky.`}
          </p>
        </div>
        {uzivatel && !formZobrazen && (
          <Button varianta="outline" onClick={() => setFormZobrazen(true)}>
            <Plus className="size-4" /> Nová potravina
          </Button>
        )}
      </div>

      {formZobrazen && uzivatel && (
        <FormNovePotraviny naZavreni={() => setFormZobrazen(false)} />
      )}
      {!uzivatel && (
        <p className="text-xs text-muted">
          Pro přidání vlastní potraviny se přihlaste – katalog je sdílený.
        </p>
      )}

      {/* filtry */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={hledat}
            onChange={(e) => setHledat(e.target.value)}
            placeholder="Hledat potravinu…"
            className="pl-9"
          />
        </div>
        <Select
          value={kategorie}
          onChange={(e) => setKategorie(e.target.value)}
          aria-label="Filtrovat podle kategorie"
          className="w-auto min-w-44"
        >
          <option value="vse">Všechny kategorie</option>
          {Object.entries(KATEGORIE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>

      {dotaz.isError && (
        <Card className="text-sm text-danger">{(dotaz.error as Error).message}</Card>
      )}

      {/* tabulka */}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Název</th>
              <th className="px-4 py-3">Kategorie</th>
              <th className="px-4 py-3 text-right">kcal/100 g</th>
              <th className="px-4 py-3 text-right">B</th>
              <th className="px-4 py-3 text-right">S</th>
              <th className="px-4 py-3 text-right">T</th>
              <th className="px-4 py-3 text-right">Cena</th>
              {uzivatel && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {dotaz.isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="px-4 py-3" colSpan={8}>
                    <Skeleton className="h-4 w-2/3" />
                  </td>
                </tr>
              ))}
            {filtrovane.map((p) => (
              <RadekPotraviny key={p.id} p={p} uzivatelId={uzivatel?.id ?? null} />
            ))}
            {!dotaz.isLoading && filtrovane.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  <Carrot className="mx-auto mb-2 size-6" />
                  Nic tu není – zkuste jiný dotaz nebo kategorii.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RadekPotraviny({
  p,
  uzivatelId,
}: {
  p: KatalogPotravina;
  uzivatelId: string | null;
}) {
  const klient = useQueryClient();
  const [potvrdit, setPotvrdit] = useState(false);
  const vlastni = uzivatelId !== null && p.vytvoril === uzivatelId;
  const mutaceSmaz = useMutation({
    mutationFn: () => smazPotravinu(p.id),
    onSuccess: () => {
      toast.success(`„${p.nazev}" odstraněna z katalogu.`);
      klient.invalidateQueries({ queryKey: ["katalog_potravin"] });
      klient.invalidateQueries({ queryKey: ["aktualni_ceny"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
      <td className="px-4 py-2.5">
        <span className="font-medium">{p.nazev}</span>
        <span className="ml-2 inline-flex gap-1">
          {p.sleva && <Badge tono="accent">{p.obchod ? `${p.obchod} sleva` : "Sleva"}</Badge>}
          {vlastni && <Badge tono="primary">Vlastní</Badge>}
          {(p.diety ?? []).map((d) => (
            <Badge key={d} tono="ok">{DIETA_NAZVY[d] ?? d}</Badge>
          ))}
        </span>
        {(p.alergeny ?? []).length > 0 && (
          <span className="block text-xs text-muted">
            alergeny: {(p.alergeny ?? []).map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted">{KATEGORIE[p.kategorie ?? "ostatni"] ?? p.kategorie}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.kalorie}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.bilkoviny}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.sacharidy}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.tuky}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {p.aktualniCena.toFixed(2)} Kč
        {p.sleva && p.beznaCena > p.aktualniCena && (
          <span className="ml-1 text-xs text-muted line-through">{p.beznaCena.toFixed(2)}</span>
        )}
      </td>
      {uzivatelId !== null && (
        <td className="px-4 py-2.5 text-right">
          {vlastni && (
            <>
            <button
              type="button"
              onClick={() => setPotvrdit(true)}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
              title="Smazat vlastní potravinu"
              aria-label={`Smazat ${p.nazev}`}
            >
              <Trash2 className="size-4" />
            </button>
            <PotvrdDialog
              otevren={potvrdit}
              naZavreni={() => setPotvrdit(false)}
              naPotvrzeni={() => mutaceSmaz.mutate()}
              nadpis="Smazat potravinu"
              text={<>Opravdu smazat „{p.nazev}" z katalogu? Zmizí z vašeho seznamu i z generátoru.</>}
              potvrdit="Smazat"
              destruktivni
            />
            </>
          )}
        </td>
      )}
    </tr>
  );
}

/** Formulář nové potraviny s dohledáním hodnot v OpenFoodFacts. */
function FormNovePotraviny({ naZavreni }: { naZavreni: () => void }) {
  const klient = useQueryClient();
  const [f, setF] = useState<FormPotravina>(PRAZDNY_FORM);
  const [hledaOff, setHledaOff] = useState(false);
  const uprav = (klic: keyof FormPotravina, hodnota: string) =>
    setF((pred) => ({ ...pred, [klic]: hodnota }));

  const mutaceUloz = useMutation({
    mutationFn: () => {
      const cislo = (v: string, nazev: string, max: number) => {
        const t = v.trim();
        if (t === "") throw new Error(`${nazev}: vyplňte číslo (0 lze zadat explicitně).`);
        const n = Number(t.replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > max) {
          throw new Error(`${nazev}: zadejte číslo 0–${max}.`);
        }
        return Math.round(n * 100) / 100;
      };
      if (f.nazev.trim().length < 2) throw new Error("Název musí mít aspoň 2 znaky.");
      const kalorie = cislo(f.kalorie, "Kalorie", 1500);
      if (kalorie <= 0) throw new Error("Kalorie musí být větší než 0 – potravina bez energie by rozbila generátor.");
      return pridejPotravinu({
        nazev: f.nazev,
        kategorie: f.kategorie,
        kalorie,
        bilkoviny: cislo(f.bilkoviny, "Bílkoviny", 100),
        sacharidy: cislo(f.sacharidy, "Sacharidy", 100),
        tuky: cislo(f.tuky, "Tuky", 100),
        beznaCena: cislo(f.cena, "Cena", 1000),
      });
    },
    onSuccess: () => {
      toast.success("Potravina byla přidána do katalogu.");
      klient.invalidateQueries({ queryKey: ["katalog_potravin"] });
      klient.invalidateQueries({ queryKey: ["aktualni_ceny"] });
      naZavreni();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function dohledatOff() {
    if (f.nazev.trim().length < 2) {
      toast.error("Nejdřív zadejte název potraviny.");
      return;
    }
    setHledaOff(true);
    try {
      const nalezena = await hledejOpenFoodFacts(f.nazev.trim());
      if (!nalezena) {
        toast.info("V OpenFoodFacts se nic nenašlo – vyplňte ručně.");
        return;
      }
      setF((pred) => ({
        ...pred,
        nazev: nalezena.nazev,
        kalorie: nalezena.kalorie?.toString() ?? pred.kalorie,
        bilkoviny: nalezena.bilkoviny?.toString() ?? pred.bilkoviny,
        sacharidy: nalezena.sacharidy?.toString() ?? pred.sacharidy,
        tuky: nalezena.tuky?.toString() ?? pred.tuky,
      }));
      toast.success("Hodnoty doplněny z OpenFoodFacts – cenu doplňte ručně.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHledaOff(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardNadpis>Nová potravina</CardNadpis>
        <button
          type="button"
          onClick={naZavreni}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          aria-label="Zavřít formulář"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Hodnoty vždy za 100 g – stejně jako zbytek katalogu, aby šly porovnat.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="pNazev">Název</Label>
          <div className="flex gap-2">
            <Input
              id="pNazev"
              value={f.nazev}
              onChange={(e) => uprav("nazev", e.target.value)}
              placeholder="Např. Skyr natural"
            />
            <Button
              type="button"
              varianta="outline"
              onClick={dohledatOff}
              disabled={hledaOff}
              title="Dohledat nutriční hodnoty v OpenFoodFacts"
            >
              <Sparkles className="size-4" />
              {hledaOff ? "Hledám…" : "OFF"}
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="pKat">Kategorie</Label>
          <Select
            id="pKat"
            value={f.kategorie}
            onChange={(e) => uprav("kategorie", e.target.value)}
          >
            {Object.entries(KATEGORIE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pCena">Cena (Kč/100 g)</Label>
          <Input id="pCena" inputMode="decimal" value={f.cena} onChange={(e) => uprav("cena", e.target.value)} placeholder="Např. 9.90" />
        </div>
        <div>
          <Label htmlFor="pKcal">Kalorie (kcal/100 g)</Label>
          <Input id="pKcal" inputMode="decimal" value={f.kalorie} onChange={(e) => uprav("kalorie", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="pB">B (g)</Label>
            <Input id="pB" inputMode="decimal" value={f.bilkoviny} onChange={(e) => uprav("bilkoviny", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pS">S (g)</Label>
            <Input id="pS" inputMode="decimal" value={f.sacharidy} onChange={(e) => uprav("sacharidy", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pT">T (g)</Label>
            <Input id="pT" inputMode="decimal" value={f.tuky} onChange={(e) => uprav("tuky", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button varianta="outline" onClick={naZavreni}>Zrušit</Button>
        <Button onClick={() => mutaceUloz.mutate()} disabled={mutaceUloz.isPending}>
          {mutaceUloz.isPending ? "Ukládám…" : "Přidat do katalogu"}
        </Button>
      </div>
    </Card>
  );
}
