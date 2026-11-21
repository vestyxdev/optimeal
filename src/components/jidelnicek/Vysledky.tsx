import { useMemo } from "react";
import { CalendarDays, NotebookPen, PiggyBank, RefreshCw, ShoppingBasket } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import {
  sestavNakupniSeznam,
  type Cile,
  type DenVysledek,
  type NakupniPolozka,
  type SouhrnJidla,
  type TydenniPlan,
} from "@/lib/generator/generator";
import { formatujCastku, formatujKcal, formatujKc, formatujMakro, formatujStariCeny } from "@/lib/cena";
import { formatujMnozstvi, spocitejNakupniBaleni } from "@/lib/nakupniBaleni";

/**
 * Sdílené renderování výsledků generátoru – používá Jídelníček
 * i detail uloženého plánu (Mé plány).
 */

export const DENY: Record<string, string> = {
  1: "Pondělí", 2: "Úterý", 3: "Středa", 4: "Čtvrtek", 5: "Pátek", 6: "Sobota", 7: "Neděle",
};

/** Denní souhrny – metrika cíle vs. realita. */
function Metrika({ nazev, hodnota, cilyJednotka }: { nazev: string; hodnota: string; cilyJednotka: string }) {
  return (
    <Card className="py-4">
      <div className="text-xs font-medium text-muted">{nazev}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{hodnota}</div>
      <div className="text-xs text-muted">{cilyJednotka}</div>
    </Card>
  );
}

