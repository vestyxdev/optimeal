import { describe, expect, it } from "vitest";
import {
  dnesISO,
  jidloPlanuNaPoznamku,
  kopiePoznamky,
  makraProMnozstvi,
  podilNaCili,
  posledniPredchoziDen,
  posunDen,
  sectiPrijem,
  nazevTypuJidla,
  typJidlaZNazvu,
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

describe("typJidlaZNazvu", () => {
  it("mapuje názvy jídel z generátoru plánu", () => {
    expect(typJidlaZNazvu("Snídaně")).toBe("snidane");
    expect(typJidlaZNazvu("Dopolední svačina")).toBe("svacina");
    expect(typJidlaZNazvu("Oběd")).toBe("obed");
    expect(typJidlaZNazvu("Večeře")).toBe("vecere");
    expect(typJidlaZNazvu("Druhá večeře")).toBe("vecere");
    expect(typJidlaZNazvu("Před spaním")).toBe("vecere");
    expect(typJidlaZNazvu("Cokoliv jiného")).toBe("ostatni");
  });

  it("odpolední a pozdní svačina vyhrají před obecnou svačinou", () => {
    expect(typJidlaZNazvu("Odpolední svačina")).toBe("odpoledne");
    expect(typJidlaZNazvu("Pozdní svačina")).toBe("odpoledne");
  });
});

describe("jidloPlanuNaPoznamku", () => {
  it("přepočte makra za porci na snapshot /100 g", () => {
    // 200 g porce, 330 kcal za porci → 165 kcal/100 g
    const p = jidloPlanuNaPoznamku({
      id: "f1",
      nazev: "Kuřecí prsa",
      gramy: 200,
      kalorie: 330,
      bilkoviny: 62,
      sacharidy: 0,
      tuky: 7.2,
      obrazek: null,
    });
    expect(p.foodId).toBe("f1");
    expect(p.mnozstviG).toBe(200);
    expect(p.kalorie).toBeCloseTo(165, 1);
    expect(p.bilkoviny).toBeCloseTo(31, 1);
    // zpětný přepočet = původní porce
    const m = makraProMnozstvi(p, p.mnozstviG);
    expect(m.kalorie).toBeCloseTo(330, 0);
    expect(m.bilkoviny).toBeCloseTo(62, 0);
  });

  it("nulová gramáž nespadne na dělení nulou", () => {
    const p = jidloPlanuNaPoznamku({
      id: "f2",
      nazev: "X",
      gramy: 0,
      kalorie: 10,
      bilkoviny: 1,
      sacharidy: 1,
      tuky: 1,
    });
    expect(p.mnozstviG).toBe(1);
  });
});

describe("kopiePoznamky", () => {
  const zdroj = {
    foodId: "f7",
    nazev: "Kobliha",
    obrazek: "https://img.cz/k.png",
    typJidla: "snidane" as const,
    mnozstviG: 90,
    kalorie: 400,
    bilkoviny: 5,
    sacharidy: 55,
    tuky: 17,
    zapsanoAt: "2026-11-18T07:30:00.000Z",
  };

  it("zkopíruje všechna data na nový den", () => {
    const k = kopiePoznamky(zdroj, "2026-11-20");
    expect(k.food_id).toBe("f7");
    expect(k.typ_jidla).toBe("snidane");
    expect(k.mnozstvi_g).toBe(90);
    expect(k.kalorie).toBe(400);
    expect(k.zapsano_dne).toBe("2026-11-20");
    expect(k.obrazek).toBe("https://img.cz/k.png");
  });

  it("přenese čas zápisu na nové datum", () => {
    const k = kopiePoznamky(zdroj, "2026-11-20");
    const t = new Date(k.zapsano_at);
    expect(t.getHours()).toBe(new Date(zdroj.zapsanoAt).getHours());
    expect(t.getMinutes()).toBe(new Date(zdroj.zapsanoAt).getMinutes());
    expect(k.zapsano_at.startsWith("2026-11-20")).toBe(true);
  });

  it("při nevalidním času použije poledne", () => {
    const k = kopiePoznamky({ ...zdroj, zapsanoAt: "nesmysl" }, "2026-11-20");
    expect(new Date(k.zapsano_at).getHours()).toBe(12);
  });
});

describe("posledniPredchoziDen", () => {
  const poz = (d: string) => ({ zapsanoDne: d });

  it("najde nejbližší předchozí den se záznamy", () => {
    const r = [poz("2026-11-15"), poz("2026-11-18"), poz("2026-11-18")];
    expect(posledniPredchoziDen(r, "2026-11-19")).toBe("2026-11-18");
  });

  it("přeskočí prázdné dny a vrátí starší naplněný", () => {
    const r = [poz("2026-11-15"), poz("2026-11-19")];
    expect(posledniPredchoziDen(r, "2026-11-20")).toBe("2026-11-19");
  });

  it("ignoruje záznamy ze stejného nebo budoucího dne", () => {
    const r = [poz("2026-11-19"), poz("2026-11-25")];
    expect(posledniPredchoziDen(r, "2026-11-19")).toBeNull();
  });

  it("prázdné okno → null", () => {
    expect(posledniPredchoziDen([], "2026-11-19")).toBeNull();
  });
});
