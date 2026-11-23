import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple, Beef, Carrot, Check, Cookie, CupSoda, Milk, Package, Pencil, Plus,
  ScanBarcode, Search, Sparkles, Star, Tag, Trash2, TriangleAlert, Wheat, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Button } from "@/components/ui/Button";
import { Card, CardNadpis } from "@/components/ui/Card";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Nacitani";
import { useAuth } from "@/lib/auth";
import { formatujCenu, formatujKcal, formatujMakro, formatujPlatnostDo, formatujStariCeny } from "@/lib/cena";
import { filtrujKatalog, type RazeniKatalogu } from "@/lib/katalog";
import { cn } from "@/lib/cn";
import { sklonuj } from "@/lib/sklonovani";
import { podporujeSkenovaniKodu, SkenovaniEan } from "@/components/potraviny/SkenovaniEan";
import {
  hledejOpenFoodFactsVice,
  hledejPodleEanLokalne,
  nactiOffPodleEan,
  ALERGEN_NAZVY,
  normalizujEan,
  nactiKatalogPotravin,
  nactiPotravinu,
  pridejPotravinu,
  smazPotravinu,
  upravPotravinu,
  type KatalogPotravina,
  type OffNalezenaPotravina,
} from "@/lib/data/potraviny";
import { efektivniAlergieProfilu, nactiProfil } from "@/lib/data/profil";
import { zapisDoDeniku, type NovaPoznamka } from "@/lib/data/denik";
import { nactiStalice, prepnoutStalici } from "@/lib/data/spiz";
import { obsahujeAlergen } from "@/lib/generator/generator";

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
  napoje: "Nápoje",
  ostatni: "Ostatní",
};

const DIETA_NAZVY: Record<string, string> = {
  vegetariansky: "veg", vegansky: "vegan", bezlepkovy: "bez lepku",
};

const DAVKA_ZOBRAZENI = 100;

const RAZENI_MOZNOSTI: Record<RazeniKatalogu, string> = {
  relevance: "Relevance",
  nazev: "Název A–Z",
  cena: "Nejnižší cena",
  jednotkova: "Nejnižší Kč/kg",
  sleva: "Největší sleva",
  bilkovinyCena: "Nejvíc bílkovin za Kč",
  bilkoviny: "Nejvíc bílkovin / 100 g",
  kcal: "Nejnižší kcal / 100 g",
};

const RAZENI_PLATNA = new Set<string>(Object.keys(RAZENI_MOZNOSTI));

/** Cena buňky: balení ~„25 Kč (400 g)" / vážené „14,90 Kč/kg". */
function cenaLabel(p: KatalogPotravina, cena: number): string {
  const f = formatujCenu(cena, p.baleniG);
  if (f.hlavni === "—") return "—";
  if (p.baleniG && p.baleniG > 0) return `${f.hlavni} (${Math.round(p.baleniG)} g)`;
  return f.hlavni;
}

const KATEGORIE_IKONY: Record<string, typeof Apple> = {
  maso_ryby: Beef,
  mlecne_vyrobky: Milk,
  ovoce_zelenina: Apple,
  peckoviny_obily: Wheat,
  suchary_testoviny: Cookie,
  napoje: CupSoda,
  ostatni: Package,
};

/** Rychlé filtry (čipy) – name/macro-based, žádná data navíc. */
type Cip = "zero" | "protein";
const CIPY: { klic: Cip; nazev: string; plati: (p: KatalogPotravina) => boolean }[] = [
  {
    klic: "zero",
    nazev: "Zero / bez cukru",
    plati: (p) => /zero|bez cukru|sugar\s?free|neochucen/i.test(p.nazev),
  },
  {
    klic: "protein",
    nazev: "High protein",
    plati: (p) => p.bilkoviny >= 15,
  },
];

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
        <span style={{ width: `${podil(kcalB)}%`, backgroundColor: "var(--primary)" }} />
        <span style={{ width: `${podil(kcalS)}%`, backgroundColor: "var(--accent)" }} />
        <span style={{ width: `${podil(kcalT)}%`, backgroundColor: "var(--warning)" }} />
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
  /** gramáž balení – prázdné = vážené zboží (cena se ukazuje za kg) */
  baleni: string;
}

