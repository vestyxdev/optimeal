import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, ChefHat, Clock, Minus, Pencil, Plus, Printer, ShoppingCart, Tag, Trash2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Button } from "@/components/ui/Button";
import { PotvrdDialog } from "@/components/ui/Dialog";
import { SkeletonText } from "@/components/ui/Nacitani";
import { useAuth } from "@/lib/auth";
import { alergenyReceptu, stopyReceptu, nactiRecept, smazRecept, spocitejRecept, KATEGORIE_NAZVY } from "@/lib/data/recepty";
import { nactiPotravinyPodleId } from "@/lib/data/plany";
import { ulozNakupniSeznam } from "@/lib/data/nakup";
import { ALERGEN_NAZVY } from "@/lib/data/potraviny";
import { efektivniAlergieProfilu, nactiProfil } from "@/lib/data/profil";
import { formatujCastku, formatujKcal, formatujMakro, formatujPlatnostDo } from "@/lib/cena";
import { sklonuj } from "@/lib/sklonovani";

/**
 * Detail receptu – suroviny s živými cenami, výživa na porci i celkem,
 * postup krok za krokem. Cena je z aktuálních slev.
 */

export function ReceptDetail() {
  const { id } = useParams<{ id: string }>();
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();
  const [potvrditSmazani, setPotvrditSmazani] = useState(false);
  // null = výchozí recept.porce; krokovač mění „vařím na N porcí"
  const [porci, setPorci] = useState<number | null>(null);

  const dotazRecept = useQuery({
    queryKey: ["recept", id],
    queryFn: () => nactiRecept(id as string),
    enabled: id !== undefined,
  });
  const recept = dotazRecept.data ?? null;
  const foodIds = recept?.suroviny.map((s) => s.foodId) ?? [];
  const dotazCeny = useQuery({
    queryKey: ["aktualni_ceny", "recept", foodIds],
    queryFn: () => nactiPotravinyPodleId(foodIds),
    enabled: foodIds.length > 0,
  });

  const mutaceSmazat = useMutation({
    mutationFn: () => smazRecept(id as string),
    onSuccess: () => {
      toast.success("Recept byl smazán.");
      void klientQ.invalidateQueries({ queryKey: ["recepty"] });
      naviguj("/recepty");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutaceNakup = useMutation({
    mutationFn: () => {
      const r = recept!;
      return ulozNakupniSeznam(
        `Recept – ${r.nazev} (${effektivniPorce} ${sklonuj(effektivniPorce, "porce", "porce", "porcí")})`,
        r.suroviny.map((s) => {
          const p = ceny?.find((x) => x.id === s.foodId);
          return {
            foodId: s.foodId,
            nazev: s.nazev,
            gramy: Math.round(s.gramyNaPorce * effektivniPorce),
            cenaZa100g: p?.aktualniCena ?? null,
            obchod: p?.obchod ?? null,
            jeSleva: p?.sleva ?? false,
            kategorie: p?.kategorie ?? "ostatni",
            baleniG: p?.baleniG ?? null,
          };
        }),
      );
    },
    onSuccess: () => {
      toast.success("Nákupní seznam uložen – najdete ho v sekci Nákup.");
      void klientQ.invalidateQueries({ queryKey: ["me_nakupni_seznamy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });

  const ceny = dotazCeny.data ?? null;
  const effektivniPorce = Math.max(
    1,
    Math.min(20, Math.round(porci ?? recept?.porce ?? 1)),
  );
  const vlastni = recept !== null && uzivatel !== null && recept.userId === uzivatel.id;
  const alergeny = recept ? alergenyReceptu(recept) : [];
  const stopy = recept ? stopyReceptu(recept) : [];
  const stopySet = new Set(stopy);
  // „alergeny" řádek = jen skutečné ingredience; stopové jsou zvlášť
  const obsahAlergeny = alergeny.filter((a) => !stopySet.has(a));
  const moje = efektivniAlergieProfilu(dotazProfil.data);
  const mojeAlergeny = obsahAlergeny.filter((a) => moje.includes(a));
  const mojeStopy = stopy.filter((a) => moje.includes(a));

  const kroky = recept
    ? recept.postup
        .split(/\r?\n/)
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/recepty"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-4" /> Zpět na recepty
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {recept?.nazev ?? "Recept"}
          </h1>
          {recept?.popis && <p className="mt-1 max-w-xl text-sm text-muted">{recept.popis}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tono="neutral">{KATEGORIE_NAZVY[recept?.kategorie ?? ""] ?? recept?.kategorie}</Badge>
            {vlastni && <Badge tono="primary">Vlastní recept</Badge>}
            <span>
              {recept?.porce ?? "—"} × {sklonuj(recept?.porce ?? 0, "porce", "porce", "porcí")}
            </span>
            {recept?.casMinuty != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {recept.casMinuty} min
              </span>
            )}
            <span>zdroj: {recept?.zdroj}</span>
            {obsahAlergeny.length > 0 && (
              <span>alergeny: {obsahAlergeny.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}</span>
            )}
            {stopy.length > 0 && (
              <span>může obsahovat stopy: {stopy.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}</span>
            )}
            {mojeAlergeny.length > 0 && (
              <Badge tono="danger">
                <TriangleAlert className="size-3" aria-hidden />
                obsahuje vaše alergeny: {mojeAlergeny.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
              </Badge>
            )}
            {mojeStopy.length > 0 && (
              <Badge tono="warning">
                <TriangleAlert className="size-3" aria-hidden />
                může obsahovat stopy vašeho alergenu: {mojeStopy.map((a) => ALERGEN_NAZVY[a] ?? a).join(", ")}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {vlastni && (
            <>
              <Button varianta="outline" onClick={() => naviguj(`/recepty/${id}/upravit`)}>
                <Pencil className="size-4" /> Upravit
              </Button>
              <Button
                varianta="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => setPotvrditSmazani(true)}
                disabled={mutaceSmazat.isPending}
              >
                <Trash2 className="size-4" /> Smazat
              </Button>
              <PotvrdDialog
                otevren={potvrditSmazani}
                naZavreni={() => setPotvrditSmazani(false)}
                naPotvrzeni={() => mutaceSmazat.mutate()}
                nadpis="Smazat recept"
                text={`Opravdu smazat recept „${recept?.nazev ?? ""}"? Akce je nevratná.`}
                potvrdit="Smazat"
                destruktivni
              />
            </>
          )}
          {uzivatel !== null && recept !== null && (
            <Button
              varianta="outline"
              onClick={() => mutaceNakup.mutate()}
              disabled={mutaceNakup.isPending}
            >
              <ShoppingCart className="size-4" /> Do seznamu
            </Button>
          )}
          <Button varianta="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Tisk
          </Button>
        </div>
      </div>

      {dotazRecept.isLoading && <SkeletonText radky={4} className="max-w-lg" />}
      {dotazRecept.isError && (
        <Card className="bg-danger-soft text-sm text-danger">
          {(dotazRecept.error as Error).message}
        </Card>
      )}

      {recept && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* suroviny */}
          <Card className="p-0 lg:col-span-3">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <CardNadpis className="mb-0 flex items-center gap-2">
                  <UtensilsCrossed className="size-5 text-primary" /> Suroviny
                </CardNadpis>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Méně porcí"
                    disabled={effektivniPorce <= 1}
                    onClick={() => setPorci(Math.max(1, effektivniPorce - 1))}
                    className="grid size-7 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-16 text-center text-sm font-semibold tabular-nums">
                    {effektivniPorce} {sklonuj(effektivniPorce, "porce", "porce", "porcí")}
                  </span>
                  <button
                    type="button"
                    aria-label="Více porcí"
                    disabled={effektivniPorce >= 20}
                    onClick={() => setPorci(Math.min(20, effektivniPorce + 1))}
                    className="grid size-7 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
            {/* mobil: kompaktní řádky (název, g/porci, obchod, cena) */}
            <div className="divide-y divide-border md:hidden">
              {recept.suroviny.map((s) => {
                const p = ceny?.find((x) => x.id === s.foodId);
                const cena = p ? (p.aktualniCena * s.gramyNaPorce * effektivniPorce) / 100 : null;
                return (
                  <div key={s.foodId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <MiniaturaPotraviny obrazek={s.obrazek} velikost="size-7" />
                      <span className="min-w-0">
                        <span className="block truncate">
                          {s.nazev}
                          {s.poznamka && <span className="text-muted"> ({s.poznamka})</span>}
                        </span>
                        <span className="text-xs text-muted tabular-nums">
                          {Math.round(s.gramyNaPorce)} g/porci · celkem{" "}
                          {Math.round(s.gramyNaPorce * effektivniPorce)} g
                          {p?.obchod ? ` · ${p.obchod}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {dotazCeny.isPending ? "…" : cena == null ? "—" : `${formatujCastku(cena)} Kč`}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* desktop: plná tabulka */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-5 py-2 font-medium">Potravina</th>
                  <th className="px-2 py-2 text-right font-medium">Na porci</th>
                  <th className="px-2 py-2 text-right font-medium">Celkem</th>
                  <th className="px-2 py-2 font-medium">Obchod</th>
                  <th className="px-5 py-2 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {recept.suroviny.map((s) => {
                  const p = ceny?.find((x) => x.id === s.foodId);
                  const celkemG = s.gramyNaPorce * effektivniPorce;
                  const cena = p ? (p.aktualniCena * celkemG) / 100 : null;
                  return (
                    <tr key={s.foodId} className="border-b border-border last:border-0">
                      <td className="px-5 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <MiniaturaPotraviny obrazek={s.obrazek} velikost="size-7" />
                          <span>
                            {s.nazev}
                            {s.poznamka && <span className="ml-1 text-xs text-muted">({s.poznamka})</span>}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{Math.round(s.gramyNaPorce)} g</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{Math.round(celkemG)} g</td>
                      <td className="px-2 py-2">
                        {p?.sleva ? (
                          <span className="inline-flex items-center gap-1">
                            {p.obchod} <Tag className="size-3 text-warning" />
                            {formatujPlatnostDo(p.platnostDo) && (
                              <span className="text-xs text-muted">({formatujPlatnostDo(p.platnostDo)})</span>
                            )}
                          </span>
                        ) : (
                          p?.obchod ?? "—"
                        )}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold">
                        {dotazCeny.isPending ? "…" : cena == null ? "—" : `${formatujCastku(cena)} Kč`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>

          {/* výživa */}
          <div className="space-y-4 lg:col-span-2">
            {(() => {
              const rozbor = spocitejRecept({ ...recept, porce: effektivniPorce }, ceny);
              return (
                <>
                  <Card>
                    <CardNadpis>Na porci</CardNadpis>
                    {dotazCeny.isPending ? (
                      <SkeletonText className="h-28" />
                    ) : (
                    <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Kalorie</div>
                        <div className="text-lg font-extrabold">{formatujKcal(rozbor.naPorci.kalorie)} kcal</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Cena</div>
                        <div className="text-lg font-extrabold">{formatujCastku(rozbor.naPorci.cena)} Kč</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Bílkoviny</div>
                        <div className="text-lg font-extrabold">{formatujMakro(rozbor.naPorci.bilkoviny)} g</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Sacharidy</div>
                        <div className="text-lg font-extrabold">{formatujMakro(rozbor.naPorci.sacharidy)} g</div>
                      </div>
                      <div className="rounded-card bg-surface-2 p-3">
                        <div className="text-xs text-muted">Tuky</div>
                        <div className="text-lg font-extrabold">{formatujMakro(rozbor.naPorci.tuky)} g</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      Celý recept ({effektivniPorce}{" "}
                      {sklonuj(effektivniPorce, "porce", "porce", "porcí")}):{" "}
                      {formatujCastku(rozbor.celkem.cena)} Kč ·{" "}
                      {formatujKcal(rozbor.celkem.kalorie)} kcal
                    </p>
                    </>
                    )}
                  </Card>

                  <Card>
                    <CardNadpis className="flex items-center gap-2">
                      <ChefHat className="size-5 text-primary" /> Postup
                    </CardNadpis>
                    <ol className="list-decimal space-y-2 pl-5 text-sm">
                      {kroky.map((krok, i) => (
                        <li key={i}>{krok}</li>
                      ))}
                    </ol>
                  </Card>

                  {rozbor.chybejiciCeny.length > 0 && (
                    <Card className="bg-warning-soft text-sm text-warning">
                      Cena za {rozbor.ocenenoSurovin}/{rozbor.pocetSurovin}{" "}
                      {sklonuj(rozbor.pocetSurovin, "surovinu", "suroviny", "surovin")} – zatím
                      neznáme cenu u: {rozbor.chybejiciCeny.join(", ")} (čeká na scraper).
                    </Card>
                  )}
                  {rozbor.podezreleKalorie.length > 0 && (
                    <p className="px-1 text-xs text-muted">
                      Pozor – uvedené kalorie se liší od odhadu z maker u:{" "}
                      {rozbor.podezreleKalorie.join(", ")}.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
