import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple, Beef, Carrot, Cookie, Milk, Package, Pencil, Plus, ScanBarcode, Search,
  Sparkles, Trash2, Wheat, X,
} from "lucide-react";
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
import { podporujeSkenovaniKodu, SkenovaniEan } from "@/components/potraviny/SkenovaniEan";
import {
  hledejOpenFoodFactsVice,
  hledejPodleEanLokalne,
  nactiOffPodleEan,
  normalizujEan,
  nactiKatalogPotravin,
  nactiPotravinu,
  pridejPotravinu,
  smazPotravinu,
  upravPotravinu,
  type KatalogPotravina,
  type OffNalezenaPotravina,
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

const KATEGORIE_IKONY: Record<string, typeof Apple> = {
  maso_ryby: Beef,
  mlecne_vyrobky: Milk,
  ovoce_zelenina: Apple,
  peckoviny_obily: Wheat,
  suchary_testoviny: Cookie,
  ostatni: Package,
};

/** Podíl energie z B/S/T – vizuální pásek jako v kalorických tabulkách. */
function PasekMakro({ p }: { p: Pick<KatalogPotravina, "bilkoviny" | "sacharidy" | "tuky"> }) {
  const kcalB = p.bilkoviny * 4;
  const kcalS = p.sacharidy * 4;
  const kcalT = p.tuky * 9;
  const celkem = kcalB + kcalS + kcalT;
  if (celkem <= 0) return null;
  const podil = (v: number) => Math.round((v / celkem) * 100);
  return (
    <span className="mt-1 flex items-center gap-1.5" title={`Podíl energie – B ${podil(kcalB)} %, S ${podil(kcalS)} %, T ${podil(kcalT)} %`}>
      <span aria-hidden className="flex h-1 w-20 overflow-hidden rounded-full bg-surface-2">
        <span style={{ width: `${podil(kcalB)}%`, backgroundColor: "#2d6a4f" }} />
        <span style={{ width: `${podil(kcalS)}%`, backgroundColor: "#7fae3e" }} />
        <span style={{ width: `${podil(kcalT)}%`, backgroundColor: "#b45309" }} />
      </span>
      <span className="sr-only">
        Podíl energie: bílkoviny {podil(kcalB)} %, sacharidy {podil(kcalS)} %, tuky {podil(kcalT)} %.
      </span>
    </span>
  );
}

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

/** Filtrace katalogu: text hledá v názvu, čistě číselný dotaz i v EAN. */
export function filtrujKatalog(
  potraviny: KatalogPotravina[],
  dotaz: string,
  kategorie: string,
): KatalogPotravina[] {
  const dot = dotaz.trim().toLowerCase();
  const jeEan = /^\d{4,14}$/.test(dot.replace(/[\s-]/g, ""));
  const eanDotaz = dot.replace(/[\s-]/g, "");
  return potraviny.filter(
    (p) =>
      (kategorie === "vse" || p.kategorie === kategorie) &&
      (dot === "" ||
        p.nazev.toLowerCase().includes(dot) ||
        (jeEan && p.ean !== null && p.ean.includes(eanDotaz))),
  );
}

export function Potraviny() {
  const { uzivatel } = useAuth();
  const dotaz = useQuery({ queryKey: ["katalog_potravin"], queryFn: nactiKatalogPotravin });
  const [hledat, setHledat] = useState("");
  const [kategorie, setKategorie] = useState<string>("vse");
  const [formZobrazen, setFormZobrazen] = useState(false);
  const [editovana, setEditovana] = useState<KatalogPotravina | null>(null);

  const zavriForm = () => {
    setFormZobrazen(false);
    setEditovana(null);
  };

  const potraviny = dotaz.data ?? [];
  const filtrovane = useMemo(
    () => filtrujKatalog(potraviny, hledat, kategorie),
    [potraviny, hledat, kategorie],
  );

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
        <FormNovePotraviny naZavreni={zavriForm} editovana={editovana} />
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
            placeholder="Hledat potravinu nebo čárový kód…"
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

      {/* karty – mobil */}
      <div className="space-y-3 md:hidden">
        {dotaz.isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <Card key={i}><Skeleton className="h-16 w-full" /></Card>
          ))}
        {!dotaz.isLoading &&
          filtrovane.map((p) => (
            <KartaPotraviny
              key={p.id}
              p={p}
              uzivatelId={uzivatel?.id ?? null}
              naUpravu={() => {
                setEditovana(p);
                setFormZobrazen(true);
              }}
            />
          ))}
        {!dotaz.isLoading && filtrovane.length === 0 && (
          <Card className="py-8 text-center text-muted">
            <Carrot className="mx-auto mb-2 size-6" />
            Nic tu není – zkuste jiný dotaz nebo kategorii.
          </Card>
        )}
      </div>

      {/* tabulka – desktop */}
      <div className="hidden overflow-x-auto rounded-card border border-border md:block">
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
              <RadekPotraviny
                key={p.id}
                p={p}
                uzivatelId={uzivatel?.id ?? null}
                naUpravu={() => {
                  setEditovana(p);
                  setFormZobrazen(true);
                }}
              />
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

