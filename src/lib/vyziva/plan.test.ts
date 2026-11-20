import { describe, expect, it } from "vitest";
import {
  aktivitaZTreninku,
  bezttukaHmotnost,
  bilkovinyNaKg,
  cileZKcal,
  cileZGramu,
  korekceZTempa,
  odhadTerminu,
  rozsahTempa,
  spocitejBmr,
  spocitejKalibraci,
  spocitejPlan,
  spocitejTdee,
  PODLAHA_KCAL,
} from "./plan";
import { platnaMakra } from "./cile";

describe("spocitejBmr – Mifflin-St Jeor", () => {
  it("muž 80 kg / 180 cm / 30 let", () => {
    // 10·80 + 6,25·180 − 5·30 + 5 = 800+1125−150+5 = 1780
    expect(spocitejBmr({ vahaKg: 80, vyskaCm: 180, vekRoku: 30, pohlavi: "m" })).toBe(1780);
  });
  it("žena 60 kg / 165 cm / 28 let", () => {
    // 600+1031,25−140−161 = 1330,25
    expect(spocitejBmr({ vahaKg: 60, vyskaCm: 165, vekRoku: 28, pohlavi: "z" })).toBeCloseTo(1330.25);
  });
  it("Katch–McArdle při známém % tuku – 370 + 21,6·lbm", () => {
    // 80 kg, 20 % tuku → lbm 64 → 370+21,6·64 = 1752,4
    expect(spocitejBmr({ vahaKg: 80, vyskaCm: 180, vekRoku: 30, pohlavi: "m", teloTukProcento: 20 }))
      .toBeCloseTo(1752.4);
  });
  it("mimo mez 3–60 % nebo prázdné → Mifflin", () => {
    const v = { vahaKg: 80, vyskaCm: 180, vekRoku: 30, pohlavi: "m" as const };
    expect(spocitejBmr({ ...v, teloTukProcento: 61 })).toBe(1780);
    expect(spocitejBmr({ ...v, teloTukProcento: null })).toBe(1780);
  });
  it("bezttukaHmotnost – 80 kg / 20 % = 64 kg", () => {
    expect(bezttukaHmotnost(80, 20)).toBe(64);
    expect(bezttukaHmotnost(80, null)).toBeNull();
    expect(bezttukaHmotnost(80, undefined)).toBeNull();
    expect(bezttukaHmotnost(80, 70)).toBeNull();
  });
});

describe("spocitejTdee", () => {
  it("sedavá aktivita ×1,2", () => {
    expect(spocitejTdee({ vahaKg: 80, vyskaCm: 180, vekRoku: 30, pohlavi: "m", aktivita: "sedava" })).toBeCloseTo(2136);
  });
  it("tréninky se mapují na aktivitu", () => {
    expect(aktivitaZTreninku("0-2")).toBe("sedava");
    expect(aktivitaZTreninku("3-5")).toBe("aktivni");
    expect(aktivitaZTreninku("6+")).toBe("velmi");
  });
});

describe("korekceZTempa – 7700 kcal/kg", () => {
  it("0,5 kg/týden hubnutí → −550 kcal/den", () => {
    expect(korekceZTempa(0.5, "zhubnout")).toBeCloseTo(-550);
  });
  it("0,25 kg/týden nabírání → +275 kcal/den", () => {
    expect(korekceZTempa(0.25, "zhodnotit")).toBeCloseTo(275);
  });
  it("udržet → 0 i při zadaném tempu", () => {
    expect(korekceZTempa(0.5, "udrzet")).toBe(0);
  });
});

describe("rozsahTempa", () => {
  it("hubnutí 0,2–1,0 / nabírání 0,1–0,5 / udržet 0", () => {
    expect(rozsahTempa("zhubnout")).toEqual({ min: 0.2, max: 1.0, vychozi: 0.5 });
    expect(rozsahTempa("zhodnotit")).toEqual({ min: 0.1, max: 0.5, vychozi: 0.25 });
    expect(rozsahTempa("udrzet").max).toBe(0);
  });
});

