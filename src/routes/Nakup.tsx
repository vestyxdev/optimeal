import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Home, Printer, Plus, Store, Trash2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Button } from "@/components/ui/Button";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Nacitani";
import {
  nactiCenoveHladiny,
  nactiMeNakupniSeznamy,
  nactiPolozkySeznamu,
  prepnoutHotovo,
  prepnoutKoupeno,
  pridejVlastniPolozku,
  smazNakupniSeznam,
  smazPolozku,
  type PolozkaNakupu,
} from "@/lib/data/nakup";
import { ALERGEN_NAZVY } from "@/lib/data/potraviny";
import { efektivniAlergieProfilu, nactiProfil } from "@/lib/data/profil";
import { obsahujeAlergen } from "@/lib/generator/generator";
import { nejlevnejsiObchod, optimalizujNakup, type RezimOptimalizace } from "@/lib/cenovka";
import { jeVeSpizi, nactiSpiz, odeberZeSpize, pridejDoSpize } from "@/lib/data/spiz";
import { cn } from "@/lib/cn";
import { sklonuj } from "@/lib/sklonovani";
import { formatujCastku, formatujKc, formatujStariCeny } from "@/lib/cena";
import { formatujMnozstvi, spocitejNakupniBaleni } from "@/lib/nakupniBaleni";

/**
 * Nákup – uložené nákupní seznamy (z Jídelníčku i Mealprepu).
 * Odškrtávání položek, ruční doplňky (sůl, sáčky…), tisk.
 */

