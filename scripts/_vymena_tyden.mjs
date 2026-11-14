import fs from "node:fs";
const p = "src/lib/generator/generator.ts";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("export function vymenJidloVTydnu")) {
  s += `
/**
 * Vymění jídlo v konkrétním dni týdenního plánu – deleguje na vymenJidlo
 * a přepočítá týdenní součty i sloučený nákupní seznam.
 */
export function vymenJidloVTydnu(
  potraviny: Potravina[],
  plan: TydenniPlan,
  denIndex: number,
  nazevJidla: string,
  cile: Cile,
  filtr: FiltrPotraviny | null = null,
): TydenniPlan | null {
  const den = plan.dny[denIndex];
  if (!den) return null;
  const novyDen = vymenJidlo(potraviny, den, nazevJidla, cile, filtr);
  if (novyDen === null) return null;

  const dny = { ...plan.dny, [denIndex]: novyDen };
  const spojeny: Record<string, SouhrnJidla> = {};
  const tyden: SouhrnJidlaBezJidel = {
    kalorie: 0,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    cena: 0,
    cenaBezna: 0,
  };
  for (const [d, v] of Object.entries(dny)) {
    tyden.kalorie += v.celkem.kalorie;
    tyden.bilkoviny += v.celkem.bilkoviny;
    tyden.sacharidy += v.celkem.sacharidy;
    tyden.tuky += v.celkem.tuky;
    tyden.cena += v.celkem.cena;
    tyden.cenaBezna += v.celkem.cenaBezna;
    for (const [nazev, souhrn] of Object.entries(v.jidelnicek)) {
      spojeny[\`\${d}-\${nazev}\`] = souhrn;
    }
  }
  tyden.bilkoviny = Math.round(tyden.bilkoviny * 10) / 10;
  tyden.sacharidy = Math.round(tyden.sacharidy * 10) / 10;
  tyden.tuky = Math.round(tyden.tuky * 10) / 10;
  tyden.cena = Math.round(tyden.cena * 100) / 100;
  tyden.cenaBezna = Math.round(tyden.cenaBezna * 100) / 100;

  return { dny, tyden, nakup: sestavNakupniSeznam(spojeny) };
}
`;
  fs.writeFileSync(p, s);
}
console.log("ok");
