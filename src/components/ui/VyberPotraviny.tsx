import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple, Barcode, Beef, ChevronDown, Cookie, Milk, Package, Plus,
  Search, Star, Tag, History, TriangleAlert, Wheat, X,
} from "lucide-react";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { podporujeSkenovaniKodu, SkenovaniEan } from "@/components/potraviny/SkenovaniEan";
import { ALERGEN_NAZVY, hledejPodleEanLokalne, hledejPotravinyTrigram } from "@/lib/data/potraviny";
import { nactiStalice, prepnoutStalici } from "@/lib/data/spiz";
import { obsahujeAlergen } from "@/lib/generator/generator";
import { formatujCenu, formatujKcal, formatujPlatnostDo, formatujStariCeny } from "@/lib/cena";
import { bezDiakritiky, skoreShody } from "@/lib/vyhledavani";
import { cn } from "@/lib/cn";

/**
 * „Košík picker“ – výběr potraviny ve stylu českého e-shopu
 * s potravinami. Fullscreen sheet na mobilu, centrovaný modal
 * na desktopu. Režimy: procházení (sekcí Ve slevě / Nedávné /
 * Všechny) a hledání (dotaz / kategorie / EAN sken).
 */

export interface PolozkaVyberu {
  id: string;
  nazev: string;
  kalorie: number;
  /** makra na 100 g – naplňuje se tam, kde je zdroj KatalogPotravina (deník) */
  bilkoviny?: number;
  sacharidy?: number;
  tuky?: number;
  aktualniCena: number;
  sleva: boolean;
  /** % slevy – badge ukazuje „−30 %“ místo holého SLEVA */
  slevaProcenta?: number | null;
  /** poslední den akce (ISO) – „do út 18. 11.“ */
  platnostDo?: string | null;
  /** stáří cenového pozorování – starší cena se ukáže jako „z 18. 11." */
  pozorovanoAt?: string | null;
  kategorie?: string;
  obrazek?: string | null;
  /** hmotnost balení v g – známe-li ji, ukážeme cenu za balení */
  baleniG?: number | null;
  /** popisek balení (Balení|Plechovka|Láhev|Kelímek|Kus|Sáček|Krabice) */
  baleniLabel?: string | null;
  /** alergenové tagy – s mojeAlergie prop ukážeme varování */
  alergeny?: string[];
  /** podmnožina alergeny = jen stopy („může obsahovat") – varujeme jemněji */
  alergenyStopy?: string[];
}

const norm = bezDiakritiky;

const MAX_VYSLEDKU = 80;
const LS_NEDAVNE = "om-vyber-nedavne";

const KATEGORIE_VYBER: Record<string, { nazev: string; ikona: typeof Package }> = {
  mlecne_vyrobky: { nazev: "Mléčné", ikona: Milk },
  maso_ryby: { nazev: "Maso a ryby", ikona: Beef },
  peckoviny_obily: { nazev: "Pečivo", ikona: Wheat },
  ovoce_zelenina: { nazev: "Ovoce a zelenina", ikona: Apple },
  suchary_testoviny: { nazev: "Suchary a těstoviny", ikona: Cookie },
  ostatni: { nazev: "Ostatní", ikona: Package },
};