/** Akce vlastní potraviny (upravit/smazat) – sdílené pro řádek i kartu. */
function AkcePotraviny({
  p,
  naUpravu,
}: {
  p: KatalogPotravina;
  naUpravu: () => void;
}) {
  const klient = useQueryClient();
  const [potvrdit, setPotvrdit] = useState(false);
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
    <>
      <button
        type="button"
        onClick={naUpravu}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        title="Upravit vlastní potravinu"
        aria-label={`Upravit ${p.nazev}`}
      >
        <Pencil className="size-4" />
      </button>
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
  );
}

function RadekPotraviny({
  p,
  uzivatelId,
  naUpravu,
}: {
  p: KatalogPotravina;
  uzivatelId: string | null;
  naUpravu: () => void;
}) {
  const vlastni = uzivatelId !== null && p.vytvoril === uzivatelId;

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
      <td className="px-4 py-2.5">
        {p.obrazek && (
          <img
            src={p.obrazek}
            alt=""
            loading="lazy"
            className="mr-2 inline-block size-8 rounded-md object-cover align-middle"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
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
        <PasekMakro p={p} />
      </td>
      <td className="px-4 py-2.5 text-muted">
        {(() => {
          const Ikona = KATEGORIE_IKONY[p.kategorie ?? "ostatni"] ?? Package;
          return (
            <span className="inline-flex items-center gap-1.5">
              <Ikona className="size-3.5 shrink-0" aria-hidden />
              {KATEGORIE[p.kategorie ?? "ostatni"] ?? p.kategorie}
            </span>
          );
        })()}
      </td>
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
          {vlastni && <AkcePotraviny p={p} naUpravu={naUpravu} />}
        </td>
      )}
    </tr>
  );
}

