import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Printer, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Nacitani";
import {
  nactiMeNakupniSeznamy,
  nactiPolozkySeznamu,
  prepnoutHotovo,
  prepnoutKoupeno,
  pridejVlastniPolozku,
  smazNakupniSeznam,
  smazPolozku,
} from "@/lib/data/nakup";

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
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["nakupni_seznam", vybrany] }),
    onError: neplatneMutace,
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
    onSuccess: () => void klientQ.invalidateQueries({ queryKey: ["nakupni_seznam", vybrany] }),
    onError: neplatneMutace,
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
              {new Date(aktualniSeznam.vytvoreno).toLocaleString("cs-CZ")} · zbývá {zbyva} z{" "}
              {polozky.length} položek
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

        <Card className="p-0">
          <ul className="divide-y divide-border">
            {polozky.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={p.koupeno}
                  onChange={(e) => mutaceKoupeno.mutate({ id: p.id, koupeno: e.target.checked })}
                  className="size-4 accent-primary"
                  aria-label={`Označit ${p.nazev} jako koupené`}
                />
                <span className={p.koupeno ? "flex-1 text-muted line-through" : "flex-1 font-medium"}>
                  {p.nazev}
                  {p.vlastni && <Badge tono="neutral" className="ml-2">ruční</Badge>}
                  {p.jeSleva && <Badge tono="warning" className="ml-2">SLEVA {p.obchod}</Badge>}
                </span>
                <span className="tabular-nums text-muted">{Math.round(p.gramy)} g</span>
                <span className="tabular-nums">
                  {p.cenaZa100g === null ? "—" : `${((p.cenaZa100g * p.gramy) / 100).toFixed(2)} Kč`}
                </span>
                <button
                  onClick={() => mutaceSmazatPolozku.mutate(p.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
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
