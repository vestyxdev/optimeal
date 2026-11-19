import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Printer, Plus, Store, Trash2 } from "lucide-react";
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
import { nejlevnejsiObchod, porovnejObchody } from "@/lib/cenovka";
import { sklonuj } from "@/lib/sklonovani";
import { formatujCastku, formatujKc } from "@/lib/cena";

/**
 * Nákup – uložené nákupní seznamy (z Jídelníčku i Mealprepu).
 * Odškrtávání položek, ruční doplňky (sůl, sáčky…), tisk.
 */

export function Nakup() {
  const klientQ = useQueryClient();
  const [vybrany, setVybrany] = useState<string | null>(null);
  const [novaPolozka, setNovaPolozka] = useState("");
  const [potvrditSmazani, setPotvrditSmazani] = useState(false);

  const dotazSeznamy = useQuery({ queryKey: ["me_nakupni_seznamy"], queryFn: nactiMeNakupniSeznamy });
  const dotazPolozky = useQuery({
    queryKey: ["nakupni_seznam", vybrany],
    queryFn: () => nactiPolozkySeznamu(vybrany as string),
    enabled: vybrany !== null,
  });

  const neplatneMutace = (e: Error) => toast.error(e.message);

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
  const souhrnyObchodu = useMemo(
    () => porovnejObchody(polozky, dotazCeny.data ?? new Map()),
    [polozky, dotazCeny.data],
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
        {!dotazPolozky.isLoading && souhrnyObchodu.length > 0 && (
          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Store className="size-4 text-muted" aria-hidden />
                Kde nakoupit nejlevněji
              </h2>
              <span className="text-xs text-muted">živé ceny z posledních 30 dnů</span>
            </div>
            <ul className="divide-y divide-border/60">
              {souhrnyObchodu.slice(0, 4).map((s, i) => (
                <li key={s.obchodId} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className={i === 0 ? "font-semibold" : "font-medium"}>{s.obchod}</span>
                    {i === 0 && <Badge tono="ok">nejlevnější</Badge>}
                    <span className="text-xs text-muted">
                      ceny u {s.pokryti} z {polozky.filter((p) => p.foodId).length} položek
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold">≈ {formatujKc(s.celkem)} Kč</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!dotazPolozky.isLoading && (
        <Card className="p-0">
          {(() => {
            // seskupení podle obchodu – v každé sekci nekoupené napřed,
            // zápatí skupiny ukazuje mezisoučet (praktické v regále)
            const skupiny = new Map<string, PolozkaNakupu[]>();
            for (const p of [...polozky].sort(
              (a, b) => Number(a.koupeno) - Number(b.koupeno),
            )) {
              const k = p.obchod ?? "";
              skupiny.set(k, [...(skupiny.get(k) ?? []), p]);
            }
            const sekce = [...skupiny.entries()].sort(
              (a, b) =>
                (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) ||
                a[0].localeCompare(b[0], "cs"),
            );
            const mezisoucet = (seznam: PolozkaNakupu[]) =>
              seznam
                .filter((p) => !p.koupeno && p.cenaZa100g !== null)
                .reduce((s, p) => s + ((p.cenaZa100g ?? 0) * p.gramy) / 100, 0);
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
                  {p.jeSleva && <Badge tono="warning" className="ml-2">SLEVA {p.obchod}</Badge>}
                </span>
                <span className="tabular-nums text-muted">{Math.round(p.gramy)} g</span>
                <span className="tabular-nums text-right">
                  {p.cenaZa100g === null ? "—" : `${formatujCastku((p.cenaZa100g * p.gramy) / 100)} Kč`}
                  {(() => {
                    const tip = p.foodId ? nejlevnejsiObchod(dotazCeny.data?.get(p.foodId)) : null;
                    if (!tip) return null;
                    // ukazujeme jen když živá nabídka podbíjí uloženou cenu,
                    // nebo když položka cenu vůbec neměla
                    if (p.cenaZa100g !== null && tip.cena >= p.cenaZa100g - 0.001) return null;
                    return (
                      <span className="block text-xs font-medium text-primary">
                        nejlevněji {tip.obchod}
                      </span>
                    );
                  })()}
                </span>
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

          {/* účet – součet známých cen, přepočet na gramy */}
          {(() => {
            const nekoupenoSCenou = polozky.filter((p) => p.cenaZa100g !== null && !p.koupeno);
            const vseKoupeno = polozky.length > 0 && polozky.every((p) => p.koupeno);
            // po odškrtnutí všeho ukazujeme součet celého nákupu, ne „0 Kč"
            const zaklad = vseKoupeno
              ? polozky.filter((p) => p.cenaZa100g !== null)
              : nekoupenoSCenou;
            const celkem = zaklad.reduce((s, p) => s + ((p.cenaZa100g ?? 0) * p.gramy) / 100, 0);
            const bezCeny = polozky.filter((p) => p.cenaZa100g === null).length;
            const veSleve = zaklad.filter((p) => p.jeSleva).length;
            if (polozky.length === 0) return null;
            return (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3">
                <span className="text-sm font-semibold tabular-nums">
                  {vseKoupeno ? "Nákup ≈" : "Zbývá ≈"} {formatujKc(celkem)} Kč
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
