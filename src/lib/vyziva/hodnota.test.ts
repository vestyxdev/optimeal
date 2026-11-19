import { describe, expect, it } from "vitest";
import {
  gramyBilkovinNa100Kc,
  kcNa10gBilkovin,
  kcNa1000Kcal,
  lisiSeKalorie,
  odhadKaloriiZMaker,
} from "@/lib/vyziva/hodnota";

describe("gramyBilkovinNa100Kc", () => {
  it("kuřecí prsa: 22 g/100 g za 11 Kč/100 g → 200 g/100 Kč", () => {
    expect(gramyBilkovinNa100Kc(22, 11)).toBe(200);
  });
  it("olej s 0 g bílkovin → 0 (fakt, ne chyba)", () => {
    expect(gramyBilkovinNa100Kc(0, 15)).toBe(0);
  });
  it("bez ceny / záporná cena → null", () => {
    expect(gramyBilkovinNa100Kc(22, 0)).toBeNull();
    expect(gramyBilkovinNa100Kc(22, -5)).toBeNull();
    expect(gramyBilkovinNa100Kc(22, Number.NaN)).toBeNull();
  });
  it("záporné bílkoviny → null", () => {
    expect(gramyBilkovinNa100Kc(-1, 10)).toBeNull();
  });
});

describe("kcNa10gBilkovin", () => {
  it("22 g/100 g za 11 Kč → 5 Kč za 10 g", () => {
    expect(kcNa10gBilkovin(22, 11)).toBe(5);
  });
  it("0 g bílkovin → null, ne Infinity", () => {
    expect(kcNa10gBilkovin(0, 10)).toBeNull();
  });
  it("bez ceny → null", () => {
    expect(kcNa10gBilkovin(22, 0)).toBeNull();
  });
});

describe("kcNa1000Kcal", () => {
  it("rýže 350 kcal/100 g za 3 Kč → 8,6 Kč/1000 kcal", () => {
    expect(kcNa1000Kcal(350, 3)).toBe(8.6);
  });
  it("0 kcal potravina → null, ne Infinity", () => {
    expect(kcNa1000Kcal(0, 10)).toBeNull();
  });
  it("bez ceny → null", () => {
    expect(kcNa1000Kcal(350, 0)).toBeNull();
  });
});

describe("odhadKaloriiZMaker + lisiSeKalorie", () => {
  it("4·B + 4·S + 9·T", () => {
    expect(odhadKaloriiZMaker(20, 30, 10)).toBe(290);
  });
  it("NaN/negativa se ignorují", () => {
    expect(odhadKaloriiZMaker(Number.NaN, 10, -5)).toBe(40);
  });
  it("uvedené kcal v toleranci → false", () => {
    // kuře: 165 kcal, odhad 4*21+4*0+9*4.5 ≈ 124.5 → 24 % rozdíl
    expect(lisiSeKalorie(165, 21, 0, 4.5)).toBe(false);
  });
  it("divoká odchylka → true (podezřelá data)", () => {
    expect(lisiSeKalorie(500, 1, 1, 1)).toBe(true);
  });
  it("nulové uvedené kcal → false (nic k porovnání)", () => {
    expect(lisiSeKalorie(0, 20, 30, 10)).toBe(false);
  });
});
