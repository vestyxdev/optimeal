/**
 * Prstencový ukazatel podílu na cíli (SVG – lehké, bez recharts).
 * procenta > 100 se graficky ořízne na plný kruh, text ukáže pravdu.
 */
export function Prstenec({
  procenta,
  popisek,
  barva = "var(--warning)",
}: {
  procenta: number;
  /** text uprostřed – výchozí „+N %“ (deník: přidaná hodnota) */
  popisek?: string;
  barva?: string;
}) {
  const r = 15;
  const obvod = 2 * Math.PI * r;
  const zobrazeno = Math.min(100, Math.max(0, procenta));
  return (
    <div
      className="relative grid size-14 place-items-center"
      role="img"
      aria-label={`${procenta} % denního cíle`}
    >
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={barva} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${(zobrazeno / 100) * obvod} ${obvod}`}
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums text-fg">
        {popisek ?? `+${procenta}%`}
      </span>
    </div>
  );
}
