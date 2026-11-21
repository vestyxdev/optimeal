import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ChefHat, Clock, Coins, Flame, Plus, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Nacitani";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { useAuth } from "@/lib/auth";
import { alergenyReceptu, stopyReceptu, nactiRecepty, spocitejRecept, KATEGORIE_NAZVY } from "@/lib/data/recepty";
import { nactiPotravinyPodleId } from "@/lib/data/plany";
import { ALERGEN_NAZVY } from "@/lib/data/potraviny";
import { efektivniAlergieProfilu, nactiProfil } from "@/lib/data/profil";
import { formatujCastku, formatujKcal, formatujMakro } from "@/lib/cena";

/**
 * Recepty – katalog receptů s živými cenami a výživovými hodnotami
 * na porci. Filtr podle kategorie.
 */

export function Recepty() {
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const [kategorie, setKategorie] = useState<string | null>(null);

  const dotazRecepty = useQuery({ queryKey: ["recepty"], queryFn: nactiRecepty });
  const recepty = dotazRecepty.data ?? [];
  const foodIds = [...new Set(recepty.flatMap((r) => r.suroviny.map((s) => s.foodId)))];
  const dotazCeny = useQuery({
    queryKey: ["aktualni_ceny", "recepty", foodIds],
    queryFn: () => nactiPotravinyPodleId(foodIds),
    enabled: foodIds.length > 0,
  });
  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });
  const mojeAlergie = efektivniAlergieProfilu(dotazProfil.data);

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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr podle kategorie">
        <button
          onClick={() => setKategorie(null)}
          aria-pressed={kategorie === null}
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
            aria-pressed={kategorie === k}
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

      {dotazRecepty.isError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-danger-soft text-sm text-danger">
          <span>{(dotazRecepty.error as Error).message}</span>
          <Button
            varianta="outline"
            velikost="sm"
            onClick={() => void dotazRecepty.refetch()}
          >
            Zkusit znovu
          </Button>
        </Card>
      )}
      {!dotazRecepty.isLoading && filtrovane.length === 0 && (
        <Card className="text-center text-sm text-muted">
          <ChefHat className="mx-auto mb-2 size-6" />
          {kategorie
            ? "V této kategorii zatím nic není – zkuste jinou."
            : "Zatím žádné recepty."}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dotazRecepty.isLoading &&
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />)}
        {filtrovane.map((recept) => {
          const rozbor = spocitejRecept(recept, dotazCeny.data ?? null);
          const stopySet = new Set(stopyReceptu(recept));
          const shodaAlergie = alergenyReceptu(recept).filter((a) => mojeAlergie.includes(a));
          const obsahShoda = shodaAlergie.filter((a) => !stopySet.has(a));
          const stopyShoda = shodaAlergie.filter((a) => stopySet.has(a));
          return (
            <Link key={recept.id} to={`/recepty/${recept.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-fg">{recept.nazev}</h2>
                  <div className="flex shrink-0 gap-1.5">
                    {obsahShoda.length > 0 && (
                      <Badge
                        tono="danger"
                        title={`Obsahuje vaše alergeny: ${obsahShoda.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}`}
                      >
                        <TriangleAlert className="size-3" aria-hidden />
                        alergen
                      </Badge>
                    )}
                    {stopyShoda.length > 0 && (
                      <Badge
                        tono="warning"
                        title={`Může obsahovat stopy vašeho alergenu: ${stopyShoda.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}`}
                      >
                        <TriangleAlert className="size-3" aria-hidden />
                        stopy
                      </Badge>
                    )}
                    {uzivatel && recept.userId === uzivatel.id && (
                      <Badge tono="primary">Vlastní</Badge>
                    )}
                    <Badge tono="neutral">{KATEGORIE_NAZVY[recept.kategorie] ?? recept.kategorie}</Badge>
                  </div>
                </div>
                {recept.popis && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{recept.popis}</p>
                )}
                {(() => {
                  const obrazky = recept.suroviny
                    .map((s) => s.obrazek)
                    .filter((o): o is string => !!o)
                    .slice(0, 5);
                  return (
                    obrazky.length >= 2 && (
                      <div className="mt-2 flex gap-1" aria-hidden="true">
                        {obrazky.map((o) => (
                          <MiniaturaPotraviny key={o} obrazek={o} velikost="size-9" />
                        ))}
                      </div>
                    )
                  );
                })()}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  {dotazCeny.isPending ? (
                    <Skeleton className="h-3 w-40" />
                  ) : (
                  <>
                  <span className="inline-flex items-center gap-1">
                    <Flame className="size-3 text-warning" />
                    <strong className="text-fg">{formatujKcal(rozbor.naPorci.kalorie)}</strong> kcal/porci
                  </span>
                  <span>
                    B <strong className="text-fg">{formatujMakro(rozbor.naPorci.bilkoviny)}</strong> g
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Coins className="size-3 text-ok" />
                    <strong className="text-fg">{formatujCastku(rozbor.naPorci.cena)}</strong> Kč/porci
                  </span>
                  </>
                  )}
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