export function KartaNakupu({ polozky, soucetPopisek }: { polozky: NakupniPolozka[]; soucetPopisek: string }) {
  // co se skutečně koupí – celá balení / kusy, cena za balení
  const nakupy = useMemo(
    () => polozky.map((x) => spocitejNakupniBaleni({ nazev: x.nazev, gramy: x.gramy, baleniG: x.baleniG, cenaZa100g: x.cenaZa100g, cenaBeznaZa100g: x.cenaBeznaZa100g })),
    [polozky],
  );
  const celkem = nakupy.reduce((s, n) => s + (n.cenaCelkem ?? 0), 0);
  const usetreno = nakupy.reduce((s, n) => s + (n.usetreno ?? 0), 0);
  const bezCeny = polozky.filter((x) => x.cenaZa100g === null).length;
  const tvarPolozka = bezCeny === 1 ? "položka" : bezCeny < 5 ? "položky" : "položek";
  // nejstarší známé pozorování – součet stojí na cenách maximálně
  // tohoto stáří; poctivější než tvrdit „dnešní ceny"
  const stariSouctu = formatujStariCeny(
    polozky.reduce<string | null>((min, x) => {
      const p = x.pozorovanoAt;
      if (!p) return min;
      return min === null || p < min ? p : min;
    }, null),
  );

  return (
    <Card className="p-0">
      <div className="border-b border-border px-5 py-4">
        <CardNadpis className="mb-0 flex items-center gap-2">
          <ShoppingBasket className="size-5 text-primary" /> Nákupní seznam
        </CardNadpis>
      </div>
      {usetreno > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-ok-soft px-5 py-2 text-sm text-ok">
          <PiggyBank className="size-4 shrink-0" />
          Díky slevám šetříte {formatujCastku(usetreno)} Kč
        </div>
      )}
      {/* mobil: kompaktní řádky (název, množství, sleva, cena) */}
      <div className="divide-y divide-border md:hidden">
        {polozky.map((x, i) => {
          const n = nakupy[i]!;
          return (
          <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <MiniaturaPotraviny obrazek={x.obrazek} velikost="size-7" inline />
              <span className="min-w-0">
                <span className="block truncate">{x.nazev}</span>
                <span className="whitespace-nowrap text-xs font-semibold tabular-nums">
                  {n.popisek}
                  <span className="font-normal text-muted">
                    {n.zbytek ? ` · potřeba ${formatujMnozstvi(x.gramy, "g")}` : ""}
                    {x.obchod ? ` · ${x.obchod}` : ""}
                  </span>
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {x.sleva && <Badge tono="warning">SLEVA</Badge>}
              <span className="whitespace-nowrap font-semibold tabular-nums">
                {x.cenaZa100g !== null ? `${formatujCastku(n.cenaCelkem ?? 0)} Kč` : "—"}
              </span>
            </span>
          </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5 text-sm">
          <span className="font-semibold">{soucetPopisek}</span>
          <span className="font-extrabold tabular-nums">{formatujCastku(celkem)} Kč</span>
        </div>
      </div>

      {/* desktop: plná tabulka */}
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-5 py-2 font-medium">Potravina</th>
            <th className="px-2 py-2 text-right font-medium">Koupit</th>
            <th className="px-2 py-2 text-right font-medium">Cena/100 g</th>
            <th className="px-2 py-2 font-medium">Obchod</th>
            <th className="px-2 py-2 text-right font-medium">Ušetřeno</th>
            <th className="px-5 py-2 text-right font-medium">Cena</th>
          </tr>
        </thead>
        <tbody>
          {polozky.map((x, i) => {
            const n = nakupy[i]!;
            return (
            <tr key={x.id} className="border-b border-border last:border-0">
              <td className="px-5 py-2 font-medium">
                <MiniaturaPotraviny obrazek={x.obrazek} velikost="size-7" inline />
                {x.nazev}
                {x.sleva && <Badge tono="warning" className="ml-2">SLEVA</Badge>}
                {n.zbytek && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    potřeba {formatujMnozstvi(x.gramy, "g")}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">{n.popisek}</td>
              <td className="px-2 py-2 text-right tabular-nums">{x.cenaZa100g !== null ? `${formatujCastku(x.cenaZa100g)} Kč` : "—"}</td>
              <td className="px-2 py-2">{x.obchod ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ok">
                {n.usetreno > 0 ? `−${formatujCastku(n.usetreno)} Kč` : "—"}
              </td>
              <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums font-semibold">{x.cenaZa100g !== null ? `${formatujCastku(n.cenaCelkem ?? 0)} Kč` : "—"}</td>
            </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-2">
            <td className="px-5 py-2 text-right font-semibold" colSpan={5}>{soucetPopisek}</td>
            <td className="px-5 py-2 text-right font-extrabold tabular-nums">{formatujCastku(celkem)} Kč</td>
          </tr>
        </tfoot>
      </table>
      </div>
      {(bezCeny > 0 || stariSouctu) && (
        <div className="border-t border-border bg-surface-2 px-5 py-2 text-xs text-muted">
          {bezCeny > 0 &&
            `${bezCeny} ${tvarPolozka} nemá známou cenu – součet zahrnuje jen oceněné položky.`}
          {stariSouctu &&
            `${bezCeny > 0 ? " " : ""}Ceny pozorovány ${stariSouctu} – ověřte aktuálnost v obchodě.`}
        </div>
      )}
    </Card>
  );
}

/** Mřížka karet jídel – sdílená pro denní plán i rozpis dne v týdenním plánu. */
function MrizkaJidel({
  jidelnicek,
  naVymenuJidla,
  naZapisDoDeniku,
}: {
  jidelnicek: Record<string, SouhrnJidla>;
  naVymenuJidla?: ((nazevJidla: string) => void) | undefined;
  /** zapíše celé jídlo do dnešního deníku (detail uloženého plánu) */
  naZapisDoDeniku?: ((nazevJidla: string) => void) | undefined;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(jidelnicek).map(([nazevJidla, souhrn]) => (
          <Card key={nazevJidla} className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold">{nazevJidla}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{formatujKcal(souhrn.kalorie)} kcal</span>
                {naZapisDoDeniku && souhrn.jidla.length > 0 && (
                  <button
                    onClick={() => naZapisDoDeniku(nazevJidla)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-primary"
                    title={`Zapsat ${nazevJidla.toLowerCase()} do dnešního deníku`}
                    aria-label={`Zapsat ${nazevJidla.toLowerCase()} do deníku`}
                  >
                    <NotebookPen className="size-4" />
                  </button>
                )}
                {naVymenuJidla && souhrn.jidla.length > 0 && (
                  <button
                    onClick={() => naVymenuJidla(nazevJidla)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-primary"
                    title={`Vyměnit ${nazevJidla.toLowerCase()} za jinou kombinaci`}
                    aria-label={`Vyměnit ${nazevJidla.toLowerCase()}`}
                  >
                    <RefreshCw className="size-4" />
                  </button>
                )}
              </span>
            </div>
            {souhrn.jidla.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Bez jídel</p>
            ) : (
              <ul className="divide-y divide-border">
                {souhrn.jidla.map((j, i) => (
                  <li key={`${j.id}-${i}`} className="px-4 py-3">
                    <div className="flex justify-between gap-2 text-sm font-medium">
                      <span className="flex min-w-0 items-center gap-2">
                        <MiniaturaPotraviny obrazek={j.obrazek} velikost="size-8" />
                        <span className="min-w-0">{j.nazev}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        {j.popisekMnozstvi ?? `${Math.round(j.gramy)} g`}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
                      <span>
                        B {formatujMakro(j.bilkoviny)} · S {formatujMakro(j.sacharidy)} · T {formatujMakro(j.tuky)} g
                      </span>
                      {j.sleva && <Badge tono="warning">SLEVA {j.obchod}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border px-4 py-2 text-xs text-muted">
              Cena jídla: <strong className="text-fg">{formatujCastku(souhrn.cena)} Kč</strong>
            </div>
          </Card>
        ))}
    </div>
  );
}

export function DenniVysledek({
  den,
  cile,
  naVymenu,
  naZapisDoDeniku,
}: {
  den: DenVysledek;
  cile: Cile;
  naVymenu?: ((nazevJidla: string) => void) | undefined;
  naZapisDoDeniku?: ((nazevJidla: string) => void) | undefined;
}) {
  const nakup = useMemo(() => sestavNakupniSeznam(den.jidelnicek), [den.jidelnicek]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrika nazev="Kalorie" hodnota={formatujKcal(den.celkem.kalorie)} cilyJednotka={`z ${formatujKcal(cile.kalorie)} kcal`} />
        <Metrika nazev="Bílkoviny" hodnota={formatujMakro(den.celkem.bilkoviny)} cilyJednotka={`z ${formatujMakro(cile.bilkoviny)} g`} />
        <Metrika nazev="Sacharidy" hodnota={formatujMakro(den.celkem.sacharidy)} cilyJednotka={`z ${formatujMakro(cile.sacharidy)} g`} />
        <Metrika nazev="Tuky" hodnota={formatujMakro(den.celkem.tuky)} cilyJednotka={`z ${formatujMakro(cile.tuky)} g`} />
      </div>

      <MrizkaJidel
        jidelnicek={den.jidelnicek}
        naVymenuJidla={naVymenu}
        naZapisDoDeniku={naZapisDoDeniku}
      />

      <KartaNakupu polozky={nakup} soucetPopisek="Celkem za den" />
    </div>
  );
}

export function TydennyVysledek({
  plan,
  cile,
  naVymenu,
  naZapisDoDeniku,
}: {
  plan: TydenniPlan;
  cile: Cile;
  naVymenu?: ((denIndex: number, nazevJidla: string) => void) | undefined;
  naZapisDoDeniku?: ((denIndex: number, nazevJidla: string) => void) | undefined;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrika nazev="Kalorie za týden" hodnota={formatujKcal(plan.tyden.kalorie)} cilyJednotka={`z ${formatujKcal(cile.kalorie * 7)} kcal`} />
        <Metrika nazev="Bílkoviny za týden" hodnota={formatujMakro(plan.tyden.bilkoviny)} cilyJednotka={`z ${formatujMakro(cile.bilkoviny * 7)} g`} />
        <Metrika nazev="Cena za týden" hodnota={formatujKc(plan.tyden.cena)} cilyJednotka="Kč za 7 dní" />
        <Metrika nazev="Ušetřeno slevami" hodnota={formatujKc(plan.tyden.cenaBezna - plan.tyden.cena)} cilyJednotka="Kč v rámci týdne" />
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <CardNadpis className="mb-0 flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" /> Rozpis dnů
          </CardNadpis>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(plan.dny).map(([den, vysledek]) => (
            <details key={den} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-sm font-medium transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted transition-transform group-open:rotate-90" />
                  {DENY[Number(den)] ?? den}
                </span>
                <span className="flex items-center gap-3 text-xs font-normal text-muted tabular-nums">
                  <span>{formatujKcal(vysledek.celkem.kalorie)} kcal</span>
                  <span>B {formatujMakro(vysledek.celkem.bilkoviny)} g</span>
                  <span className="hidden sm:inline">{formatujCastku(vysledek.celkem.cena)} Kč</span>
                </span>
              </summary>
              <div className="px-4 pb-4">
                <MrizkaJidel
                  jidelnicek={vysledek.jidelnicek}
                  naVymenuJidla={
                    naVymenu ? (nazevJidla) => naVymenu(Number(den), nazevJidla) : undefined
                  }
                  naZapisDoDeniku={
                    naZapisDoDeniku
                      ? (nazevJidla) => naZapisDoDeniku(Number(den), nazevJidla)
                      : undefined
                  }
                />
              </div>
            </details>
          ))}
        </div>
      </Card>

      <KartaNakupu polozky={plan.nakup} soucetPopisek="Celkem za týden" />
    </div>
  );
}
