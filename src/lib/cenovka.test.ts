import { describe, expect, it } from "vitest";
import { nejlevnejsiObchod, porovnejObchody } from "@/lib/cenovka";
import type { CenaObchodu } from "@/lib/data/nakup";

function cena(
  obchodId: string,
  obchod: string,
  c: number,
  jeSleva = false,
): CenaObchodu {
  return { obchodId, obchod, cena: c, jeSleva, pozorovanoAt: "2026-03-01T00:00:00Z" };
}

describe("nejlevnejsiObchod", () => {
  it("vrátí null pro prázdné nebo chybějící hladiny", () => {
    expect(nejlevnejsiObchod(undefined)).toBeNull();
    expect(nejlevnejsiObchod([])).toBeNull();
  });

  it("vybere obchod s nejnižší cenou", () => {
    const h = [cena("r1", "Rohlík", 20), cena("r2", "Lidl", 15), cena("r3", "Kaufland", 18)];
    expect(nejlevnejsiObchod(h)?.obchod).toBe("Lidl");
  });
});

describe("porovnejObchody", () => {
  const hladiny = new Map<string, CenaObchodu[]>([
    ["f1", [cena("r1", "Rohlík", 10), cena("r2", "Lidl", 8)]],
    ["f2", [cena("r1", "Rohlík", 5)]],
  ]);
  const polozky = [
    { foodId: "f1", gramy: 100 },
    { foodId: "f2", gramy: 200 },
    { foodId: "f3", gramy: 50 },      // nikde oceněná – přeskakuje se
    { foodId: null, gramy: 100 },     // ruční položka – přeskakuje se
  ];

  it("spočítá součet jen z pokrytých položek a označí pokrytí", () => {
    const v = porovnejObchody(polozky, hladiny);
    const rohlik = v.find((s) => s.obchodId === "r1");
    const lidl = v.find((s) => s.obchodId === "r2");
    expect(rohlik).toMatchObject({ pokryti: 2, celkem: 20 }); // 10*1 + 5*2
    expect(lidl).toMatchObject({ pokryti: 1, celkem: 8 });
  });

  it("řadí od nejlevnějšího, při shodě vítězí lepší pokrytí", () => {
    const v = porovnejObchody(polozky, hladiny);
    expect(v[0]?.obchod).toBe("Lidl");
    expect(v[1]?.obchod).toBe("Rohlík");
  });

  it("obchod bez ceny se vůbec neobjeví", () => {
    const v = porovnejObchody([{ foodId: "f3", gramy: 10 }], hladiny);
    expect(v).toHaveLength(0);
  });
});