describe("odhadTerminu", () => {
  const dnes = new Date("2026-11-20T00:00:00Z");
  it("5 kg za 0,5 kg/týden → +10 týdnů", () => {
    const t = odhadTerminu(90, 85, 0.5, "zhubnout", dnes)!;
    expect(t.getTime() - dnes.getTime()).toBeCloseTo(70 * 86400e3, -4);
  });
  it("udržet / bez cíle / nulové tempo → null", () => {
    expect(odhadTerminu(90, 85, 0.5, "udrzet", dnes)).toBeNull();
    expect(odhadTerminu(90, undefined, 0.5, "zhubnout", dnes)).toBeNull();
    expect(odhadTerminu(90, 90, 0.5, "zhubnout", dnes)).toBeNull();
  });
});

describe("spocitejPlan – kompletní plán", () => {
  const zaklad = {
    pohlavi: "m" as const,
    treninky: "3-5" as const,
    vekRoku: 30,
    vyskaCm: 180,
    vahaKg: 90,
  };

  it("hubnutí 90→85 kg, 0,5 kg/týden", () => {
    const p = spocitejPlan({ ...zaklad, cilTela: "zhubnout", cilovaVahaKg: 85, tempoKgTydne: 0.5 });
    // TDEE = 1780… ne: BMR pro 90 kg = 900+1125-150+5 = 1880; TDEE = 1880·1,55 = 2914
    expect(p.bmr).toBe(1880);
    expect(p.tdee).toBe(2914);
    // kcal cíl přesně 2914 − 550 = 2364
    expect(p.cile.kalorie).toBe(2364);
    // bílkoviny 2,2 g/kg cílové váhy = 85·2,2 = 187
    expect(p.cile.bilkoviny).toBe(187);
    // kalorie ≡ makra přesně
    expect(4 * p.cile.bilkoviny + 4 * p.cile.sacharidy + 9 * p.cile.tuky).toBe(p.cile.kalorie);
    expect(platnaMakra(p.cile)).toBe(true);
    expect(p.pouzitaPodlaha).toBe(false);
    expect(p.terminCile).not.toBeNull();
  });

  it("podlaha: extrémní deficit u ženy skončí na 1 200 kcal", () => {
    const p = spocitejPlan({
      pohlavi: "z",
      treninky: "0-2",
      vekRoku: 55,
      vyskaCm: 155,
      vahaKg: 50,
      cilTela: "zhubnout",
      cilovaVahaKg: 40,
      tempoKgTydne: 1.0,
    });
    // BMR = 500+968,75−275−161 = 1032,75; TDEE = 1239,3; −1100 → 139 → podlaha 1200
    expect(p.cile.kalorie).toBe(PODLAHA_KCAL.z);
    expect(p.pouzitaPodlaha).toBe(true);
    expect(platnaMakra(p.cile)).toBe(true);
  });

  it("nabírání svalů → surplus a 1,8 g/kg bílkovin", () => {
    const p = spocitejPlan({ ...zaklad, cilTela: "zhodnotit", cilovaVahaKg: 95, tempoKgTydne: 0.25 });
    expect(p.korekceKcal).toBe(275);
    expect(p.cile.kalorie).toBe(3189); // 2914+275 přesně
    expect(p.cile.bilkoviny).toBe(Math.round(95 * 1.8)); // 171
    expect(4 * p.cile.bilkoviny + 4 * p.cile.sacharidy + 9 * p.cile.tuky).toBe(p.cile.kalorie);
  });

  it("udržet → TDEE beze změny, bez termínu", () => {
    const p = spocitejPlan({ ...zaklad, cilTela: "udrzet" });
    expect(p.korekceKcal).toBe(0);
    expect(p.cile.kalorie).toBe(2914); // přesné TDEE, bez zaokrouhlení
    expect(p.cile.bilkoviny).toBe(180); // 90 kg × 2,0
    expect(p.terminCile).toBeNull();
  });

  it("tuky nikdy pod 0,7 g/kg – i při nízkých kcal", () => {
    const p = spocitejPlan({
      pohlavi: "m",
      treninky: "0-2",
      vekRoku: 40,
      vyskaCm: 175,
      vahaKg: 120,
      cilTela: "zhubnout",
      cilovaVahaKg: 80,
      tempoKgTydne: 1.0,
    });
    expect(p.cile.tuky).toBeGreaterThanOrEqual(Math.round(120 * 0.7));
    expect(p.cile.kalorie).toBeGreaterThanOrEqual(PODLAHA_KCAL.m);
  });
});

