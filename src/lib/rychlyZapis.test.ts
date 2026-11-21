import { describe, expect, it } from "vitest";
import { najdiPotravinu, parsujRychlyZapis } from "@/lib/rychlyZapis";

/**
 * Rychlý zápis – parser českého přirozeného textu.
 * 25+ reálných vstupů: jednotky, kusy, odměrky, chybějící
 * diakritika, vícenásobné věty.
 */

const p1 = (vstup: string) => parsujRychlyZapis(vstup)[0];

describe("parsujRychlyZapis – gramy a objemy", () => {
  it.each([
    ["200g kuřecí prsa", "kureci prsa", 200, null],
    ["200 g kuřecí prsa", "kureci prsa", 200, null],
    ["100g rýže", "ryze", 100, null],
    ["0,5 kg brambor", "brambor", 500, null],
    ["0.5kg rýže", "ryze", 500, null],
    ["1 kg mouky", "mouky", 1000, null],
    ["250 ml mléka", "mleka", 250, null],
    ["1 l mléka", "mleka", 1000, null],
    ["5 dkg šunky", "sunky", 50, null],
    ["3 dl smetany", "smetany", 300, null],
  ])("%s → %s g", (vstup, dotaz, gramy, jednotka) => {
    const p = p1(vstup);
    expect(p?.dotaz).toBe(dotaz);
    expect(p?.gramy).toBe(gramy);
    expect(p?.jednotka).toBe(jednotka);
    expect(p?.odhad).toBe(false);
  });
});

describe("parsujRychlyZapis – kusy a odměrky (odhad)", () => {
  it.each([
    ["2 vejce", "vejce", 110, "ks"],       // 2 × 55 g
    ["2x vejce", "vejce", 110, "ks"],
    ["3 rohlíky", "rohliky", 135, "ks"],   // 3 × 45 g
    ["1 kus rohlíku", "rohliku", 45, "ks"],
    ["2 ks banánů", "bananu", 240, "ks"],  // 2 × 120 g
    ["vejce", "vejce", 55, "ks"],          // samotná fráze → 1 ks
    ["lžíce olivového oleje", "olivoveho oleje", 15, "lzice"],
    ["2 lžíce másla", "masla", 30, "lzice"],
    ["lžička soli", "soli", 5, "lzicka"],
    ["hrnek ovesných vloček", "ovesnych vlocek", 250, "hrnek"],
    ["plátek sýra", "syra", 25, "platek"],
    ["2 plátky chleba", "chleba", 50, "platek"],
    ["hrst oříšků", "orisku", 30, "hrst"],
    ["stroužek česneku", "cesneku", 3, "strouzek"],
    ["kelímek jogurtu", "jogurtu", 150, "kelimek"],
  ])("%s → ~%s g (%s)", (vstup, dotaz, gramy, jednotka) => {
    const p = p1(vstup);
    expect(p?.dotaz).toBe(dotaz);
    expect(p?.gramy).toBe(gramy);
    expect(p?.jednotka).toBe(jednotka);
    expect(p?.odhad).toBe(true);
  });
});

describe("parsujRychlyZapis – české slovní zlomky", () => {
  it.each([
    ["půl litru mléka", "mleka", 500],
    ["půl kila mouky", "mouky", 500],
    ["čtvrt litru mléka", "mleka", 250],
    ["tři čtvrtě litru mléka", "mleka", 750],
    ["pul litru mleka", "mleka", 500], // bez diakritiky
  ])("%s → %s g", (vstup, dotaz, gramy) => {
    const p = p1(vstup);
    expect(p?.dotaz).toBe(dotaz);
    expect(p?.gramy).toBe(gramy);
    expect(p?.odhad).toBe(false);
  });
});

describe("parsujRychlyZapis – balení a nerozpoznané množství", () => {
  it("balení tvarohu → jednotka baleni, gramáž null (dohodí baleniG)", () => {
    const p = p1("balení tvarohu");
    expect(p?.dotaz).toBe("tvarohu");
    expect(p?.jednotka).toBe("baleni");
    expect(p?.gramy).toBeNull();
  });

  it("2 balení tvarohu → jednotka baleni", () => {
    const p = p1("2 balení tvarohu");
    expect(p?.jednotka).toBe("baleni");
  });

  it("máslo (bez KS mapy) → gramáž null", () => {
    const p = p1("máslo");
    expect(p?.gramy).toBeNull();
    expect(p?.odhad).toBe(false);
  });
});

describe("parsujRychlyZapis – vícenásobné věty", () => {
  it("čárky + plus + spojky a/i dělí klauzule", () => {
    const v = parsujRychlyZapis(
      "200g kuřecí prsa, 100 g rýže + 2 vejce a plátek sýra i 50g brokolice",
    );
    expect(v).toHaveLength(5);
    expect(v.map((x) => x.gramy)).toEqual([200, 100, 110, 25, 50]);
    expect(v.map((x) => x.dotaz)).toEqual([
      "kureci prsa", "ryze", "vejce", "syra", "brokolice",
    ]);
  });

  it("středník a & taky dělí", () => {
    const v = parsujRychlyZapis("100 g rýže; 200 g kuřete & banán");
    expect(v).toHaveLength(3);
  });

  it("prázdné části se přeskakují", () => {
    expect(parsujRychlyZapis(" , ,, ")).toHaveLength(0);
    expect(parsujRychlyZapis("")).toHaveLength(0);
  });

  it("klauzule bez rozpoznatelné fráze se zahodí", () => {
    const v = parsujRychlyZapis("200 g");
    expect(v).toHaveLength(0);
  });
});

describe("najdiPotravinu", () => {
  const katalog = [
    { nazev: "Kuřecí prsa" },
    { nazev: "Kuřecí stehna" },
    { nazev: "Rýže basmati" },
    { nazev: "Tvaroh polotučný" },
  ];

  it("diakritika-insenzitivní – kureci prsa najde Kuřecí prsa", () => {
    expect(najdiPotravinu(katalog, "kureci prsa")?.nazev).toBe("Kuřecí prsa");
  });

  it("přesnější fráze vítězí – kureci stehna ≠ Kuřecí prsa", () => {
    expect(najdiPotravinu(katalog, "kureci stehna")?.nazev).toBe("Kuřecí stehna");
  });

  it("bez shody → null", () => {
    expect(najdiPotravinu(katalog, "xyz neexistuje")).toBeNull();
    expect(najdiPotravinu(katalog, "")).toBeNull();
  });

  it("prázdný katalog → null", () => {
    expect(najdiPotravinu([], "vejce")).toBeNull();
  });
});
