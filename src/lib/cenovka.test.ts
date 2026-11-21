import { describe, expect, it } from "vitest";
import { nejlevnejsiObchod, optimalizujNakup, porovnejObchody } from "@/lib/cenovka";
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

  it("řadí od nejlepšího pokrytí, při shodě vítězí nižší součet", () => {
    const v = porovnejObchody(polozky, hladiny);
    // Rohlík pokryje 2 položky (20 Kč), Lidl jen 1 (8 Kč) – neúplný
    // košík nesmí vyhrát „nejlevnější" před kompletním nákupem
    expect(v[0]?.obchod).toBe("Rohlík");
    expect(v[1]?.obchod).toBe("Lidl");
  });

  it("při stejném pokrytí vítězí levnější košík", () => {
    const mapa = new Map<string, CenaObchodu[]>([
      ["f1", [cena("r1", "Rohlík", 12), cena("r2", "Lidl", 8)]],
      ["f2", [cena("r1", "Rohlík", 5), cena("r2", "Lidl", 9)]],
    ]);
    const v = porovnejObchody(
      [
        { foodId: "f1", gramy: 100, nazev: "Kuřecí prso" },
        { foodId: "f2", gramy: 200, nazev: "Kuřecí stehno" },
      ],
      mapa,
    );
    // Lidl: 8×1 + 9×2 = 26 · Rohlík: 12×1 + 5×2 = 22 → Rohlík levnější
    expect(v[0]?.obchod).toBe("Rohlík");
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

describe("optimalizujNakup", () => {
  const pol = (
    id: string,
    foodId: string | null,
    gramy = 100,
    baleniG: number | null = null,
  ) => ({ id, foodId, nazev: `Položka ${id}`, gramy, baleniG });

  const mapa = new Map<string, CenaObchodu[]>([
    ["f1", [cena("r1", "Rohlík", 20), cena("r2", "Lidl", 15)]],
    ["f2", [cena("r1", "Rohlík", 10), cena("r2", "Lidl", 12)]],
    ["f3", [cena("r2", "Lidl", 8)]],
  ]);
  const polozky = [pol("p1", "f1"), pol("p2", "f2"), pol("p3", "f3")];

  it("kusově – každá položka na globálně nejlevnější nabídku", () => {
    const v = optimalizujNakup(polozky, mapa, "kusove");
    expect(v.prirazeni.get("p1")?.obchod).toBe("Lidl");
    expect(v.prirazeni.get("p2")?.obchod).toBe("Rohlík");
    expect(v.prirazeni.get("p3")?.obchod).toBe("Lidl");
    expect(v.obchody.sort()).toEqual(["Lidl", "Rohlík"]);
    expect(v.pokryti).toBe(3);
    expect(v.cenitelnych).toBe(3);
    // 15 + 10 + 8 Kč/100 g × 100 g = 33 Kč
    expect(v.celkem).toBe(33);
  });

  it("jeden obchod – vítězí nejvyšší pokrytí, pak nejnižší účet", () => {
    const v = optimalizujNakup(polozky, mapa, "jeden");
    // Lidl pokryje všechny 3 položky → jediný plný obchod
    expect(v.obchody).toEqual(["Lidl"]);
    expect(v.pokryti).toBe(3);
    expect(v.celkem).toBe(35); // 15 + 12 + 8
    expect(v.prirazeni.get("p2")?.obchod).toBe("Lidl"); // ne Rohlík
  });

  it("dva obchody – vítězí pár s plným pokrytím a nejnižším účtem", () => {
    const v = optimalizujNakup(polozky, mapa, "dva");
    expect(v.obchody.sort()).toEqual(["Lidl", "Rohlík"]);
    expect(v.pokryti).toBe(3);
    // uvnitř páru se položka přiřadí levnějšímu obchodu: f2 → Rohlík
    expect(v.prirazeni.get("p2")?.obchod).toBe("Rohlík");
    expect(v.celkem).toBe(33);
  });

  it("nekrytá položka → prirazeni null, pokrytí < cenitelných", () => {
    const v = optimalizujNakup(
      [pol("p1", "f1"), pol("p9", "f9"), pol("px", null)],
      mapa,
      "jeden",
    );
    expect(v.cenitelnych).toBe(1); // f9 nemá nabídku, px nemá foodId
    expect(v.pokryti).toBe(1);
    // položka úplně bez nabídky se do mapy vůbec nedostane
    // (UI padne na snapshot/vlastní cenu)
    expect(v.prirazeni.has("p9")).toBe(false);
    expect(v.prirazeni.has("px")).toBe(false);
  });

  it("balenková cena – 250 g se počítá jako celé 500 g balení", () => {
    const baleni: CenaObchodu = { ...cena("r1", "Rohlík", 10), baleniG: 500 };
    const v = optimalizujNakup(
      [pol("p1", "f1", 250)],
      new Map([["f1", [baleni]]]),
      "jeden",
    );
    // 1 × 500 g balení à 50 Kč (ne 25 Kč za 250 g)
    expect(v.celkem).toBe(50);
  });

  it("prázdné nabídky – žádný obchod, nulový účet", () => {
    const v = optimalizujNakup([pol("p1", "f9")], new Map(), "jeden");
    expect(v.obchody).toEqual([]);
    expect(v.celkem).toBe(0);
    expect(v.pokryti).toBe(0);
    expect(v.cenitelnych).toBe(0);
  });
});