const PRAZDNY_FORM: FormPotravina = {
  nazev: "",
  kategorie: "ostatni",
  kalorie: "",
  bilkoviny: "",
  sacharidy: "",
  tuky: "",
  cena: "",
  baleni: "",
};

export function Potraviny() {
  const { uzivatel } = useAuth();
  const dotaz = useQuery({ queryKey: ["katalog_potravin"], queryFn: nactiKatalogPotravin });
  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });
  const klientQ = useQueryClient();
  const dotazStalice = useQuery({ queryKey: ["stalice"], queryFn: nactiStalice });
  const stalice = dotazStalice.data ?? new Set<string>();
  const mutaceStalice = useMutation({
    mutationFn: (p: { id: string; nazev: string }) => prepnoutStalici(p.id, p.nazev),
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["stalice"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  // stejná ochrana jako v pickeru – dvojklik by přepnutí vrátil zpět
  const naStalici = (p: KatalogPotravina) => {
    if (mutaceStalice.isPending && mutaceStalice.variables?.id === p.id) return;
    mutaceStalice.mutate({ id: p.id, nazev: p.nazev });
  };
  const mojeAlergie = efektivniAlergieProfilu(dotazProfil.data);
  // stav filtrů žije v URL (?dotaz&kategorie&slevy&razeni) – sdílený
  // odkaz, refresh i tlačítko Zpět drží stejný pohled
  const [hledat, setHledat] = useState(
    () => new URLSearchParams(window.location.search).get("dotaz") ?? "",
  );
  const [kategorie, setKategorie] = useState<string>(() => {
    const k = new URLSearchParams(window.location.search).get("kategorie");
    return k !== null && k in KATEGORIE ? k : "vse";
  });
  const [jenSlevy, setJenSlevy] = useState(
    () => new URLSearchParams(window.location.search).get("slevy") === "1",
  );
  // rychlé čipy (Zero / High protein) – doplňkový filtr nad běžnými
  const [cipy, setCipy] = useState<Set<Cip>>(new Set());
  const prepnoutCip = (k: Cip) =>
    setCipy((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  // zobrazení nutric: na 100 g/ml vs. za celé balení
  const [zaBaleni, setZaBaleni] = useState(false);
  const [razeni, setRazeni] = useState<RazeniKatalogu>(() => {
    const r = new URLSearchParams(window.location.search).get("razeni");
    return r !== null && RAZENI_PLATNA.has(r) ? (r as RazeniKatalogu) : "relevance";
  });
  // psaní nereaguje na každý stisk – filtr běží na odložené hodnotě,
  // takže input zůstane plynulý i při filtrování tisíců položek
  const hledatOdlozene = useDeferredValue(hledat);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const nastav = (klic: string, hodnota: string | null) => {
      if (hodnota) p.set(klic, hodnota);
      else p.delete(klic);
    };
    nastav("dotaz", hledatOdlozene.trim() || null);
    nastav("kategorie", kategorie !== "vse" ? kategorie : null);
    nastav("slevy", jenSlevy ? "1" : null);
    nastav("razeni", razeni !== "relevance" ? razeni : null);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [hledatOdlozene, kategorie, jenSlevy, razeni]);
  const [formZobrazen, setFormZobrazen] = useState(false);
  const [editovana, setEditovana] = useState<KatalogPotravina | null>(null);

  const zavriForm = () => {
    setFormZobrazen(false);
    setEditovana(null);
  };

  const potraviny = dotaz.data ?? [];
  const pocetSlev = useMemo(() => potraviny.filter((p) => p.sleva).length, [potraviny]);
  const filtrovane = useMemo(() => {
    let vysledek = filtrujKatalog(potraviny, hledatOdlozene, kategorie, jenSlevy, razeni);
    for (const c of CIPY) {
      if (cipy.has(c.klic)) vysledek = vysledek.filter(c.plati);
    }
    return vysledek;
  }, [potraviny, hledatOdlozene, kategorie, jenSlevy, razeni, cipy]);
  // velký katalog se vykresluje po dávkách – tisíce DOM uzlů naráz
  // by zabily mobil; filtr resetuje limit na první dávku
  const [limitZobrazeni, setLimitZobrazeni] = useState(DAVKA_ZOBRAZENI);
  useEffect(
    () => setLimitZobrazeni(DAVKA_ZOBRAZENI),
    [hledatOdlozene, kategorie, jenSlevy, razeni, cipy],
  );
  const zobrazeno = filtrovane.slice(0, limitZobrazeni);
  const zbyva = filtrovane.length - zobrazeno.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Katalog potravin</h1>
          <p className="mt-1 text-sm text-muted">
            {dotaz.isLoading
              ? "Načítám…"
              : `${potraviny.length.toLocaleString("cs-CZ")} ${sklonuj(potraviny.length, "potravina", "potraviny", "potravin")} v katalogu. Generátor je používá automaticky.`}
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
        <button
          type="button"
          onClick={() => setJenSlevy((s) => !s)}
          aria-pressed={jenSlevy}
          className={
            jenSlevy
              ? "inline-flex h-10 items-center gap-1.5 rounded-lg border border-accent bg-accent px-3 text-sm font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-primary"
              : "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          }
        >
          <Tag className="size-4" />
          Ve slevě{pocetSlev > 0 ? ` (${pocetSlev})` : ""}
        </button>
        <Select
          value={razeni}
          onChange={(e) => setRazeni(e.target.value as RazeniKatalogu)}
          aria-label="Seřadit katalog"
          className="w-auto min-w-44"
        >
          {Object.entries(RAZENI_MOZNOSTI).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        {CIPY.map((c) => {
          const aktivni = cipy.has(c.klic);
          return (
            <button
              key={c.klic}
              type="button"
              onClick={() => prepnoutCip(c.klic)}
              aria-pressed={aktivni}
              className={
                aktivni
                  ? "inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  : "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:border-primary/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
              }
            >
              {aktivni && <Check className="size-4" aria-hidden />}
              {c.nazev}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setZaBaleni((z) => !z)}
          aria-pressed={zaBaleni}
          title="Přepnout zobrazení nutric za celé balení"
          className={
            zaBaleni
              ? "inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
              : "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:border-primary/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          }
        >
          <Package className="size-4" aria-hidden />
          Za balení
        </button>
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
          zobrazeno.map((p) => (
            <KartaPotraviny
              key={p.id}
              p={p}
              uzivatelId={uzivatel?.id ?? null}
              mojeAlergie={mojeAlergie}
              pripnuta={stalice.has(p.id)}
              naStalici={() => naStalici(p)}
              naUpravu={() => {
                setEditovana(p);
                setFormZobrazen(true);
              }}
              zaBaleni={zaBaleni}
            />
          ))}
        {!dotaz.isLoading && filtrovane.length === 0 && (
          <PrazdnyStav
            onReset={() => {
              setHledat("");
              setKategorie("vse");
              setJenSlevy(false);
              setRazeni("relevance");
            }}
          />
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
            {zobrazeno.map((p) => (
              <RadekPotraviny
                key={p.id}
                p={p}
                uzivatelId={uzivatel?.id ?? null}
                mojeAlergie={mojeAlergie}
                pripnuta={stalice.has(p.id)}
                naStalici={() => naStalici(p)}
                naUpravu={() => {
                  setEditovana(p);
                  setFormZobrazen(true);
                }}
                zaBaleni={zaBaleni}
              />
            ))}
            {!dotaz.isLoading && filtrovane.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <PrazdnyStav
                    onReset={() => {
                      setHledat("");
                      setKategorie("vse");
                      setJenSlevy(false);
                      setRazeni("relevance");
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {zbyva > 0 && (
        <div className="flex justify-center">
          <Button varianta="outline" onClick={() => setLimitZobrazeni((l) => l + DAVKA_ZOBRAZENI)}>
            Zobrazit další – zbývá {zbyva.toLocaleString("cs-CZ")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Prázdný stav katalogu s resetem filtrů – jednotný pro kartu i tabulku. */
function PrazdnyStav({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-8 text-center text-muted">
      <Carrot className="mx-auto mb-2 size-6" />
      <p>Žádné produkty neodpovídají filtru.</p>
      <Button varianta="outline" velikost="sm" className="mt-3" onClick={onReset}>
        Resetovat filtry
      </Button>
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
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        title="Upravit vlastní potravinu"
        aria-label={`Upravit ${p.nazev}`}
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setPotvrdit(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
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

/** Alergeny potraviny – rozlišuje „obsahuje" (ingredience) od
 *  „může obsahovat stopy" (OFF traces_tags). Kolize s uživatelovou
 *  alergií se ukáže jako varování; stopová kolize dostane jemnější
 *  text, ale varuje taky – pro alergika je informace relevantní. */
function AlergenInfo({
  p,
  shoda,
  className = "",
}: {
  p: KatalogPotravina;
  shoda: string[];
  className?: string;
}) {
  const stopySet = new Set(p.alergenyStopy ?? []);
  const nazvy = (a: string) => ALERGEN_NAZVY[a] ?? a;
  const obsahShoda = shoda.filter((a) => !stopySet.has(a));
  const stopyShoda = shoda.filter((a) => stopySet.has(a));
  const obsah = (p.alergeny ?? []).filter((a) => !stopySet.has(a));
  const stopy = [...stopySet];
  return (
    <>
      {obsahShoda.length > 0 && (
        <span className={`block text-xs font-semibold text-danger ${className}`}>
          <TriangleAlert className="mr-1 inline size-3" aria-hidden />
          obsahuje váš alergen: {obsahShoda.map(nazvy).join(", ")}
        </span>
      )}
      {stopyShoda.length > 0 && (
        <span className={`block text-xs font-semibold text-warning ${className}`}>
          <TriangleAlert className="mr-1 inline size-3" aria-hidden />
          může obsahovat stopy vašeho alergenu: {stopyShoda.map(nazvy).join(", ")}
        </span>
      )}
      {shoda.length === 0 && obsah.length > 0 && (
        <span className={`block text-xs text-muted ${className}`}>
          alergeny: {obsah.map(nazvy).join(", ")}
        </span>
      )}
      {shoda.length === 0 && stopy.length > 0 && (
        <span className={`block text-xs text-muted ${className}`}>
          může obsahovat stopy: {stopy.map(nazvy).join(", ")}
        </span>
      )}
    </>
  );
}

function TlacitkoStalice({
  pripnuta,
  naStalici,
  nazev,
}: {
  pripnuta: boolean;
  naStalici: () => void;
  nazev: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        naStalici();
      }}
      className={cn(
        "mr-1.5 inline-flex size-11 -translate-y-0.5 items-center justify-center align-middle transition-colors",
        pripnuta ? "text-accent" : "text-muted hover:text-accent",
      )}
      title={pripnuta ? "Odepnout ze stálic" : "Připnout do stálic"}
      aria-label={pripnuta ? `Odepnout ${nazev} ze stálic` : `Připnout ${nazev} do stálic`}
      aria-pressed={pripnuta}
    >
      <Star className={cn("size-4", pripnuta && "fill-accent")} aria-hidden />
    </button>
  );
}

function RadekPotraviny({
  p,
  uzivatelId,
  mojeAlergie = [],
  pripnuta = false,
  naStalici,
  naUpravu,
  zaBaleni = false,
}: {
  p: KatalogPotravina;
  uzivatelId: string | null;
  mojeAlergie?: string[];
  pripnuta?: boolean;
  naStalici?: () => void;
  naUpravu: () => void;
  zaBaleni?: boolean;
}) {
  const vlastni = uzivatelId !== null && p.vytvoril === uzivatelId;
  const shoda = mojeAlergie.filter((a) => obsahujeAlergen(p, a));
  // „Za balení“ režim – makra násobíme baleniG/100 (jen když gramáž existuje)
  const faktor = zaBaleni && p.baleniG && p.baleniG > 0 ? p.baleniG / 100 : 1;

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
      <td className="px-4 py-2.5">
        <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-8" inline />
        {naStalici !== undefined && (
          <TlacitkoStalice pripnuta={pripnuta} naStalici={naStalici} nazev={p.nazev} />
        )}
        <span className="font-medium">{p.nazev}</span>
        <span className="ml-2 inline-flex gap-1">
          {p.sleva && (
            <Badge tono="accent">
              {p.slevaProcenta != null ? `−${p.slevaProcenta} %` : "Sleva"}
              {p.obchod ? ` · ${p.obchod}` : ""}
              {formatujPlatnostDo(p.platnostDo)
                ? ` · ${formatujPlatnostDo(p.platnostDo)}`
                : ""}
            </Badge>
          )}
          {vlastni && <Badge tono="primary">Vlastní</Badge>}
          {p.kalorie <= 0 && <Badge tono="neutral">bez nutric</Badge>}
          {(p.diety ?? []).map((d) => (
            <Badge key={d} tono="ok">{DIETA_NAZVY[d] ?? d}</Badge>
          ))}
        </span>
        {p.baleniG != null && p.baleniG > 0 && (
          <span className="block text-xs text-muted">
            {p.baleniLabel ?? "Balení"} {formatujMakro(p.baleniG)} g
          </span>
        )}
        <AlergenInfo p={p} shoda={shoda} />
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
      {/* eshopové položky bez nutric (kalorie=0) – nulová hodnota by lživě */}
      {/* tvrdila „0 kcal", proto neutrální „bez údajů" */}
      <td className="px-4 py-2.5 text-right tabular-nums">
        {p.kalorie > 0 ? formatujKcal(p.kalorie * faktor) : <span className="text-muted">bez údajů</span>}
        {zaBaleni && faktor !== 1 && (
          <span className="block text-[10px] font-normal text-muted">za balení</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.kalorie > 0 ? formatujMakro(p.bilkoviny * faktor) : "–"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.kalorie > 0 ? formatujMakro(p.sacharidy * faktor) : "–"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{p.kalorie > 0 ? formatujMakro(p.tuky * faktor) : "–"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {cenaLabel(p, p.aktualniCena)}
        {p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena && (
          <span className="ml-1 text-xs text-muted line-through">
            {cenaLabel(p, p.puvodniCena)}
          </span>
        )}
        {(() => {
          // bez pozorování ukazuje aktualniCena jen typickou (bezna_cena)
          // – poctivě odlišit od živé ceny obchodu
          const podtitulek = [
            p.obchod && !p.sleva ? p.obchod : null,
            formatujStariCeny(p.pozorovanoAt) ??
              (p.pozorovanoAt == null && p.aktualniCena > 0 ? "typická cena" : null),
          ]
            .filter(Boolean)
            .join(" · ");
          return podtitulek ? (
            <span className="block text-xs font-normal text-muted">{podtitulek}</span>
          ) : null;
        })()}
      </td>
      {uzivatelId !== null && (
        <td className="px-4 py-2.5 text-right">
          <span className="inline-flex items-center">
            <TlacitkoRychlyZapis p={p} />
            {vlastni && <AkcePotraviny p={p} naUpravu={naUpravu} />}
          </span>
        </td>
      )}
    </tr>
  );
}

/** Karta potraviny pro mobil – stejné informace jako řádek tabulky. */
function KartaPotraviny({
  p,
  uzivatelId,
  mojeAlergie = [],
  pripnuta = false,
  naStalici,
  naUpravu,
  zaBaleni = false,
}: {
  p: KatalogPotravina;
  uzivatelId: string | null;
  mojeAlergie?: string[];
  pripnuta?: boolean;
  naStalici?: () => void;
  naUpravu: () => void;
  zaBaleni?: boolean;
}) {
  const vlastni = uzivatelId !== null && p.vytvoril === uzivatelId;
  const shoda = mojeAlergie.filter((a) => obsahujeAlergen(p, a));
  const Ikona = KATEGORIE_IKONY[p.kategorie ?? "ostatni"] ?? Package;
  const faktor = zaBaleni && p.baleniG && p.baleniG > 0 ? p.baleniG / 100 : 1;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-12" ikona={Ikona} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-medium leading-snug">
              {naStalici !== undefined && (
                <TlacitkoStalice pripnuta={pripnuta} naStalici={naStalici} nazev={p.nazev} />
              )}
              {p.nazev}
            </p>
            {vlastni && (
              <span className="flex shrink-0">
                <AkcePotraviny p={p} naUpravu={naUpravu} />
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
            <Ikona className="size-3" aria-hidden />
            {KATEGORIE[p.kategorie ?? "ostatni"] ?? p.kategorie}
            {p.sleva && (
              <Badge tono="accent">
                {p.slevaProcenta != null ? `−${p.slevaProcenta} %` : "Sleva"}
                {p.obchod ? ` · ${p.obchod}` : ""}
                {formatujPlatnostDo(p.platnostDo)
                  ? ` · ${formatujPlatnostDo(p.platnostDo)}`
                  : ""}
              </Badge>
            )}
            {vlastni && <Badge tono="primary">Vlastní</Badge>}
            {p.kalorie <= 0 && <Badge tono="neutral">bez nutric</Badge>}
            {(p.diety ?? []).map((d) => (
              <Badge key={d} tono="ok">{DIETA_NAZVY[d] ?? d}</Badge>
            ))}
          </p>
          {p.baleniG != null && p.baleniG > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              {p.baleniLabel ?? "Balení"} {formatujMakro(p.baleniG)} g
            </p>
          )}
          <AlergenInfo p={p} shoda={shoda} className="mt-0.5" />
          <PasekMakro p={p} />
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="tabular-nums text-muted">
              {p.kalorie > 0
                ? `${formatujKcal(p.kalorie * faktor)} kcal · B ${formatujMakro(p.bilkoviny * faktor)} · S ${formatujMakro(p.sacharidy * faktor)} · T ${formatujMakro(p.tuky * faktor)}${zaBaleni && faktor !== 1 ? " · za balení" : ""}`
                : "bez nutričních údajů"}
            </span>
            <span className="tabular-nums font-semibold">
              {cenaLabel(p, p.aktualniCena)}
              {p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena && (
                <span className="ml-1 text-xs font-normal text-muted line-through">
                  {cenaLabel(p, p.puvodniCena)}
                </span>
              )}
              {(() => {
                const podtitulek = [
                  p.obchod && !p.sleva ? p.obchod : null,
                  formatujStariCeny(p.pozorovanoAt) ??
                    (p.pozorovanoAt == null && p.aktualniCena > 0 ? "typická cena" : null),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return podtitulek ? (
                  <span className="block text-xs font-normal text-muted">{podtitulek}</span>
                ) : null;
              })()}
            </span>
          </div>
          {uzivatelId !== null && (
            <div className="mt-2 flex justify-end">
              <TlacitkoRychlyZapis p={p} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Rychlý zápis do dnešního deníku přímo z katalogu – „+ Dnes“ rozbalí
 *  volbu množství (g/ml nebo × balení) a zapíše jako „Ostatní“. */
function TlacitkoRychlyZapis({ p }: { p: KatalogPotravina }) {
  const klient = useQueryClient();
  const [otevreno, setOtevreno] = useState(false);
  const maBaleni = p.baleniG != null && p.baleniG > 0;
  const [jednotka, setJednotka] = useState<"g" | "baleni">(maBaleni ? "baleni" : "g");
  const [pocet, setPocet] = useState("1");
  const [gramy, setGramy] = useState("100");

  const mutace = useMutation({
    mutationFn: () => {
      const n = Number(jednotka === "baleni" ? pocet : gramy);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Zadejte množství větší než 0.");
      const mnozstviG = jednotka === "baleni" && maBaleni
        ? Math.round(n * p.baleniG!)
        : Math.round(n);
      const d = new Date();
      const datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cas = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const poznamka: NovaPoznamka = {
        foodId: p.id,
        nazev: p.nazev,
        obrazek: p.obrazek ?? null,
        mnozstviG: Math.min(10000, Math.max(1, mnozstviG)),
        kalorie: p.kalorie,
        bilkoviny: p.bilkoviny,
        sacharidy: p.sacharidy,
        tuky: p.tuky,
      };
      return zapisDoDeniku("ostatni", datum, cas, [poznamka]);
    },
    onSuccess: () => {
      toast.success(`„${p.nazev}" zapsáno do dnešního deníku.`);
      setOtevreno(false);
      void klient.invalidateQueries({ queryKey: ["denik"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Zápis selhal."),
  });

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary"
        title={`Přidat ${p.nazev} do dnešního deníku`}
        aria-label={`Přidat ${p.nazev} do dnešního deníku`}
      >
        <Plus className="size-4" />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-1">
      <input
        type="number"
        min={0.25}
        step={jednotka === "baleni" ? 0.5 : 1}
        inputMode="decimal"
        value={jednotka === "baleni" ? pocet : gramy}
        onChange={(e) =>
          jednotka === "baleni" ? setPocet(e.target.value) : setGramy(e.target.value)
        }
        aria-label="Množství"
        className="h-8 w-14 rounded-md border border-border bg-bg px-1.5 text-xs tabular-nums text-fg focus:outline-2 focus:outline-primary"
      />
      <select
        value={jednotka}
        onChange={(e) => setJednotka(e.target.value as "g" | "baleni")}
        aria-label="Jednotka"
        className="h-8 rounded-md border border-border bg-bg px-1 text-xs text-fg focus:outline-2 focus:outline-primary"
      >
        <option value="g">g/ml</option>
        {maBaleni && (
          <option value="baleni">
            × {(p.baleniLabel ?? "balení").toLowerCase()}
          </option>
        )}
      </select>
      <button
        type="button"
        onClick={() => mutace.mutate()}
        disabled={mutace.isPending}
        className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-ink disabled:opacity-50"
        aria-label="Zapsat do deníku"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setOtevreno(false)}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-fg"
        aria-label="Zavřít rychlý zápis"
      >
        <X className="size-4" />
      </button>
    </span>
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
          baleni: editovana.baleniG != null ? String(editovana.baleniG) : "",
        }
      : PRAZDNY_FORM,
  );
  const [hledaOff, setHledaOff] = useState(false);
  const [ean, setEan] = useState("");
  const [skenovani, setSkenovani] = useState(false);
  const [offKandidati, setOffKandidati] = useState<OffNalezenaPotravina[]>([]);
  // undefined = nebylo dohledáno (u editace ponechat stávající obrázek)
  const [obrazek, setObrazek] = useState<string | null | undefined>(undefined);
  // tagy dohledané z OFF – ukládat jen když je OFF skutečně vrátilo
  const [offTagy, setOffTagy] = useState<{ alergeny: string[]; stopy: string[]; diety: string[] } | null>(null);

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
        // prázdné balení = vážené zboží (baleni_g = null)
        baleniG: f.baleni.trim() === "" ? null : cislo(f.baleni, "Balení", 50000),
        ean: normalizujEan(ean),
        ...(obrazek !== undefined ? { obrazek } : {}),
        ...(offTagy ?? {}),
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
    setOffTagy(
      nalezena.alergeny.length > 0 || nalezena.stopy.length > 0 || nalezena.diety.length > 0
        ? { alergeny: nalezena.alergeny, stopy: nalezena.stopy, diety: nalezena.diety }
        : null,
    );
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
      setOffTagy(
        nalezena.alergeny.length > 0 || nalezena.stopy.length > 0 || nalezena.diety.length > 0
          ? { alergeny: nalezena.alergeny, stopy: nalezena.stopy, diety: nalezena.diety }
          : null,
      );
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
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
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
                    <MiniaturaPotraviny obrazek={k.obrazek} velikost="size-8" />
                    <span className="min-w-0 truncate font-medium">{k.nazev}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {k.kalorie != null ? formatujKcal(k.kalorie) : "?"} kcal · B {k.bilkoviny != null ? formatujMakro(k.bilkoviny) : "?"} · S {k.sacharidy != null ? formatujMakro(k.sacharidy) : "?"} · T {k.tuky != null ? formatujMakro(k.tuky) : "?"}
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
          <Label htmlFor="pBaleni">Balení (g)</Label>
          <Input
            id="pBaleni"
            inputMode="decimal"
            value={f.baleni}
            onChange={(e) => uprav("baleni", e.target.value)}
            placeholder="Např. 400 – prázdné = vážené"
          />
          <p className="mt-1 text-xs text-muted">Balené zboží ukáže cenu za balení; prázdné = cena za kg.</p>
        </div>
        <div>
          <Label htmlFor="pKcal">Kalorie (kcal/100 g)</Label>
          <Input id="pKcal" inputMode="decimal" value={f.kalorie} onChange={(e) => uprav("kalorie", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
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
