import { describe, expect, it } from "vitest";
import { doladMakra, platnaMakra, spocitejCile } from "./cile";

/**
 * Klíčový invariant: kalorie == 4·B + 4·S + 9·T (100% bilance).
 * Testuje se na ručně ověřených případech + náhodných kombinacích.
 */

describe("spocitejCile – ručně ověřené případy", () => {
  it("muž 80 kg / 180 cm / 30 let, vsedě, udržení → 2140 kcal (Mifflin)", () => {
    // BMR = 10·80 + 6,25·180 − 5·30 + 5 = 1780; ×1,2 = 2136 → cíl 2140
    const c = spocitejCile({
      vahaKg: 80,
      vyskaCm: 180,
      vekRoku: 30,
      pohlavi: "m",
      aktivita: "sedava",
      cilTela: "udrzet",
    });
    expect(c.kalorie).toBe(2140);
    // 4·160 + 4·214 + 9·71 = 2135 → doladění s−1/t+1 → 2140
    expect(c).toEqual({ kalorie: 2140, bilkoviny: 160, sacharidy: 213, tuky: 72 });
  });

  it("žena 65 kg / 165 cm / 40 let, mírná, hubnutí → přesná bilance", () => {
    const c = spocitejCile({
      vahaKg: 65,
      vyskaCm: 165,
      vekRoku: 40,
      pohlavi: "z",
      aktivita: "mirna",
      cilTela: "zhubnout",
    });
    expect(4 * c.bilkoviny + 4 * c.sacharidy + 9 * c.tuky).toBe(c.kalorie);
    expect(platnaMakra(c)).toBe(true);
  });

  it("Katch-McArdle s údajem o tělesném tuku (90 kg, 20 %)", () => {
    const c = spocitejCile({
      vahaKg: 90,
      vyskaCm: 180,
      vekRoku: 40,
      pohlavi: "m",
      aktivita: "aktivni",
      cilTela: "udrzet",
      teloTukProcento: 20,
    });
    // LBM = 72 → BMR = 370 + 21,6·72 = 1925,2
    // cíl = 1925,2 · 1,55 = 2984,06 → 2980
    expect(c.kalorie).toBe(2980);
    expect(4 * c.bilkoviny + 4 * c.sacharidy + 9 * c.tuky).toBe(2980);
  });
});

describe("doladMakra – minimální zásah", () => {
  it("rozdíl 0 nemění makra", () => {
    // 4·50 + 4·50 + 9·20 = 580 – přesná bilance bez zásahu
    expect(doladMakra(580, 50, 50, 20)).toEqual({
      kalorie: 580,
      bilkoviny: 50,
      sacharidy: 50,
      tuky: 20,
    });
  });

  it("rozdíl 59 kcal doladí s+t a zachová cíl", () => {
    // 4·60 + 4·110 + 9·29 = 941, cíl 1000 → jediné řešení v rozsahu:
    // 4·(+8) + 9·(+3) = 59 → s 110+8 = 118, t 29+3 = 32
    const c = doladMakra(1000, 60, 110, 29);
    expect(c).toEqual({
      kalorie: 1000,
      bilkoviny: 60,
      sacharidy: 118,
      tuky: 32,
    });
    expect(4 * c.bilkoviny + 4 * c.sacharidy + 9 * c.tuky).toBe(1000);
  });

  it("rozdíl 5 kcal řeší levněji tuk+sacharid než hrubý posun", () => {
    // 4·160 + 4·214 + 9·71 = 2135, rozdíl 5: jediné řešení s cenou 2
    const c = doladMakra(2140, 160, 214, 71);
    expect(c.sacharidy).toBe(213);
    expect(c.tuky).toBe(72);
    expect(c.kalorie).toBe(2140);
  });
});

describe("invariant – 600 náhodných kombinací", () => {
  it("kalorie vždy == 4B + 4S + 9T", () => {
    const aktivity = ["sedava", "mirna", "aktivni", "velmi"] as const;
    const cile = ["zhubnout", "udrzet", "zhodnotit"] as const;

    for (let i = 0; i < 600; i++) {
      const vaha = 45 + Math.random() * 100; // 45–145 kg
      const vyska = 145 + Math.random() * 55; // 145–200 cm
      const vek = 15 + Math.random() * 60; // 15–75 let
      const pohlavi = Math.random() < 0.5 ? "m" : "z";
      const aktivita = aktivity[Math.floor(Math.random() * 4)] as (typeof aktivity)[number];
      const cil = cile[Math.floor(Math.random() * 3)] as (typeof cile)[number];
      const tuk =
        Math.random() < 0.5 ? null : Math.round((3 + Math.random() * 57) * 10) / 10;

      const c = spocitejCile({
        vahaKg: vaha,
        vyskaCm: vyska,
        vekRoku: vek,
        pohlavi,
        aktivita,
        cilTela: cil,
        teloTukProcento: tuk,
      });

      expect(4 * c.bilkoviny + 4 * c.sacharidy + 9 * c.tuky).toBe(c.kalorie);
    }
  });
});
