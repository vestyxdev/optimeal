import { describe, expect, it } from "vitest";
import { formatujCastku, formatujCenu, formatujKcal, formatujKc, formatujMakro, formatujPlatnostDo, referencniCena, slevaProcenta } from "@/lib/cena";

describe("formatujCenu", () => {
  it("balené zboží → cena za balení + jednotková vedlejší", () => {
    const f = formatujCenu(8.3, 400); // 8,30/100 g × 400 g ≈ 33 Kč
    expect(f.hlavni).toBe("~33 Kč");
    expect(f.vedlejsi).toBe("8,30 Kč/100 g · 400 g");
  });

  it("vážené zboží (bez balení) → Kč/kg", () => {
    const f = formatujCenu(1.49, null); // brambory 1,49/100 g
    expect(f.hlavni).toBe("14,90 Kč/kg");
    expect(f.vedlejsi).toBeNull();
  });

  it("chybějící baleniG (undefined) → také za kg", () => {
    expect(formatujCenu(4.1).hlavni).toBe("41,00 Kč/kg");
  });

  it("nulová/záporná cena → pomlčka", () => {
    expect(formatujCenu(0, 500).hlavni).toBe("—");
    expect(formatujCenu(-3, 500).hlavni).toBe("—");
    expect(formatujCenu(0).vedlejsi).toBeNull();
  });

  it("nesmyslné hodnoty → pomlčka", () => {
    expect(formatujCenu(NaN, 400).hlavni).toBe("—");
    expect(formatujCenu(Infinity).hlavni).toBe("—");
  });

  it("baleni_g=0 se chová jako vážené zboží", () => {
    expect(formatujCenu(2, 0).hlavni).toBe("20,00 Kč/kg");
  });
});

describe("formatujPlatnostDo", () => {
  it("prázdný vstup → null", () => {
    expect(formatujPlatnostDo(null)).toBeNull();
    expect(formatujPlatnostDo(undefined)).toBeNull();
    expect(formatujPlatnostDo("")).toBeNull();
  });

  it("neplatné datum → null", () => {
    expect(formatujPlatnostDo("nesmysl")).toBeNull();
    expect(formatujPlatnostDo("2024-13-99")).toBeNull();
  });

  it("dnešek → „do dneška“", () => {
    const dnes = new Date();
    const iso = `${dnes.getFullYear()}-${String(dnes.getMonth() + 1).padStart(2, "0")}-${String(dnes.getDate()).padStart(2, "0")}`;
    expect(formatujPlatnostDo(iso)).toBe("do dneška");
  });

  it("jiný den → „do <den> <d>. <m>.“ s českou zkratkou", () => {
    // pevné datum v budoucnosti/minulosti – den v týdnu odvozený z Date
    const d = new Date("2030-06-19T00:00:00"); // středa
    expect(d.getDay()).toBe(3);
    expect(formatujPlatnostDo("2030-06-19")).toBe("do st 19. 6.");
  });
});

describe("formatujMakro", () => {
  it("zaokrouhlí na 1 des. místo s českou čárkou", () => {
    expect(formatujMakro(7.67)).toBe("7,7");
    expect(formatujMakro(73.33)).toBe("73,3");
    expect(formatujMakro(20)).toBe("20");
    expect(formatujMakro(0)).toBe("0");
  });
});

describe("formatujKcal", () => {
  it("zaokrouhlí na celé číslo", () => {
    expect(formatujKcal(453.33)).toBe("453");
    expect(formatujKcal(61.9)).toBe("62");
    expect(formatujKcal(170)).toBe("170");
  });

  it("tisíce oddělí česky (nedělitelnou mezerou)", () => {
    expect(formatujKcal(2450).replace(/\u00a0/g, " ")).toBe("2 450");
    expect(formatujKcal(17150.4).replace(/\u00a0/g, " ")).toBe("17 150");
  });
});

describe("formatujCastku", () => {
  it("2 des. místa s českou čárkou", () => {
    expect(formatujCastku(45.9)).toBe("45,90");
    expect(formatujCastku(33)).toBe("33,00");
    expect(formatujCastku(8.3)).toBe("8,30");
  });
});

describe("formatujKc", () => {
  it("celé koruny s českým oddělovačem tisíců", () => {
    expect(formatujKc(2450)).toBe(formatujKcal(2450));
    expect(formatujKc(33.6)).toBe("34");
    expect(formatujKc(0)).toBe("0");
  });
});

describe("referencniCena", () => {
  it("vrátí zdrojem ověřenou původní cenu nad aktuální", () => {
    expect(referencniCena(0.99, 2.02)).toBe(2.02);
    expect(referencniCena(1.33, 2.01)).toBe(2.01);
  });
  it("bez původní ceny → null (žádný odhad z mediánu)", () => {
    expect(referencniCena(1.33, null)).toBeNull();
    expect(referencniCena(5)).toBeNull();
  });
  it("původní cena nevyšší než akční → null", () => {
    expect(referencniCena(19.75, 4.49)).toBeNull();
    expect(referencniCena(43.89, 43.89)).toBeNull();
  });
  it("sleva pod ~1 % → null (stejně jako view)", () => {
    expect(referencniCena(10, 10.05)).toBeNull();
    expect(referencniCena(10, 10.1)).toBe(10.1);
  });
  it("původní nad 4× akční → null (pack-mismatch artefakt)", () => {
    expect(referencniCena(5.03, 20.13)).toBeNull(); // −75 %+
    expect(referencniCena(5.03, 20.12)).toBe(20.12); // těsně pod hranicí
  });
  it("neplatná aktuální cena → null", () => {
    expect(referencniCena(0, 10)).toBeNull();
    expect(referencniCena(-1, 10)).toBeNull();
    expect(referencniCena(NaN, 10)).toBeNull();
  });
  it("neplatná původní cena → null", () => {
    expect(referencniCena(1, NaN)).toBeNull();
    expect(referencniCena(1, Infinity)).toBeNull();
  });
});

describe("slevaProcenta", () => {
  it("stejný výpočet jako view: round((1 − cena/původní)·100)", () => {
    expect(slevaProcenta(0.99, 2.02)).toBe(51);
    expect(slevaProcenta(9.9, 19.8)).toBe(50);
    expect(slevaProcenta(7.7, 11)).toBe(30);
  });
  it("bez ověřené původní → null", () => {
    expect(slevaProcenta(1.33, null)).toBeNull();
    expect(slevaProcenta(0, 10)).toBeNull();
    expect(slevaProcenta(5.03, 20.13)).toBeNull(); // artefakt nad 4×
  });
});