function nactiNedavne(): string[] {
  try {
    const raw = localStorage.getItem(LS_NEDAVNE);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ulozNedavne(id: string) {
  try {
    const ids = [id, ...nactiNedavne().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(LS_NEDAVNE, JSON.stringify(ids));
  } catch {
    /* soukromý režim – nedávné jen nefungují */
  }
}

export function VyberPotraviny({
  potraviny,
  hodnota,
  onZmena,
  chyba = false,
  ariaLabel,
  mojeAlergie = [],
  otevrenoVnejsi,
  naOtevrenoZmena,
  bezTlacitka = false,
}: {
  potraviny: PolozkaVyberu[];
  hodnota: string;
  onZmena: (id: string) => void;
  chyba?: boolean;
  ariaLabel?: string;
  /** efektivní alergeny uživatele – řádek s kolizí dostane varování */
  mojeAlergie?: string[];
  /** řízený režim – dialog otevírá/zavírá volající (rychlý zápis) */
  otevrenoVnejsi?: boolean;
  naOtevrenoZmena?: (o: boolean) => void;
  /** bez vlastního trigger tlačítka – jen dialog (řízený režim) */
  bezTlacitka?: boolean;
}) {
  const [otevrenoVnitrni, setOtevrenoVnitrni] = useState(false);
  const otevreno = otevrenoVnejsi ?? otevrenoVnitrni;
  const setOtevreno = (o: boolean) => {
    setOtevrenoVnitrni(o);
    naOtevrenoZmena?.(o);
  };
  const [dotaz, setDotaz] = useState("");
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [skenuje, setSkenuje] = useState(false);
  const [nedavneIds, setNedavneIds] = useState<string[]>([]);
  const klientQ = useQueryClient();
  // stálice – picker si data nese sám, volající nemusí propásovat
  const dotazStalice = useQuery({ queryKey: ["stalice"], queryFn: nactiStalice });
  const stalice = dotazStalice.data ?? new Set<string>();
  const mutStalice = useMutation({
    mutationFn: (p: PolozkaVyberu) => prepnoutStalici(p.id, p.nazev),
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["stalice"] }),
    onError: () => toast.error("Stálici se nepodařilo uložit."),
  });
  // dvojklik na hvězdičku by přepnul stálici dvakrát a záměr se ztratil –
  // dokud běží přepnutí téže položky, další klepnutí ignorujeme
  const pinuj = (p: PolozkaVyberu) => {
    if (mutStalice.isPending && mutStalice.variables?.id === p.id) return;
    mutStalice.mutate(p);
  };

  const vybrana = useMemo(
    () => potraviny.find((p) => p.id === hodnota) ?? null,
    [potraviny, hodnota],
  );

  const mapa = useMemo(() => new Map(potraviny.map((p) => [p.id, p])), [potraviny]);
  const hleda = dotaz.trim() !== "" || kategorie !== null;

  // odložený dotaz – filtrace velkého katalogu neblokuje psaní
  const dotazOdlozeny = useDeferredValue(dotaz);

  // serverové trigramové hledání (pg_trgm+unaccent) – debounce 250 ms,
  // doběhne po lokálním instantním filtru a doplní zásahy z celého katalogu
  const [dotazServer, setDotazServer] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDotazServer(dotaz.trim()), 250);
    return () => clearTimeout(t);
  }, [dotaz]);
  const dotazTrigram = useQuery({
    queryKey: ["trigram-hledani", dotazServer],
    queryFn: () => hledejPotravinyTrigram(dotazServer, 20),
    enabled: dotazServer.length >= 2,
    staleTime: 60_000,
    retry: 1,
  });

  const filtrovane = useMemo(() => {
    const d = norm(dotazOdlozeny.trim());
    const vybrane = potraviny.filter(
      (p) =>
        (kategorie === null || p.kategorie === kategorie) &&
        (d === "" || norm(p.nazev).includes(d)),
    );
    if (d !== "") {
      // relevance: prefix > začátek slova > podřetězec – Enter vždy
      // vybere nejrelevantnější výsledek (filtrovane[0])
      vybrane.sort(
        (a, b) => skoreShody(norm(b.nazev), d) - skoreShody(norm(a.nazev), d),
      );
    }
    return vybrane.slice(0, MAX_VYSLEDKU);
  }, [potraviny, dotazOdlozeny, kategorie]);

  const pocetVysledku = useMemo(() => {
    const d = norm(dotazOdlozeny.trim());
    return potraviny.filter(
      (p) =>
        (kategorie === null || p.kategorie === kategorie) &&
        (d === "" || norm(p.nazev).includes(d)),
    ).length;
  }, [potraviny, dotazOdlozeny, kategorie]);

  // serverové zásahy, které lokální preload neobsahuje – katalog roste
  // přes OFF import a do klienta se už nemusí vejít celý
  const serverExtra = useMemo<PolozkaVyberu[]>(() => {
    if (!dotazTrigram.data) return [];
    const lokalniIds = new Set(potraviny.map((p) => p.id));
    return dotazTrigram.data
      .filter((r) => !lokalniIds.has(r.foodId))
      .filter((r) => kategorie === null || r.kategorie === kategorie)
      .map((r) => ({
        id: r.foodId,
        nazev: r.znacka ? `${r.nazev} (${r.znacka})` : r.nazev,
        kalorie: r.kalorie,
        bilkoviny: r.bilkoviny,
        sacharidy: r.sacharidy,
        tuky: r.tuky,
        aktualniCena: 0,
        sleva: false,
        kategorie: r.kategorie,
        baleniG: r.baleniG,
        baleniLabel: r.baleniLabel,
      }));
  }, [dotazTrigram.data, potraviny, kategorie]);

  // finální pořadí: serverové trigramové řazení je hlavní signál relevance
  // (fuzzy shoda i přes překlepy a pořadí slov), lokální filtr doplní zbytek
  // a poslouží jako instantní fallback, než server doběhne
  const zobrazene = useMemo(() => {
    const servery = dotazTrigram.data;
    if (!servery || dotazServer !== dotaz.trim()) return filtrovane;
    const serverIds = new Set(servery.map((r) => r.foodId));
    const nejprve = servery
      .map((r) => mapa.get(r.foodId))
      .filter((p): p is PolozkaVyberu => p !== undefined)
      .filter((p) => kategorie === null || p.kategorie === kategorie);
    const zbytek = filtrovane.filter((p) => !serverIds.has(p.id));
    return [...nejprve, ...zbytek].slice(0, MAX_VYSLEDKU);
  }, [dotazTrigram.data, dotazServer, dotaz, filtrovane, mapa, kategorie]);

  const veSleve = useMemo(() => potraviny.filter((p) => p.sleva).slice(0, 10), [potraviny]);
  const nedavne = useMemo(
    () => nedavneIds.map((id) => mapa.get(id)).filter((p): p is PolozkaVyberu => p !== undefined),
    [nedavneIds, mapa],
  );

  // zámek posouvání pozadí + Escape zavře
  useEffect(() => {
    if (!otevreno) return;
    const stary = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtevreno(false);
    };
    document.addEventListener("keydown", naKlavesu);
    return () => {
      document.documentElement.style.overflow = stary;
      document.removeEventListener("keydown", naKlavesu);
    };
  }, [otevreno]);

  const otevri = () => {
    setDotaz("");
    setKategorie(null);
    setSkenuje(false);
    setNedavneIds(nactiNedavne());
    setOtevreno(true);
  };

  // řízené otevření – vyčistit dotaz/filtry jako při otevri()
  useEffect(() => {
    if (otevrenoVnejsi) {
      setDotaz("");
      setKategorie(null);
      setSkenuje(false);
      setNedavneIds(nactiNedavne());
    }
  }, [otevrenoVnejsi]);

  const vyber = (id: string) => {
    ulozNedavne(id);
    onZmena(id);
    setOtevreno(false);
  };

  const naKod = async (kod: string) => {
    setSkenuje(false);
    try {
      const hit = await hledejPodleEanLokalne(kod.replace(/\s+/g, ""));
      if (hit) {
        vyber(hit.id);
        toast.success(`Nalezeno: ${hit.nazev}`);
      } else {
        toast.error("Tento kód v katalogu není – zkuste hledat názvem.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hledání podle kódu selhalo.");
    }
  };

  return (
    <>
      {!bezTlacitka && (
      <button
        type="button"
        onClick={otevri}
        aria-label={ariaLabel ?? "Vybrat potravinu"}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-surface px-2 text-left text-sm text-fg focus:outline-2 focus:outline-primary",
          chyba ? "border-danger" : "border-border",
        )}
      >
        {vybrana ? (
          <>
            <MiniaturaPotraviny obrazek={vybrana.obrazek} velikost="size-7" />
            <span className="min-w-0 flex-1 truncate">{vybrana.nazev}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {formatujCenu(vybrana.aktualniCena, vybrana.baleniG).hlavni}
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted">— potravina —</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
      )}

      {otevreno && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg sm:bg-black/55 sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Výběr potraviny"
        >
          <button
            type="button"
            aria-label="Zavřít výběr"
            onClick={() => setOtevreno(false)}
            className="absolute inset-0 hidden cursor-default sm:block"
            tabIndex={-1}
          />
          <div className="relative flex min-h-0 flex-1 flex-col bg-bg sm:mx-auto sm:my-[5dvh] sm:max-h-[90dvh] sm:w-full sm:max-w-xl sm:rounded-3xl sm:border sm:border-border sm:shadow-2xl">
            {/* hlavička */}
            <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                aria-label="Zavřít výběr"
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="om-display truncate text-lg font-bold">Přidat surovinu</h2>
                <p className="truncate text-xs text-muted">
                  {potraviny.length.toLocaleString("cs-CZ")} potravin v katalogu
                </p>
              </div>
              {podporujeSkenovaniKodu() && (
                <button
                  type="button"
                  onClick={() => setSkenuje((s) => !s)}
                  aria-label="Naskenovat čárový kód"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full border transition-colors",
                    skenuje
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Barcode className="size-5" />
                </button>
              )}
            </div>

            {/* hledání */}
            <div className="px-4 pt-3 sm:px-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={dotaz}
                  onChange={(e) => setDotaz(e.target.value)}
                  onKeyDown={(e) => {
                    const prvni = zobrazene[0] ?? serverExtra[0];
                    if (e.key === "Enter" && prvni) {
                      e.preventDefault();
                      vyber(prvni.id);
                    }
                  }}
                  placeholder="Hledat potravinu…"
                  aria-label="Hledat potravinu"
                  className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
                />
              </div>
            </div>

            {/* kategorie */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:px-5" role="group" aria-label="Filtrovat podle kategorie">
              <Filtr
                aktivni={kategorie === null}
                onClick={() => setKategorie(null)}
              >
                Vše
              </Filtr>
              {Object.entries(KATEGORIE_VYBER).map(([k, { nazev, ikona: Ikona }]) => (
                <Filtr
                  key={k}
                  aktivni={kategorie === k}
                  onClick={() => setKategorie(kategorie === k ? null : k)}
                >
                  <Ikona className="size-3.5" /> {nazev}
                </Filtr>
              ))}
            </div>

            {/* obsah */}
            {skenuje ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-5">
                <SkenovaniEan naKod={naKod} naZavreni={() => setSkenuje(false)} />
              </div>
            ) : hleda ? (
              /* výsledky hledání / filtru */
              <div className="flex min-h-0 flex-1 flex-col">
                <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 sm:px-3">
                  {zobrazene.map((p) => (
                    <Radek key={p.id} p={p} aktivni={p.id === hodnota} onVyber={vyber} mojeAlergie={mojeAlergie} pripnuta={stalice.has(p.id)} onPin={pinuj} />
                  ))}
                  {serverExtra.length > 0 && (
                    <>
                      <li className="px-4 pb-1 pt-3 text-xs font-semibold text-muted">
                        Další z celého katalogu
                      </li>
                      {serverExtra.map((p) => (
                        <Radek key={p.id} p={p} aktivni={p.id === hodnota} onVyber={vyber} mojeAlergie={mojeAlergie} pripnuta={stalice.has(p.id)} onPin={pinuj} />
                      ))}
                    </>
                  )}
                  {zobrazene.length === 0 && serverExtra.length === 0 && (
                    <li className="px-4 py-10 text-center text-sm text-muted">
                      Nic nenalezeno – zkuste jiný dotaz.
                    </li>
                  )}
                </ul>
                <p className="shrink-0 border-t border-border/50 px-4 py-2 text-center text-[11px] text-muted">
                  {pocetVysledku.toLocaleString("cs-CZ")}{" "}
                  {pocetVysledku === 1 ? "výsledek" : pocetVysledku >= 2 && pocetVysledku <= 4 ? "výsledky" : "výsledků"}
                  {pocetVysledku > MAX_VYSLEDKU && ` – zobrazeno prvních ${MAX_VYSLEDKU}`}
                </p>
              </div>
            ) : (
              /* procházení – sekce */
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-6 pt-2">
                {veSleve.length > 0 && (
                  <section>
                    <SekceNadpis ikona={Tag}>Dnes ve slevě</SekceNadpis>
                    <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-5">
                      {veSleve.map((p) => (
                        <KartaPotraviny key={p.id} p={p} onVyber={vyber} pripnuta={stalice.has(p.id)} onPin={pinuj} />
                      ))}
                    </div>
                  </section>
                )}
                {nedavne.length > 0 && (
                  <section>
                    <SekceNadpis ikona={History}>Naposledy přidané</SekceNadpis>
                    <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-5">
                      {nedavne.map((p) => (
                        <KartaPotraviny key={p.id} p={p} onVyber={vyber} pripnuta={stalice.has(p.id)} onPin={pinuj} />
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <SekceNadpis ikona={Package}>Všechny potraviny</SekceNadpis>
                  <ul role="listbox" className="px-2 sm:px-3">
                    {potraviny.slice(0, MAX_VYSLEDKU).map((p) => (
                      <Radek key={p.id} p={p} aktivni={p.id === hodnota} onVyber={vyber} mojeAlergie={mojeAlergie} pripnuta={stalice.has(p.id)} onPin={pinuj} />
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- pomocné ---------------- */

function Filtr({
  aktivni,
  onClick,
  children,
}: {
  aktivni: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktivni}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        aktivni
          ? "border-primary bg-primary text-primary-fg"
          : "border-border bg-surface text-muted hover:border-primary/50 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function SekceNadpis({
  ikona: Ikona,
  children,
}: {
  ikona: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 px-4 text-xs font-semibold text-muted sm:px-5">
      <Ikona className="size-3.5" /> {children}
    </h3>
  );
}

/** Řádek seznamu – fotka, název, kcal + cena + SLEVA, plus a pin tlačítka. */
function Radek({
  p,
  aktivni,
  onVyber,
  mojeAlergie = [],
  pripnuta = false,
  onPin,
}: {
  p: PolozkaVyberu;
  aktivni: boolean;
  onVyber: (id: string) => void;
  mojeAlergie?: string[];
  pripnuta?: boolean;
  onPin?: (p: PolozkaVyberu) => void;
}) {
  const shoda = mojeAlergie.filter((a) => obsahujeAlergen(p, a));
  const stopySet = new Set(p.alergenyStopy ?? []);
  const obsahShoda = shoda.filter((a) => !stopySet.has(a));
  const stopyShoda = shoda.filter((a) => stopySet.has(a));
  return (
    <li className="flex items-center gap-0.5">
      <button
        type="button"
        role="option"
        aria-selected={aktivni}
        onClick={() => onVyber(p.id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface active:bg-surface-2"
      >
        <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-14" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{p.nazev}</span>
          {obsahShoda.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
              <TriangleAlert className="size-3 shrink-0" aria-hidden />
              obsahuje {obsahShoda.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
            </span>
          )}
          {stopyShoda.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning">
              <TriangleAlert className="size-3 shrink-0" aria-hidden />
              může obsahovat stopy: {stopyShoda.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
            </span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="tabular-nums">
              {p.kalorie > 0 ? `${formatujKcal(p.kalorie)} kcal / 100 g` : "bez nutric"}
            </span>
            {p.sleva && (
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                {p.slevaProcenta != null ? `−${p.slevaProcenta} %` : "SLEVA"}
              </span>
            )}
            {p.sleva && formatujPlatnostDo(p.platnostDo) && (
              <span>{formatujPlatnostDo(p.platnostDo)}</span>
            )}
            {p.aktualniCena > 0 && (
              <span className="tabular-nums">
                {formatujCenu(p.aktualniCena, p.baleniG).hlavni}
              </span>
            )}
            {formatujStariCeny(p.pozorovanoAt) && (
              <span>cena {formatujStariCeny(p.pozorovanoAt)}</span>
            )}
          </span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
          <Plus className="size-4" />
        </span>
      </button>
      {onPin && (
        <button
          type="button"
          onClick={() => onPin(p)}
          aria-label={pripnuta ? `${p.nazev} – odebrat ze stálic` : `${p.nazev} – připnout do stálic`}
          aria-pressed={pripnuta}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-accent"
        >
          <Star className={cn("size-4", pripnuta && "fill-accent text-accent")} aria-hidden />
        </button>
      )}
    </li>
  );
}

/** Kartička pro vodorovné lišty (Ve slevě / Nedávné) – e-shopový vzhled. */
function KartaPotraviny({
  p,
  onVyber,
  pripnuta = false,
  onPin,
}: {
  p: PolozkaVyberu;
  onVyber: (id: string) => void;
  pripnuta?: boolean;
  onPin?: (p: PolozkaVyberu) => void;
}) {
  return (
    <div className="relative w-36 shrink-0 snap-start">
      <button
        type="button"
        onClick={() => onVyber(p.id)}
        className="group w-full rounded-2xl border border-border bg-surface p-2.5 text-left transition-colors hover:border-primary/60"
      >
      <div className="relative mb-2 overflow-hidden rounded-xl bg-surface-2">
        <MiniaturaPotraviny obrazek={p.obrazek} velikost="aspect-square w-full" />
        {p.sleva && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
            {p.slevaProcenta != null ? `−${p.slevaProcenta} %` : "SLEVA"}
          </span>
        )}
      </div>
      <span className="block truncate text-xs font-medium text-fg">{p.nazev}</span>
      <span className="mt-0.5 block text-[11px] tabular-nums text-muted">
        {p.kalorie > 0 ? `${formatujKcal(p.kalorie)} kcal / 100 g` : "bez nutric"}
        {formatujCenu(p.aktualniCena, p.baleniG).vedlejsi && p.aktualniCena > 0
          ? ` · ${formatujCenu(p.aktualniCena, p.baleniG).vedlejsi}`
          : ""}
      </span>
      <span className="mt-1.5 flex items-center justify-between">
        <span className="flex flex-col">
          <span className="text-xs font-semibold tabular-nums text-fg">
            {formatujCenu(p.aktualniCena, p.baleniG).hlavni}
          </span>
          {p.sleva && formatujPlatnostDo(p.platnostDo) && (
            <span className="text-[10px] text-muted">{formatujPlatnostDo(p.platnostDo)}</span>
          )}
          {formatujStariCeny(p.pozorovanoAt) && (
            <span className="text-[10px] text-muted">cena {formatujStariCeny(p.pozorovanoAt)}</span>
          )}
        </span>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-fg transition-transform group-hover:scale-110">
          <Plus className="size-3.5" />
        </span>
      </span>
      </button>
      {onPin && (
        <button
          type="button"
          onClick={() => onPin(p)}
          aria-label={pripnuta ? `${p.nazev} – odebrat ze stálic` : `${p.nazev} – připnout do stálic`}
          aria-pressed={pripnuta}
          className={cn(
            "absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full bg-bg/80 backdrop-blur transition-colors",
            pripnuta ? "text-accent" : "text-muted hover:text-accent",
          )}
        >
          <Star className={cn("size-4", pripnuta && "fill-accent")} aria-hidden />
        </button>
      )}
    </div>
  );
}
