import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { posunDen, sectiPrijem, type PoznamkaDeniku } from "@/lib/data/denik";
import { formatujKcal, formatujMakro } from "@/lib/cena";

/**
 * Trend příjmu za 7 dnů končících zvoleným dnem – sloupce kcal
 * oproti čáře denního cíle. Načítá se lazy (recharts mimo hlavní
 * bundle). Prázdné dny ukazují nulu – „nezapsáno“ je taky informace.
 */

const KRATKE_DNY = ["ne", "po", "út", "st", "čt", "pá", "so"];

export default function DenikTyden({
  poznamky,
  cilKcal,
  datum,
}: {
  poznamky: PoznamkaDeniku[];
  cilKcal: number;
  /** poslední (zvolený) den osy – YYYY-MM-DD */
  datum: string;
}) {
  const data = useMemo(() => {
    const dny = Array.from({ length: 7 }, (_, i) => posunDen(datum, i - 6));
    return dny.map((iso) => {
      const den = poznamky.filter((p) => p.zapsanoDne === iso);
      const m = sectiPrijem(den);
      const d = new Date(`${iso}T12:00:00`);
      return {
        iso,
        popisek: `${KRATKE_DNY[d.getDay()]} ${d.getDate()}.`,
        kalorie: Math.round(m.kalorie),
        bilkoviny: Math.round(m.bilkoviny * 10) / 10,
        sacharidy: Math.round(m.sacharidy * 10) / 10,
        tuky: Math.round(m.tuky * 10) / 10,
        nad: cilKcal > 0 && m.kalorie > cilKcal,
      };
    });
  }, [poznamky, cilKcal, datum]);

  const maData = data.some((d) => d.kalorie > 0);

  return (
    <section className="rounded-2xl bg-surface p-4" aria-label="Příjem za posledních 7 dnů">
      <h2 className="text-sm font-bold text-fg">Posledních 7 dnů</h2>
      <p className="mt-0.5 text-xs text-muted">
        {maData
          ? "Součet deníku za den oproti cíli – čárkovaná čára."
          : "Zatím žádné zápisy – graf se zaplní prvním záznamem."}
      </p>
      <div className="mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <XAxis
              dataKey="popisek"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              interval={0}
            />
            <YAxis hide domain={[0, (max: number) => Math.max(max, cilKcal) * 1.1]} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg">
                    <p className="font-bold tabular-nums">{formatujKcal(d.kalorie)} kcal</p>
                    <p className="tabular-nums text-muted">
                      B {formatujMakro(d.bilkoviny)} · S {formatujMakro(d.sacharidy)} · T{" "}
                      {formatujMakro(d.tuky)} g
                    </p>
                  </div>
                );
              }}
            />
            {cilKcal > 0 && (
              <ReferenceLine
                y={cilKcal}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <Bar dataKey="kalorie" radius={[5, 5, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.iso}
                  fill={
                    d.nad
                      ? "var(--danger)"
                      : d.iso === datum
                        ? "var(--accent)"
                        : "var(--primary)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
