import { describe, expect, it } from "vitest";
import {
  dnesISO,
  makraProMnozstvi,
  podilNaCili,
  posunDen,
  sectiPrijem,
  nazevTypuJidla,
  type NovaPoznamka,
} from "./denik";

const kure: NovaPoznamka = {
  foodId: "f1",
  nazev: "Kuřecí maso pečené",
  obrazek: null,
  mnozstviG: 100,
  kalorie: 174.4,
  bilkoviny: 27,
  sacharidy: 0,
  tuky: 6.5,
};

describe("makraProMnozstvi", () => {
  it("100 g vrací snapshot beze změny", () => {
    expect(makraProMnozstvi(kure, 100)).toEqual({
      kalorie: 174.4,
      bilkoviny: 27,
      sacharidy: 0,
      tuky: 6.5,
    });
  });

  it("škáluje lineárně – 50 g je polovina", () => {
    const m = makraProMnozstvi(kure, 50);
    expect(m.kalorie).toBeCloseTo(87.2, 1);
    expect(m.bilkoviny).toBeCloseTo(13.5, 1);
  });

  it("0 g i záporné množství vrací nuly", () => {
    expect(makraProMnozstvi(kure, 0).kalorie).toBe(0);
    expect(makraProMnozstvi(kure, -30).kalorie).toBe(0);
  });

  it("zaokrouhluje na 1 desetinu", () => {
    const m = makraProMnozstvi({ kalorie: 33.33, bilkoviny: 1.11, sacharidy: 2.22, tuky: 0.37 }, 37);
    expect(m.kalorie).toBe(12.3);
    expect(m.tuky).toBe(0.1);
  });
});

describe("sectiPrijem", () => {
  it("prázdný den dává nuly", () => {
    expect(sectiPrijem([])).toEqual({ kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0 });
  });

  it("sčítá makra přes gramy více záznamů", () => {
    const chleb: NovaPoznamka = {
      foodId: "f2",
      nazev: "Chléb",
      obrazek: null,
      mnozstviG: 200,
      kalorie: 250,
      bilkoviny: 8,
      sacharidy: 45,
      tuky: 1.5,
    };
    const soucet = sectiPrijem([kure, chleb]);
    // kuře 100 g: 174,4 / chléb 200 g: 500 kcal → 674,4
    expect(soucet.kalorie).toBeCloseTo(674.4, 1);
    expect(soucet.bilkoviny).toBeCloseTo(27 + 16, 1);
    expect(soucet.sacharidy).toBeCloseTo(90, 1);
    expect(soucet.tuky).toBeCloseTo(9.5, 1);
  });
});

describe("podilNaCili", () => {
  it("vrací % podílu hodnoty na cíli (zaokrouhlené)", () => {
    expect(podilNaCili(174.4, 2329.9)).toBe(7);
    expect(podilNaCili(27, 160.7)).toBe(17);
  });

  it("nulový cíl nezpůsobí dělení nulou", () => {
    expect(podilNaCili(100, 0)).toBe(0);
    expect(podilNaCili(0, 0)).toBe(0);
  });
});

describe("dny", () => {
  it("dnesISO vrací YYYY-MM-DD", () => {
    expect(dnesISO(new Date(2026, 10, 19, 8, 21))).toBe("2026-11-19");
    expect(dnesISO(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("posunDen přechází přes hranice měsíce", () => {
    expect(posunDen("2026-11-19", 1)).toBe("2026-11-20");
    expect(posunDen("2026-11-01", -1)).toBe("2026-10-31");
    expect(posunDen("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("nazevTypuJidla", () => {
  it("mapuje klíč na český název", () => {
    expect(nazevTypuJidla("snidane")).toBe("Snídaně");
    expect(nazevTypuJidla("odpoledne")).toBe("Odpolední svačina");
  });
});
