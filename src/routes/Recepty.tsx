import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { nactiRecepty, spocitejRecept, KATEGORIE_NAZVY } from "@/lib/data/recepty";
import { nactiPotravinySeSlevami } from "@/lib/data/plany";

/**
 * Recepty – katalog receptů s živými cenami a výživovými hodnotami
 * na porci. Filtr podle kategorie.
 */

export function Recepty() {
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const [kategorie, setKategorie] = useState<string | null>(null);

  const dotazRecepty = useQuery({ queryKey: ["recepty"], queryFn: nactiRecepty });
  const dotazCeny = useQuery({ queryKey: ["aktualni_ceny"], queryFn: nactiPotravinySeSlevami });

  const recepty = dotazRecepty.data ?? [];
  const filtrovane = kategorie ? recepty.filter((r) => r.kategorie === kategorie) : recepty;
  const kategorieVSeznamu = [...new Set(recepty.map((r) => r.kategorie))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Recepty</h1>
          <p className="mt-1 text-sm text-muted">
            Recepty sestavené z katalogu potravin – cena i výživové hodnoty se počítají
            živě z aktuálních cen, takže vidíte, co se dnes vyplatí uvařit.
          </p>
        </div>
        {uzivatel && (
          <Button velikost="sm" onClick={() => naviguj("/recepty/novy")}>
            <Plus className="size-4" /> Nový recept
          </Button>
        )}
      </div>

      {/* filtry kategorií */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setKategorie(null)}
          className={
            kategorie === null
              ? "rounded-pill bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
              : "rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
          }
        >
          Vše
        </button>
        {kategorieVSeznamu.map((k) => (
          <button
            key={k}
            onClick={() => setKategorie(k)}
            className={
              kategorie === k
                ? "rounded-pill bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
                : "rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
            }
          >
            {KATEGORIE_NAZVY[k] ?? k}
          </button>
        ))}
      </div>

      {dotazRecepty.isLoading && <p className="text-sm text-muted">Načítám recepty…</p>}
      {dotazRecepty.isError && (
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotazRecepty.error as Error).message}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtrovane.map((recept) => {
          const rozbor = spocitejRecept(recept, dotazCeny.data ?? null);
          return (
            <Link key={recept.id} to={`/recepty/${recept.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-fg">{recept.nazev}</h2>
                  <div className="flex shrink-0 gap-1.5">
                    {uzivatel && recept.userId === uzivatel.id && (
                      <Badge tono="primary">Vlastní</Badge>
                    )}
                    <Badge tono="neutral">{KATEGORIE_NAZVY[recept.kategorie] ?? recept.kategorie}</Badge>
                  </div>
                </div>
                {recept.popis && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{recept.popis}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    🔥 <strong className="text-fg">{rozbor.naPorci.kalorie}</strong> kcal/porci
                  </span>
                  <span>
                    B <strong className="text-fg">{rozbor.naPorci.bilkoviny}</strong> g
                  </span>
                  <span>
                    💰 <strong className="text-fg">{rozbor.naPorci.cena.toFixed(2)}</strong> Kč/porci
                  </span>
                  {recept.casMinuty != null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {recept.casMinuty} min
                    </span>
                  )}
                  <span>{recept.porce} × porce</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