describe("spocitejKalibraci – naměřený TDEE z dat", () => {
  it("hubnutí 1 kg / 20 dní při příjmu 2 000 → TDEE 2 385", () => {
    // Δ = −1 kg → bilance −7700/20 = −385 → TDEE = 2000 − (−385) = 2385
    const k = spocitejKalibraci({ dnyDeniku: 15, prijemKcalDenne: 2000, zmenaVahyKg: -1, rozsahDni: 20 })!;
    expect(k.tdeeNamerene).toBeCloseTo(2385);
    expect(k.vaha).toBeGreaterThan(0);
    expect(k.vaha).toBeLessThanOrEqual(0.6);
  });
  it("málo dat → null", () => {
    expect(spocitejKalibraci({ dnyDeniku: 5, prijemKcalDenne: 2000, zmenaVahyKg: -1, rozsahDni: 20 })).toBeNull();
    expect(spocitejKalibraci({ dnyDeniku: 15, prijemKcalDenne: 2000, zmenaVahyKg: -1, rozsahDni: 5 })).toBeNull();
    expect(spocitejKalibraci({ dnyDeniku: 15, prijemKcalDenne: 0, zmenaVahyKg: -1, rozsahDni: 20 })).toBeNull();
  });
  it("nesmyslný výsledek → null; váha max 0,6 i s dlouhou historií", () => {
    expect(spocitejKalibraci({ dnyDeniku: 30, prijemKcalDenne: 2000, zmenaVahyKg: -20, rozsahDni: 14 })).toBeNull();
    const k = spocitejKalibraci({ dnyDeniku: 60, prijemKcalDenne: 2200, zmenaVahyKg: 0.5, rozsahDni: 90 })!;
    expect(k.vaha).toBe(0.6);
  });
});

describe("spocitejPlan – přesnost", () => {
  const zaklad = {
    pohlavi: "m" as const,
    treninky: "3-5" as const,
    vekRoku: 30,
    vyskaCm: 180,
    vahaKg: 90,
    cilTela: "udrzet" as const,
  };

  it("% tuku → Katch–McArdle a bílkoviny z beztuké hmotnosti", () => {
    const p = spocitejPlan({ ...zaklad, teloTukProcento: 30 });
    // lbm = 63 → BMR = 370+21,6·63 = 1730,8 → TDEE = 2682,7
    expect(p.rovnice).toBe("katch");
    expect(p.bmr).toBe(1731);
    // bílkoviny 2,0 g/kg z lbm 63 = 126, ne 180 z celé váhy
    expect(p.cile.bilkoviny).toBe(126);
    expect(platnaMakra(p.cile)).toBe(true);
  });

  it("kalibrace zamíchá naměřený TDEE váhou měření", () => {
    const bezKal = spocitejPlan(zaklad);
    const sKal = spocitejPlan({ ...zaklad, kalibrace: { tdeeNamerene: 3500, vaha: 0.5 } });
    // 2914·0,5 + 3500·0,5 = 3207
    expect(sKal.tdee).toBe(3207);
    expect(sKal.kalibrovano).toBe(true);
    expect(bezKal.kalibrovano).toBe(false);
  });
});

describe("ruční úpravy souhrnu", () => {
  it("cileZGramu – kcal = 4B+4S+9T", () => {
    const c = cileZGramu(150, 200, 60);
    expect(c.kalorie).toBe(600 + 800 + 540);
  });
  it("cileZKcal – gramy se doladí na požadované kcal", () => {
    const c = cileZKcal(2500, { kalorie: 2400, bilkoviny: 180, sacharidy: 200, tuky: 80 });
    expect(4 * c.bilkoviny + 4 * c.sacharidy + 9 * c.tuky).toBe(2500);
  });
  it("bilkovinyNaKg – deficit nejvíc, surplus nejmíň", () => {
    expect(bilkovinyNaKg("zhubnout")).toBeGreaterThan(bilkovinyNaKg("udrzet"));
    expect(bilkovinyNaKg("udrzet")).toBeGreaterThan(bilkovinyNaKg("zhodnotit"));
  });
});