/** Karta potraviny pro mobil – stejné informace jako řádek tabulky. */
function KartaPotraviny({
  p,
  uzivatelId,
  naUpravu,
}: {
  p: KatalogPotravina;
  uzivatelId: string | null;
  naUpravu: () => void;
}) {
  const vlastni = uzivatelId !== null && p.vytvoril === uzivatelId;
  const Ikona = KATEGORIE_IKONY[p.kategorie ?? "ostatni"] ?? Package;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        {p.obrazek ? (
          <img
            src={p.obrazek}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-lg object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
            <Ikona className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-medium leading-snug">{p.nazev}</p>
            {vlastni && (
              <span className="flex shrink-0">
                <AkcePotraviny p={p} naUpravu={naUpravu} />
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
            <Ikona className="size-3" aria-hidden />
            {KATEGORIE[p.kategorie ?? "ostatni"] ?? p.kategorie}
            {p.sleva && <Badge tono="accent">{p.obchod ? `${p.obchod} sleva` : "Sleva"}</Badge>}
            {vlastni && <Badge tono="primary">Vlastní</Badge>}
            {(p.diety ?? []).map((d) => (
              <Badge key={d} tono="ok">{DIETA_NAZVY[d] ?? d}</Badge>
            ))}
          </p>
          {(p.alergeny ?? []).length > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              alergeny: {(p.alergeny ?? []).map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
            </p>
          )}
          <PasekMakro p={p} />
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="tabular-nums text-muted">
              {p.kalorie} kcal · B {p.bilkoviny} · S {p.sacharidy} · T {p.tuky}
            </span>
            <span className="tabular-nums font-semibold">
              {p.aktualniCena.toFixed(2)} Kč
              {p.sleva && p.beznaCena > p.aktualniCena && (
                <span className="ml-1 text-xs font-normal text-muted line-through">
                  {p.beznaCena.toFixed(2)}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Formulář potraviny (nová i editace vlastní) s dohledáním hodnot v OpenFoodFacts. */
function FormNovePotraviny({
  naZavreni,
  editovana,
}: {
  naZavreni: () => void;
  editovana?: KatalogPotravina | null;
}) {
  const klient = useQueryClient();
  const [f, setF] = useState<FormPotravina>(() =>
    editovana
      ? {
          nazev: editovana.nazev,
          kategorie: editovana.kategorie ?? "ostatni",
          kalorie: String(editovana.kalorie),
          bilkoviny: String(editovana.bilkoviny),
          sacharidy: String(editovana.sacharidy),
          tuky: String(editovana.tuky),
          cena: String(editovana.beznaCena),
        }
      : PRAZDNY_FORM,
  );
  const [hledaOff, setHledaOff] = useState(false);
  const [ean, setEan] = useState("");
  const [skenovani, setSkenovani] = useState(false);
  const [offKandidati, setOffKandidati] = useState<OffNalezenaPotravina[]>([]);
  // undefined = nebylo dohledáno (u editace ponechat stávající obrázek)
  const [obrazek, setObrazek] = useState<string | null | undefined>(undefined);

  // Při editaci dotáhnout uložený EAN (v aktualni_ceny sloupec není).
  const detail = useQuery({
    queryKey: ["potravina_detail", editovana?.id],
    queryFn: () => nactiPotravinu(editovana!.id),
    enabled: editovana != null,
  });
  useEffect(() => {
    if (detail.data?.ean) setEan(detail.data.ean);
  }, [detail.data]);
  const uprav = (klic: keyof FormPotravina, hodnota: string) =>
    setF((pred) => ({ ...pred, [klic]: hodnota }));

  const mutaceUloz = useMutation({
    mutationFn: async () => {
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
      const hodnoty = {
        nazev: f.nazev,
        kategorie: f.kategorie,
        kalorie,
        bilkoviny: cislo(f.bilkoviny, "Bílkoviny", 100),
        sacharidy: cislo(f.sacharidy, "Sacharidy", 100),
        tuky: cislo(f.tuky, "Tuky", 100),
        beznaCena: cislo(f.cena, "Cena", 1000),
        ean: normalizujEan(ean),
        ...(obrazek !== undefined ? { obrazek } : {}),
      };
      if (editovana) {
        await upravPotravinu(editovana.id, hodnoty);
        return;
      }
      await pridejPotravinu(hodnoty);
    },
    onSuccess: () => {
      toast.success(editovana ? "Potravina byla upravena." : "Potravina byla přidána do katalogu.");
      klient.invalidateQueries({ queryKey: ["katalog_potravin"] });
      klient.invalidateQueries({ queryKey: ["aktualni_ceny"] });
      naZavreni();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function aplikujOff(nalezena: OffNalezenaPotravina) {
    setF((pred) => ({
      ...pred,
      nazev: nalezena.nazev,
      kalorie: nalezena.kalorie?.toString() ?? pred.kalorie,
      bilkoviny: nalezena.bilkoviny?.toString() ?? pred.bilkoviny,
      sacharidy: nalezena.sacharidy?.toString() ?? pred.sacharidy,
      tuky: nalezena.tuky?.toString() ?? pred.tuky,
    }));
    setObrazek(nalezena.obrazek);
    setOffKandidati([]);
    toast.success("Hodnoty doplněny z OpenFoodFacts – cenu doplňte ručně.");
  }

  async function dohledatOff() {
    if (f.nazev.trim().length < 2) {
      toast.error("Nejdřív zadejte název potraviny.");
      return;
    }
    setHledaOff(true);
    try {
      const nalezene = await hledejOpenFoodFactsVice(f.nazev.trim());
      if (nalezene.length === 0) {
        toast.info("V OpenFoodFacts se nic nenašlo – vyplňte ručně.");
        return;
      }
      if (nalezene.length === 1) {
        aplikujOff(nalezene[0]!);
        return;
      }
      setOffKandidati(nalezene);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHledaOff(false);
    }
  }

  async function dohledatEan(kod?: string) {
    const vstup = (kod ?? ean).trim();
    if (vstup === "") {
      toast.error("Zadejte čárový kód produktu.");
      return;
    }
    const kodNorm = normalizujEan(vstup);
    if (kodNorm === null) {
      toast.error("Zadejte platný čárový kód (8–14 číslic).");
      return;
    }
    setHledaOff(true);
    try {
      const lokalni = await hledejPodleEanLokalne(kodNorm);
      if (lokalni && lokalni.id === editovana?.id) {
        toast.info("Tento kód už máte u potraviny uložený.");
        return;
      }
      if (lokalni) {
        toast.info(`„${lokalni.nazev}" už v katalogu pod tímto kódem existuje.`);
        return;
      }
      const nalezena = await nactiOffPodleEan(kodNorm);
      if (!nalezena) {
        toast.info("Produkt s tímto kódem v OpenFoodFacts není – vyplňte ručně.");
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
      setObrazek(nalezena.obrazek);
      toast.success(`„${nalezena.nazev}" nalezen – kategorii a cenu doplňte ručně.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHledaOff(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardNadpis>{editovana ? "Upravit potravinu" : "Nová potravina"}</CardNadpis>
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

      {skenovani ? (
        <SkenovaniEan
          naKod={(kod) => {
            setEan(kod);
            setSkenovani(false);
            void dohledatEan(kod);
          }}
          naZavreni={() => setSkenovani(false)}
        />
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <Label htmlFor="pEan">Čárový kód (EAN)</Label>
            <Input
              id="pEan"
              inputMode="numeric"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void dohledatEan();
                }
              }}
              placeholder="Např. 8591234567890"
            />
          </div>
          <Button
            type="button"
            varianta="outline"
            onClick={() => void dohledatEan()}
            disabled={hledaOff}
          >
            <Search className="size-4" /> Najít podle kódu
          </Button>
          {podporujeSkenovaniKodu() && (
            <Button
              type="button"
              varianta="outline"
              onClick={() => setSkenovani(true)}
              disabled={hledaOff}
              title="Naskenovat čárový kód kamerou"
            >
              <ScanBarcode className="size-4" /> Skenovat kamerou
            </Button>
          )}
        </div>
      )}

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
        {offKandidati.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-border bg-surface-2/50 p-2" role="group" aria-label="Nalezené produkty v OpenFoodFacts">
            <p className="mb-1 px-1 text-xs text-muted">
              Nalezeno {offKandidati.length} {sklonuj(offKandidati.length, "produkt", "produkty", "produktů")} – vyberte ten správný:
            </p>
            <ul className="max-h-48 divide-y divide-border/60 overflow-y-auto">
              {offKandidati.map((k, i) => (
                <li key={`${k.nazev}-${i}`}>
                  <button
                    type="button"
                    onClick={() => aplikujOff(k)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    {k.obrazek && (
                      <img
                        src={k.obrazek}
                        alt=""
                        loading="lazy"
                        className="size-8 shrink-0 rounded-md object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <span className="min-w-0 truncate font-medium">{k.nazev}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {k.kalorie ?? "?"} kcal · B {k.bilkoviny ?? "?"} · S {k.sacharidy ?? "?"} · T {k.tuky ?? "?"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          {mutaceUloz.isPending ? "Ukládám…" : editovana ? "Uložit změny" : "Přidat do katalogu"}
        </Button>
      </div>
    </Card>
  );
}
