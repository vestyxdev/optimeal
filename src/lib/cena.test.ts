import { describe, expect, it } from "vitest";
import { formatujCenu } from "@/lib/cena";

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