export function Nakup() {
  const klientQ = useQueryClient();
  const [vybrany, setVybrany] = useState<string | null>(null);
  const [novaPolozka, setNovaPolozka] = useState("");
  const [potvrditSmazani, setPotvrditSmazani] = useState(false);
  // režim Cenovky: 1 obchod / 2 obchody / kusově nejlevněji
  const [rezim, setRezim] = useState<RezimOptimalizace>("kusove");

  const dotazSeznamy = useQuery({ queryKey: ["me_nakupni_seznamy"], queryFn: nactiMeNakupniSeznamy });
  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil });
  const mojeAlergie = useMemo(
    () => efektivniAlergieProfilu(dotazProfil.data),
    [dotazProfil.data],
  );
  const dotazPolozky = useQuery({
    queryKey: ["nakupni_seznam", vybrany],
    queryFn: () => nactiPolozkySeznamu(vybrany as string),
    enabled: vybrany !== null,
  });
  // spíž – položky, co uživatel má doma, se vynechávají z účtu
  const dotazSpiz = useQuery({ queryKey: ["spiz"], queryFn: nactiSpiz });
  const spiz = dotazSpiz.data ?? [];
  const jeDoma = (p: { foodId?: string | null; nazev: string }) => jeVeSpizi(spiz, p);

  const neplatneMutace = (e: Error) => toast.error(e.message);

  const mutaceSpiz = useMutation({
    mutationFn: (p: { foodId: string | null; nazev: string; doSpize: boolean }) =>
      p.doSpize ? pridejDoSpize(p) : odeberZeSpize(p),
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["spiz"] }),
    onError: neplatneMutace,
  });

  const mutaceKoupeno = useMutation({
    mutationFn: (p: { id: string; koupeno: boolean }) => prepnoutKoupeno(p.id, p.koupeno),
    // optimistický přepnutí – odškrtávání musí být okamžité, chyba vrátí stav
    onMutate: async (p) => {
      const klic = ["nakupni_seznam", vybrany];
      await klientQ.cancelQueries({ queryKey: klic });
      const pred = klientQ.getQueryData<PolozkaNakupu[]>(klic);
      klientQ.setQueryData<PolozkaNakupu[]>(klic, (stare) =>
        stare?.map((x) => (x.id === p.id ? { ...x, koupeno: p.koupeno } : x)),
      );
      return { pred };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.pred) {
        klientQ.setQueryData(["nakupni_seznam", vybrany], ctx.pred);
      }
      neplatneMutace(e);
    },
    onSettled: () => void klientQ.invalidateQueries({ queryKey: ["nakupni_seznam", vybrany] }),
  });
  const mutaceHotovo = useMutation({
    mutationFn: (p: { id: string; hotovo: boolean }) => prepnoutHotovo(p.id, p.hotovo),
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["me_nakupni_seznamy"] }),
    onError: neplatneMutace,
  });
  const mutaceSmazatSeznam = useMutation({
    mutationFn: smazNakupniSeznam,
    onSuccess: () => {
      toast.success("Seznam smazán.");
      setVybrany(null);
      void klientQ.invalidateQueries({ queryKey: ["me_nakupni_seznamy"] });
    },
    onError: neplatneMutace,
  });
  const mutaceSmazatPolozku = useMutation({
    mutationFn: smazPolozku,
    // optimisticky – řádek zmizí hned, chyba ho vrátí zpět
    onMutate: async (id) => {
      const klic = ["nakupni_seznam", vybrany];
      await klientQ.cancelQueries({ queryKey: klic });
      const pred = klientQ.getQueryData<PolozkaNakupu[]>(klic);
      klientQ.setQueryData<PolozkaNakupu[]>(klic, (stare) =>
        stare?.filter((x) => x.id !== id),
      );
      return { pred };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.pred) {
        klientQ.setQueryData(["nakupni_seznam", vybrany], ctx.pred);
      }
      neplatneMutace(e);
    },
    onSettled: () => void klientQ.invalidateQueries({ queryKey: ["nakupni_seznam", vybrany] }),
  });
  const mutacePridat = useMutation({
    mutationFn: () => pridejVlastniPolozku(vybrany as string, novaPolozka.trim()),
    onSuccess: () => {
      setNovaPolozka("");
      void klientQ.invalidateQueries({ queryKey: ["nakupni_seznam", vybrany] });
    },
    onError: neplatneMutace,
  });

  const seznamy = dotazSeznamy.data ?? [];
  const polozky = dotazPolozky.data ?? [];
  const aktualniSeznam = seznamy.find((s) => s.id === vybrany) ?? null;
  // položky „mám doma" (spíž) – mimo skupiny obchodů i účet
  const doma = useMemo(() => polozky.filter(jeDoma), [polozky, spiz]);

  // Cenovka – živé ceny položek napříč obchody (price_observations)
  const foodIds = useMemo(
    () => polozky.map((p) => p.foodId).filter((id): id is string => Boolean(id)),
    [polozky],
  );
  const dotazCeny = useQuery({
    queryKey: ["cenove_hladiny", [...foodIds].sort().join(",")],
    queryFn: () => nactiCenoveHladiny(foodIds),
    enabled: vybrany !== null && foodIds.length > 0,
  });
  // optimalizace podle zvoleného režimu – item.id → živá nabídka
  // v přiřazeném obchodě (kusově = globální min, jeden/dva = výběr)
  const optimal = useMemo(
    () => optimalizujNakup(polozky, dotazCeny.data ?? new Map(), rezim),
    [polozky, dotazCeny.data, rezim],
  );
  // základ režimu 1 obchod – pro „ušetříš X oproti 1 obchodu" u dvojice
  const optimalJeden = useMemo(
    () =>
      rezim === "dva"
        ? optimalizujNakup(polozky, dotazCeny.data ?? new Map(), "jeden")
        : null,
    [polozky, dotazCeny.data, rezim],
  );
  // živé pozorování k položce – primárně z režimového přiřazení,
  // nekryté položky (v jeden/dva režimu) spadnou na vlastní obchod
  const obsNaPolozku = useMemo(
    () =>
      new Map(
        polozky.map((p) => [
          p.id,
          optimal.prirazeni.get(p.id) ??
            (p.obchod
              ? dotazCeny.data?.get(p.foodId ?? "")?.find((o) => o.obchod === p.obchod)
              : undefined),
        ]),
      ),
    [polozky, dotazCeny.data, optimal],
  );
  // co se skutečně koupí – celá balení/kusy a jejich cena (pokladní účet)
  // cena/sleva z ŽIVÉHO pozorování daného obchodu, když existuje –
  // snapshot z doby vzniku seznamu je jinak zastaralý (včerejší
  // letáková cena by se tvářila jako dnešní)
  const nakupy = useMemo(
    () =>
      new Map(
        polozky.map((p) => {
          const obs = obsNaPolozku.get(p.id);
          return [
            p.id,
            spocitejNakupniBaleni({
              nazev: p.nazev,
              gramy: p.gramy,
              baleniG: p.baleniG,
              cenaZa100g: obs?.cena ?? p.cenaZa100g,
              cenaBeznaZa100g: obs?.puvodniCena ?? null,
            }),
          ];
        }),
      ),
    [polozky, obsNaPolozku],
  );

  if (vybrany !== null && aktualniSeznam) {
    // ---------- detail seznamu ----------
    const zbyva = polozky.filter((p) => !p.koupeno).length;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              onClick={() => setVybrany(null)}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="size-4" /> Všechny seznamy
            </button>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{aktualniSeznam.nazev}</h1>
            <p className="mt-1 text-sm text-muted">
              {new Date(aktualniSeznam.vytvoreno).toLocaleString("cs-CZ")}
              {!dotazPolozky.isLoading && (
                <>
                  {" · "}
                  {sklonuj(zbyva, "zbývá", "zbývají", "zbývá")} {zbyva} z {polozky.length}{" "}
                  {sklonuj(polozky.length, "položka", "položky", "položek")}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button varianta="ghost" onClick={() => window.print()}>
              <Printer className="size-4" /> Tisk
            </Button>
            <Button
              varianta="outline"
              onClick={() => mutaceHotovo.mutate({ id: aktualniSeznam.id, hotovo: !aktualniSeznam.hotovo })}
            >
              {aktualniSeznam.hotovo ? "Označit jako nehotový" : "Označit jako hotový"}
            </Button>
            <Button
              varianta="ghost"
              className="text-danger hover:bg-danger-soft"
              onClick={() => setPotvrditSmazani(true)}
            >
              <Trash2 className="size-4" /> Smazat
            </Button>
            <PotvrdDialog
              otevren={potvrditSmazani}
              naZavreni={() => setPotvrditSmazani(false)}
              naPotvrzeni={() => mutaceSmazatSeznam.mutate(aktualniSeznam.id)}
              nadpis="Smazat seznam"
              text={`Opravdu smazat celý seznam „${aktualniSeznam.nazev}"? Akce je nevratná.`}
              potvrdit="Smazat"
              destruktivni
            />
          </div>
        </div>

        {dotazPolozky.isLoading && <Skeleton className="h-40" />}

        {/* Cenovka – kde se stejný košík vyplatí nejvíc */}
        {!dotazPolozky.isLoading && optimal.cenitelnych > 0 && (
          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Store className="size-4 text-muted" aria-hidden />
                Kde nakoupit nejlevněji
              </h2>
              <div
                className="flex rounded-pill border border-border bg-surface-2 p-0.5"
                role="tablist"
                aria-label="Režim nákupu"
              >
                {(
                  [
                    ["jeden", "1 obchod"],
                    ["dva", "2 obchody"],
                    ["kusove", "Kusově"],
                  ] as const
                ).map(([r, label]) => (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={rezim === r}
                    onClick={() => setRezim(r)}
                    className={cn(
                      "min-h-[36px] rounded-pill px-3.5 text-sm font-semibold transition-colors",
                      rezim === r
                        ? "bg-primary text-primary-fg shadow-card"
                        : "text-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-semibold">{optimal.obchody.join(" + ") || "—"}</span>
                <span className="ml-2 text-xs text-muted">
                  {optimal.pokryti} z {optimal.cenitelnych}{" "}
                  {sklonuj(optimal.cenitelnych, "položky", "položek", "položek")} dostupných
                </span>
                {rezim === "dva" && optimalJeden && (
                  <span className="ml-2 text-xs font-semibold text-ok">
                    {optimalJeden.celkem - optimal.celkem > 0.01
                      ? `ušetříte ${formatujCastku(optimalJeden.celkem - optimal.celkem)} Kč oproti 1 obchodu`
                      : optimal.pokryti > optimalJeden.pokryti
                        ? "kryje víc položek než 1 obchod"
                        : ""}
                  </span>
                )}
              </span>
              <span className="tabular-nums font-semibold">
                ≈ {formatujKc(optimal.celkem)} Kč
              </span>
            </div>
          </Card>
        )}

        {!dotazPolozky.isLoading && (
        <Card className="p-0">
          {(() => {
            // seskupení podle PŘIŘAZENÉHO obchodu (režim optimalizace);
            // nekryté položky zůstávají u vlastního obchodu / bez obchodu;
            // položky „mám doma" jdou mimo skupiny – do oddílu spíže
            const skupiny = new Map<string, PolozkaNakupu[]>();
            for (const p of [...polozky].sort(
              (a, b) => Number(a.koupeno) - Number(b.koupeno),
            )) {
              if (jeDoma(p)) continue;
              const k = optimal.prirazeni.get(p.id)?.obchod ?? p.obchod ?? "";
              skupiny.set(k, [...(skupiny.get(k) ?? []), p]);
            }
            const sekce = [...skupiny.entries()].sort(
              (a, b) =>
                (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) ||
                a[0].localeCompare(b[0], "cs"),
            );
            const mezisoucet = (seznam: PolozkaNakupu[]) =>
              seznam
                .filter((p) => !p.koupeno)
                .reduce((s, p) => s + (nakupy.get(p.id)?.cenaCelkem ?? 0), 0);
            const viceSkupin = sekce.length > 1;
            return sekce.map(([obchod, seznam]) => (
              <div key={obchod || "ostatni"}>
                {viceSkupin && (
                  <div className="flex items-baseline justify-between border-b border-border bg-surface-2/60 px-4 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {obchod || "Bez obchodu"}
                    </span>
                    {mezisoucet(seznam) > 0 && (
                      <span className="text-xs tabular-nums text-muted">
                        ≈ {formatujKc(mezisoucet(seznam))} Kč
                      </span>
                    )}
                  </div>
                )}
                <ul className="divide-y divide-border">
            {seznam.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={p.koupeno}
                  onChange={(e) => mutaceKoupeno.mutate({ id: p.id, koupeno: e.target.checked })}
                  className="size-5 shrink-0 accent-primary"
                  aria-label={`Označit ${p.nazev} jako koupené`}
                />
                <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-8" />
                <span className={p.koupeno ? "flex-1 text-muted line-through" : "flex-1 font-medium"}>
                  {p.nazev}
                  {p.vlastni && <Badge tono="neutral" className="ml-2">ruční</Badge>}
                  {(() => {
                    const obs = obsNaPolozku.get(p.id);
                    // efektivní sleva = živá, pokud ji obchod právě hlásí;
                    // snapshot flag jen když pozorování chybí
                    const slevaEfektivni = obs?.jeSleva ?? p.jeSleva;
                    if (!slevaEfektivni) return null;
                    const pct =
                      obs?.puvodniCena && p.cenaZa100g
                        ? Math.round((1 - (obs.cena) / obs.puvodniCena) * 100)
                        : null;
                    return (
                      <Badge tono="warning" className="ml-2">
                        SLEVA{pct !== null ? ` −${pct} %` : ""} {p.obchod}
                      </Badge>
                    );
                  })()}
                  {(() => {
                    const stopySet = new Set(p.alergenyStopy ?? []);
                    const shoda = mojeAlergie.filter((a) => obsahujeAlergen(p, a));
                    const obsah = shoda.filter((a) => !stopySet.has(a));
                    const stopy = shoda.filter((a) => stopySet.has(a));
                    return (
                      <>
                        {obsah.length > 0 && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-danger">
                            <TriangleAlert className="size-3 shrink-0" aria-hidden />
                            obsahuje {obsah.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                          </span>
                        )}
                        {stopy.length > 0 && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-warning">
                            <TriangleAlert className="size-3 shrink-0" aria-hidden />
                            může obsahovat stopy: {stopy.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
                          </span>
                        )}
                      </>
                    );
                  })()}
                  {(() => {
                    const n = nakupy.get(p.id);
                    return n?.zbytek ? (
                      <span className="block text-xs font-normal text-muted">
                        potřeba {formatujMnozstvi(p.gramy, "g")}
                      </span>
                    ) : null;
                  })()}
                </span>
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {nakupy.get(p.id)?.popisek ?? `${Math.round(p.gramy)} g`}
                </span>
                <span className="whitespace-nowrap tabular-nums text-right">
                  {(() => {
                    const n = nakupy.get(p.id);
                    return n?.cenaCelkem != null
                      ? `${formatujCastku(n.cenaCelkem)} Kč`
                      : "—";
                  })()}
                  {(() => {
                    // stáří zdrojového pozorování – týden stará cena
                    // nesmí působit jako živá (letáky končí, scrape vypadává)
                    if (nakupy.get(p.id)?.cenaCelkem == null) return null;
                    const stari = formatujStariCeny(obsNaPolozku.get(p.id)?.pozorovanoAt);
                    return stari ? (
                      <span className="block text-[10px] font-normal text-muted">
                        cena {stari}
                      </span>
                    ) : null;
                  })()}
                  {(() => {
                    const n = nakupy.get(p.id);
                    const slevaEfektivni = obsNaPolozku.get(p.id)?.jeSleva ?? p.jeSleva;
                    if (!slevaEfektivni || !n || n.usetreno <= 0 || n.cenaCelkem === null) return null;
                    const puvodniCelkem = n.cenaCelkem + n.usetreno;
                    return (
                      <span className="block text-xs font-normal text-muted">
                        <span className="line-through">{formatujCastku(puvodniCelkem)} Kč</span>
                        {" · "}ušetříte {formatujCastku(n.usetreno)} Kč
                      </span>
                    );
                  })()}
                  {(() => {
                    const tip = p.foodId ? nejlevnejsiObchod(dotazCeny.data?.get(p.foodId)) : null;
                    if (!tip) return null;
                    // ukazujeme jen když živá nabídka podbíjí ZOBRAZENOU cenu
                    // (živé pozorování ?? snapshot), nebo položka cenu neměla
                    const zobrazena = obsNaPolozku.get(p.id)?.cena ?? p.cenaZa100g;
                    if (zobrazena !== null && tip.cena >= zobrazena - 0.001) return null;
                    return (
                      <span className="block text-xs font-medium text-primary">
                        nejlevněji {tip.obchod}
                      </span>
                    );
                  })()}
                </span>
                <button
                  onClick={() => mutaceSpiz.mutate({ foodId: p.foodId ?? null, nazev: p.nazev, doSpize: true })}
                  className="rounded-lg p-2.5 text-muted transition-colors hover:bg-ok-soft hover:text-ok"
                  title="Mám doma – přesunout do spíže"
                  aria-label={`${p.nazev} mám doma`}
                >
                  <Home className="size-4" />
                </button>
                <button
                  onClick={() => mutaceSmazatPolozku.mutate(p.id)}
                  className="rounded-lg p-2.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  title="Smazat položku"
                  aria-label={`Smazat ${p.nazev}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {polozky.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">Seznam je prázdný.</li>
            )}
                </ul>
              </div>
            ));
          })()}

          {/* Spíž – „mám doma" – z účtu vynechané položky */}
          {doma.length > 0 && (
            <details className="border-t border-border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <Home className="size-4" aria-hidden />
                Už mám doma (Spíž)
                <Badge tono="neutral">{doma.length}</Badge>
              </summary>
              <ul className="divide-y divide-border/60">
                {doma.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted">
                    <MiniaturaPotraviny obrazek={p.obrazek} velikost="size-7" />
                    <span className="flex-1 font-medium">
                      {p.nazev}
                      <span className="ml-2 font-normal tabular-nums">{Math.round(p.gramy)} g</span>
                    </span>
                    <button
                      onClick={() => mutaceSpiz.mutate({ foodId: p.foodId ?? null, nazev: p.nazev, doSpize: false })}
                      className="min-h-[44px] rounded-lg px-3 text-xs font-semibold text-muted transition-colors hover:bg-warning-soft hover:text-warning"
                    >
                      Došlo – vrátit do nákupu
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* účet – součet známých cen, přepočet na gramy */}
          {(() => {
            // efektivní cena/sleva = živé pozorování ?? snapshot –
            // stejná pravidla jako v nakupy (jinak by se řádek a účet
            // neshodly)
            const maCenu = (p: (typeof polozky)[number]) =>
              nakupy.get(p.id)?.cenaCelkem != null;
            const veSleveEfektivne = (p: (typeof polozky)[number]) =>
              obsNaPolozku.get(p.id)?.jeSleva ?? p.jeSleva;
            // položky spíže se do účtu nepočítají – už jsou doma
            const nekoupenoSCenou = polozky.filter((p) => maCenu(p) && !p.koupeno && !jeDoma(p));
            const kupovane = polozky.filter((p) => !jeDoma(p));
            const vseKoupeno = kupovane.length > 0 && kupovane.every((p) => p.koupeno);
            // po odškrtnutí všeho ukazujeme součet celého nákupu, ne „0 Kč"
            const zaklad = vseKoupeno ? kupovane.filter(maCenu) : nekoupenoSCenou;
            const celkem = zaklad.reduce((s, p) => s + (nakupy.get(p.id)?.cenaCelkem ?? 0), 0);
            const usetreno = zaklad.reduce((s, p) => s + (nakupy.get(p.id)?.usetreno ?? 0), 0);
            const bezCeny = kupovane.filter((p) => !maCenu(p)).length;
            const veSleve = zaklad.filter(veSleveEfektivne).length;
            if (polozky.length === 0) return null;
            return (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3">
                <span className="text-sm font-semibold tabular-nums">
                  {vseKoupeno ? "Nákup ≈" : "Zbývá ≈"} {formatujKc(celkem)} Kč
                  {usetreno > 0 && (
                    <span className="ml-2 text-xs font-semibold text-accent">
                      ušetříte {formatujKc(usetreno)} Kč
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {veSleve > 0 && `${veSleve}× ve slevě`}
                  {veSleve > 0 && bezCeny > 0 && " · "}
                  {bezCeny > 0 && `u ${bezCeny} ${sklonuj(bezCeny, "položky", "položek", "položek")} cena chybí`}
                </span>
              </div>
            );
          })()}

          {/* ruční doplnění */}
          <div className="flex gap-2 border-t border-border p-4">
            <Input
              value={novaPolozka}
              onChange={(e) => setNovaPolozka(e.target.value)}
              placeholder="Doplnit vlastní položku (sůl, sáčky…)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && novaPolozka.trim()) mutacePridat.mutate();
              }}
            />
            <Button
              varianta="outline"
              onClick={() => {
                if (novaPolozka.trim()) mutacePridat.mutate();
              }}
              disabled={!novaPolozka.trim() || mutacePridat.isPending}
            >
              <Plus className="size-4" /> Přidat
            </Button>
          </div>
        </Card>
        )}
      </div>
    );
  }

  // ---------- přehled seznamů ----------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Nákup</h1>
        <p className="mt-1 text-sm text-muted">
          Uložené nákupní seznamy z Jídelníčku i Mealprepu – odškrtávejte položky,
          doplňte, co je u vás doma, a uklidněte si to v tisku.
        </p>
      </div>

      {dotazSeznamy.isLoading && <Skeleton className="h-24" />}
      {dotazSeznamy.isError && (
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotazSeznamy.error as Error).message}
        </Card>
      )}

      {seznamy.length === 0 && !dotazSeznamy.isLoading && (
        <Card className="text-center text-sm text-muted">
          Zatím nemáte žádné nákupní seznamy. Vytvořte je v Jídelníčku nebo
          v Mealprepu tlačítkem „Uložit nákupní seznam".
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seznamy.map((s) => (
          <Card
            key={s.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => setVybrany(s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setVybrany(s.id);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{s.nazev}</h2>
              {s.hotovo && <Badge tono="ok">HOTOVO</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {new Date(s.vytvoreno).toLocaleString("cs-CZ")}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
