import { describe, expect, it } from "vitest";
import { nejlevnejsiObchod, porovnejObchody } from "@/lib/cenovka";
import { deduplikujPolozky } from "@/lib/data/nakup";
import type { CenaObchodu } from "@/lib/data/nakup";

function cena(
  obchodId: string,
  obchod: string,
  c: number,
  jeSleva = false,
): CenaObchodu {
  return { obchodId, obchod, cena: c, jeSleva, pozorovanoAt: "2026-03-01T00:00:00Z", baleniG: null, puvodniCena: null };
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
  // vážené názvy → čisté kroky 50 g, součty odpovídají surovým gramům
  const polozky = [
    { foodId: "f1", gramy: 100, nazev: "Kuřecí prso" },
    { foodId: "f2", gramy: 200, nazev: "Kuřecí stehno" },
    { foodId: "f3", gramy: 50, nazev: "Krůtí prso" },   // nikde oceněná – přeskakuje se
    { foodId: null, gramy: 100, nazev: "Sáčky" },       // ruční položka – přeskakuje se
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
    const v = porovnejObchody([{ foodId: "f3", gramy: 10, nazev: "Krůtí" }], hladiny);
    expect(v).toHaveLength(0);
  });

  it("usetreno sčítá jen ověřené původní ceny (slevy)", () => {
    const seSlevou: CenaObchodu = {
      ...cena("r1", "Rohlík", 8, true),
      puvodniCena: 10,
    };
    const mapa = new Map<string, CenaObchodu[]>([
      ["f1", [seSlevou, cena("r2", "Lidl", 9)]],
    ]);
    const v = porovnejObchody([{ foodId: "f1", gramy: 200, nazev: "Kuřecí prso" }], mapa);
    // 200 g × (10 − 8) Kč/100 g = 4 Kč úspory jen u Rohlíku
    expect(v.find((s) => s.obchodId === "r1")).toMatchObject({ celkem: 16, usetreno: 4 });
    expect(v.find((s) => s.obchodId === "r2")).toMatchObject({ celkem: 18, usetreno: 0 });
  });
});

describe("deduplikujPolozky", () => {
  const pol = (
    foodId: string | null,
    nazev: string,
    gramy: number,
    cenaZa100g: number | null = null,
    obchod: string | null = null,
    jeSleva = false,
  ) => ({ foodId, nazev, gramy, cenaZa100g, obchod, jeSleva });

  it("stejná potravina (foodId) se sečte přes gramy", () => {
    const v = deduplikujPolozky([
      pol("f1", "Kuřecí prsa", 200, 10, "Lidl"),
      pol("f1", "Kuřecí prsa", 300, 10, "Lidl"),
      pol("f2", "Rýže", 100, 4, "Penny"),
    ]);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ foodId: "f1", gramy: 500 });
  });

  it("u duplicit drží levnější nabídku + její obchod", () => {
    const v = deduplikujPolozky([
      pol("f1", "Kuřecí prsa", 200, 12, "Kaufland"),
      pol("f1", "Kuřecí prsa", 100, 8, "Lidl", true),
    ]);
    expect(v[0]).toMatchObject({ gramy: 300, cenaZa100g: 8, obchod: "Lidl", jeSleva: true });
  });

  it("oceněná položka doplní cenu neoceněné duplicity", () => {
    const v = deduplikujPolozky([
      pol("f1", "Kuřecí prsa", 200, null, null),
      pol("f1", "Kuřecí prsa", 100, 9, "Lidl"),
    ]);
    expect(v[0]).toMatchObject({ gramy: 300, cenaZa100g: 9, obchod: "Lidl" });
  });

  it("ruční položky bez foodId se slučují podle normalizovaného názvu", () => {
    const v = deduplikujPolozky([
      pol(null, "Sůl", 50),
      pol(null, "  sůl  ", 30),
      pol(null, "Pepř", 10),
    ]);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ nazev: "Sůl", gramy: 80 });
  });

  it("různé potraviny zůstanou oddělené", () => {
    const v = deduplikujPolozky([
      pol("f1", "A", 100),
      pol("f2", "B", 100),
      pol("f3", "C", 100),
    ]);
    expect(v).toHaveLength(3);
  });
});
