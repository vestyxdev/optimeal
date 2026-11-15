import { describe, expect, it } from "vitest";
import { formatujCenu, formatujKcal, formatujMakro, formatujPlatnostDo } from "@/lib/cena";

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
});

