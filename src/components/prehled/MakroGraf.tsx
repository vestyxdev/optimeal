import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Cile } from "@/lib/vyziva/cile";

/**
 * Koláč rozložení energie v denním cíli (kcal podíly B/S/T).
 * Načítá se lazy – recharts nemá být v hlavním bundlu.
 */

const BARVY = {
  bilkoviny: "#2d6a4f",
  sacharidy: "#7fae3e",
  tuky: "#b45309",
};

export default function MakroGraf({ cile }: { cile: Cile }) {
  const data = [
    { nazev: "Bílkoviny", kcal: cile.bilkoviny * 4, barva: BARVY.bilkoviny },
    { nazev: "Sacharidy", kcal: cile.sacharidy * 4, barva: BARVY.sacharidy },
    { nazev: "Tuky", kcal: cile.tuky * 9, barva: BARVY.tuky },
  ].filter((d) => d.kcal > 0);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          dataKey="kcal"
          nameKey="nazev"
          innerRadius={40}
          outerRadius={62}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((d) => (
            <Cell key={d.nazev} fill={d.barva} />
          ))}
        </Pie>
        <Tooltip
          formatter={(hodnota) => [`${hodnota} kcal`, ""]}
          separator=""
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(hodnota: string) => <span style={{ fontSize: 12 }}>{hodnota}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
