import { describe, expect, it } from "vitest";
import { alergenyReceptu, spocitejRecept, type Recept } from "@/lib/data/recepty";
import type { Potravina } from "@/lib/generator/generator";

/* Čisté výpočty receptů – výživa na porci/celkem, cena ze živých cen,
 * alergeny z připojených potravin. Bez DB (potraviny předáme ručně). */

function p(
  id: string,
  nazev: string,
  bilkoviny: number,
  sacharidy: number,
  tuky: number,
  kalorie: number,
  cena: number,
  kategorie = "ostatni",
): Potravina {
  return {
    id,
    nazev,
    bilkoviny,
    sacharidy,
    tuky,
    kalorie,
    beznaCena: cena,
    aktualniCena: cena,
    obchod: null,
    sleva: false,
    kategorie,
  } as Potravina;
}

function recept(porce: number, suroviny: Recept["suroviny"]): Recept {
  return {
    id: "r1",
    userId: null,
    nazev: "Test",
    popis: null,
    kategorie: "hlavni",
    porce,
    casMinuty: null,
    postup: "",
    zdroj: "manual",
    suroviny,
  };
}

describe("spocitejRecept", () => {
  const KURE = p("a", "Kuře", 30, 0, 3, 150, 10, "maso");
  const RYZE = p("b", "Rýže", 7, 80, 1, 360, 4, "priloha");
  const potraviny = [KURE, RYZE];

  it("spočítá výživu celkem i na porci", () => {
    // 100 g kuře/porci + 80 g rýže/porci, 2 porce
    const r = recept(2, [
      { foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null },
      { foodId: "b", nazev: "Rýže", gramyNaPorce: 80, poznamka: null },
    ]);
    const v = spocitejRecept(r, potraviny);
    // kuře 200 g: 300 kcal, 60 B; rýže 160 g: 576 kcal, 11.2 B
    expect(v.celkem.kalorie).toBe(876);
    expect(v.celkem.bilkoviny).toBe(71.2);
    expect(v.naPorci.kalorie).toBe(438);
    expect(v.naPorci.bilkoviny).toBe(35.6);
  });

  it("cena se počítá z aktuální ceny", () => {
    const r = recept(1, [{ foodId: "a", nazev: "Kuře", gramyNaPorce: 200, poznamka: null }]);
    const v = spocitejRecept(r, potraviny);
    // 200 g × 10 Kč/100 g = 20 Kč
    expect(v.celkem.cena).toBe(20);
  });

  it("potravina bez ceny → chybejiciCeny, cena se nepočítá", () => {
    const bezCeny: Potravina = { ...KURE, aktualniCena: 0 };
    const r = recept(1, [{ foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null }]);
    const v = spocitejRecept(r, [bezCeny]);
    expect(v.chybejiciCeny).toEqual(["Kuře"]);
    expect(v.celkem.cena).toBe(0);
    // výživa se počítá i bez ceny
    expect(v.celkem.kalorie).toBe(150);
  });

  it("surovina mimo katalog se přeskočí", () => {
    const r = recept(1, [
      { foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null },
      { foodId: "neznama", nazev: "?", gramyNaPorce: 50, poznamka: null },
    ]);
    const v = spocitejRecept(r, potraviny);
    expect(v.celkem.kalorie).toBe(150);
  });

  it("dominujici kategorie je podle kalorií, nezávisle na ceně", () => {
    // rýže bez ceny, ale přináší víc kalorií → dominuje i tak (regrese:
    // dřív se počítala jen u oceněných potravin)
    const bezCenyR: Potravina = { ...RYZE, aktualniCena: 0 };
    const r = recept(1, [
      { foodId: "a", nazev: "Kuře", gramyNaPorce: 50, poznamka: null },
      { foodId: "b", nazev: "Rýže", gramyNaPorce: 200, poznamka: null },
    ]);
    const v = spocitejRecept(r, [KURE, bezCenyR]);
    expect(v.dominujici).toBe("priloha");
  });

  it("null potraviny → všechny suroviny se přeskočí", () => {
    const r = recept(2, [{ foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null }]);
    const v = spocitejRecept(r, null);
    expect(v.celkem.kalorie).toBe(0);
  });

  it("porce 0 → dělení nulou se neprovede, výsledky jsou konečné", () => {
    const r = recept(0, [{ foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null }]);
    const v = spocitejRecept(r, potraviny);
    // porce se ošetří na min. 1 – žádné NaN/Infinity
    for (const x of [v.naPorci.kalorie, v.naPorci.bilkoviny, v.naPorci.cena, v.celkem.cena]) {
      expect(Number.isFinite(x)).toBe(true);
    }
    expect(v.naPorci.kalorie).toBe(v.celkem.kalorie);
  });

  it("ocenenoSurovin/pocetSurovin odpovídá oceněným surovinám", () => {
    const bezCenyR: Potravina = { ...RYZE, aktualniCena: 0 };
    const r = recept(1, [
      { foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null },
      { foodId: "b", nazev: "Rýže", gramyNaPorce: 80, poznamka: null },
    ]);
    const v = spocitejRecept(r, [KURE, bezCenyR]);
    expect(v.ocenenoSurovin).toBe(1);
    expect(v.pocetSurovin).toBe(2);
  });

  it("podezreleKalorie označí potravinu s nesedícími kcal", () => {
    const podezrela = p("c", "Fake potravina", 1, 1, 1, 900, 5, "ostatni");
    const r = recept(1, [
      { foodId: "a", nazev: "Kuře", gramyNaPorce: 100, poznamka: null },
      { foodId: "c", nazev: "Fake", gramyNaPorce: 100, poznamka: null },
    ]);
    const v = spocitejRecept(r, [KURE, podezrela]);
    expect(v.podezreleKalorie).toEqual(["Fake potravina"]);
  });
});

describe("alergenyReceptu", () => {
  it("sjednotí alergeny všech surovin bez duplicit", () => {
    const r = recept(1, [
      { foodId: "a", nazev: "Mléko", gramyNaPorce: 100, poznamka: null, alergeny: ["mleko", "lepek"] },
      { foodId: "b", nazev: "Chléb", gramyNaPorce: 50, poznamka: null, alergeny: ["lepek"] },
      { foodId: "c", nazev: "Máslo", gramyNaPorce: 10, poznamka: null },
    ]);
    expect(alergenyReceptu(r).sort()).toEqual(["lepek", "mleko"]);
  });

  it("recept bez alergenů → prázdné pole", () => {
    const r = recept(1, [
      { foodId: "a", nazev: "Rýže", gramyNaPorce: 100, poznamka: null, alergeny: [] },
    ]);
    expect(alergenyReceptu(r)).toEqual([]);
  });

  it("jmenná síť doplní alergen i bez tagů (netagovaný retail scrape)", () => {
    const r = recept(1, [
      { foodId: "a", nazev: "Ementaler 45%", gramyNaPorce: 30, poznamka: null, alergeny: [] },
      { foodId: "b", nazev: "Špagety", gramyNaPorce: 80, poznamka: null, alergeny: [] },
    ]);
    expect(alergenyReceptu(r).sort()).toEqual(["lepek", "mleko"]);
  });

  it("jmenná síť respektuje frázové výjimky (arašídové máslo ≠ mléko)", () => {
    const r = recept(1, [
      { foodId: "a", nazev: "Arašídové máslo", gramyNaPorce: 20, poznamka: null, alergeny: [] },
      { foodId: "b", nazev: "Banán", gramyNaPorce: 100, poznamka: null, alergeny: [] },
    ]);
    expect(alergenyReceptu(r)).toEqual(["arasidy"]);
  });
});
