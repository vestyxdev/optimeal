import { describe, expect, it } from "vitest";
import { formatujMnozstvi, spocitejNakupniBaleni } from "./nakupniBaleni";

describe("spocitejNakupniBaleni – balení a kusy", () => {
  it("20 g oleje → 1× 1 l (fallback typické velikosti)", () => {
    const b = spocitejNakupniBaleni({ nazev: "Olej slunečnicový", gramy: 20 });
    expect(b.popisek).toBe("1× 1 l");
    expect(b.nakoupeno).toBe(1000);
    expect(b.druh).toBe("baleni");
  });

  it("20 g olivového oleje → 1× 500 ml", () => {
    const b = spocitejNakupniBaleni({ nazev: "Olivový olej extra virgin", gramy: 20 });
    expect(b.popisek).toBe("1× 500 ml");
  });

  it("136 g těstovin → 1× 500 g", () => {
    const b = spocitejNakupniBaleni({ nazev: "Těstoviny špagety", gramy: 136 });
    expect(b.popisek).toBe("1× 500 g");
  });

  it("650 g těstovin → 2× 500 g (multi-pack)", () => {
    const b = spocitejNakupniBaleni({ nazev: "Těstoviny penne", gramy: 650 });
    expect(b.popisek).toBe("2× 500 g");
    expect(b.cenaCelkem).toBeNull(); // bez ceny → null
  });

  it("54 g housky → 1 ks", () => {
    const b = spocitejNakupniBaleni({ nazev: "Houska", gramy: 54 });
    expect(b.popisek).toBe("1 ks");
    expect(b.druh).toBe("ks");
  });

  it("156 g rohlíku → 4 ks (4×43=172)", () => {
    const b = spocitejNakupniBaleni({ nazev: "Rohlík", gramy: 156 });
    expect(b.popisek).toBe("4 ks");
    expect(b.nakoupeno).toBe(172);
  });

  it("kusovka s DB baleni_g – váha kusu z DB má přednost", () => {
    const b = spocitejNakupniBaleni({ nazev: "Rohlík", gramy: 156, baleniG: 50 });
    expect(b.popisek).toBe("4 ks"); // ceil(156/50)
    expect(b.nakoupeno).toBe(200);
  });

  it("DB balení 400 g má přednost před fallback tabulkou", () => {
    const b = spocitejNakupniBaleni({ nazev: "Tuňák ve vlastní šťávě", gramy: 200, baleniG: 400 });
    expect(b.popisek).toBe("1× 400 g");
  });

  it("vážené zboží → čisté kroky po 50 g, nikdy 333 g", () => {
    const b = spocitejNakupniBaleni({ nazev: "Kuřecí prso", gramy: 333 });
    expect(b.druh).toBe("vazene");
    expect(b.popisek).toBe("350 g");
    expect(b.nakoupeno).toBe(350);
  });

  it("cena = počet balení × velikost × cena/100 g", () => {
    // olej 39,90 Kč/l → 3,99 Kč/100 ml
    const b = spocitejNakupniBaleni({ nazev: "Olej", gramy: 20, cenaZa100g: 3.99 });
    expect(b.cenaCelkem).toBeCloseTo(39.9);
  });

  it("kusy: 4 rohlíky po 43 g × 0,45 Kč/100 g? reálně 6,19/100 g → 10,65 Kč", () => {
    const b = spocitejNakupniBaleni({ nazev: "Rohlík", gramy: 156, cenaZa100g: 6.19 });
    // 172 g × 0,0619 = 10,6468 → 10,65
    expect(b.cenaCelkem).toBeCloseTo(10.65, 2);
  });
});

describe("kusové jednoporcovky – regrese balenkových artefaktů", () => {
  it("45 g proteinové tyčinky → 1 ks, NIKDY „1× 500 g“", () => {
    const b = spocitejNakupniBaleni({ nazev: "Proteinová tyčinka Monsters", gramy: 45 });
    expect(b.druh).toBe("ks");
    expect(b.pocet).toBe(1);
    expect(b.popisek).toBe("1 ks");
    expect(b.nakoupeno).toBe(45);
  });

  it("artefakt baleniG=500 u tyčinky se ignoruje – kusová váha vyhraje", () => {
    const b = spocitejNakupniBaleni({ nazev: "Proteinová tyčinka Monsters", gramy: 45, baleniG: 500, cenaZa100g: 44 });
    expect(b.druh).toBe("ks");
    expect(b.pocet).toBe(1);
    expect(b.nakoupeno).toBe(45);
  });

  it("skutečná váha kusu z DB (baleniG ≤200) má přednost", () => {
    const b = spocitejNakupniBaleni({ nazev: "Tyčinka oříšková", gramy: 50, baleniG: 60 });
    expect(b.druh).toBe("ks");
    expect(b.velikost).toBe(60);
    expect(b.pocet).toBe(1); // 50/60 → 1 ks
  });

  it("130 g pudinku → 1 ks (kelímek ~150 g)", () => {
    const b = spocitejNakupniBaleni({ nazev: "Pudink vanilkový", gramy: 130 });
    expect(b.druh).toBe("ks");
    expect(b.pocet).toBe(1);
    expect(b.nakoupeno).toBe(150);
  });
});

describe("konzervy v oleji – regrese", () => {
  it("tuňák v oleji je konzerva 160 g, ne láhev oleje 1 l", () => {
    const b = spocitejNakupniBaleni({
      nazev: "Tuňák v rostlinném oleji a slaném nálevu (Giana)",
      gramy: 130,
      cenaZa100g: 35,
    });
    expect(b.druh).toBe("baleni");
    expect(b.jednotka).toBe("g");
    expect(b.velikost).toBe(160);
    expect(b.pocet).toBe(1);
    expect(b.popisek).toBe("1× 160 g");
  });

  it("sardinky v olivovém oleji jsou konzerva, ne 500 ml olej", () => {
    const b = spocitejNakupniBaleni({
      nazev: "Sardinky v olivovém oleji",
      gramy: 100,
    });
    expect(b.druh).toBe("baleni");
    expect(b.jednotka).toBe("g");
    expect(b.velikost).toBe(110);
  });

  it("samotný olivový olej zůstává lahví 500 ml", () => {
    const b = spocitejNakupniBaleni({
      nazev: "Olivový olej extra virgin",
      gramy: 100,
    });
    expect(b.druh).toBe("baleni");
    expect(b.jednotka).toBe("ml");
    expect(b.velikost).toBe(500);
  });

  it("slunečnicový olej zůstává lahví 1 l", () => {
    const b = spocitejNakupniBaleni({
      nazev: "Slunečnicový olej",
      gramy: 200,
    });
    expect(b.druh).toBe("baleni");
    expect(b.jednotka).toBe("ml");
    expect(b.velikost).toBe(1000);
  });
});

describe("formatujMnozstvi", () => {
  it("g → kg, ml → l, desetiny česky", () => {
    expect(formatujMnozstvi(500, "g")).toBe("500 g");
    expect(formatujMnozstvi(1000, "g")).toBe("1 kg");
    expect(formatujMnozstvi(1500, "g")).toBe("1,5 kg");
    expect(formatujMnozstvi(1000, "ml")).toBe("1 l");
    expect(formatujMnozstvi(250, "ml")).toBe("250 ml");
  });
});

describe("nulová potřeba – regrese", () => {
  it("potreba 0 g → 0 ks / 0 balení / 0 Kč (dřív se platilo 1 balení)", () => {
    const ks = spocitejNakupniBaleni({ nazev: "Rohlík", gramy: 0, cenaZa100g: 6 });
    expect(ks.pocet).toBe(0);
    expect(ks.cenaCelkem).toBe(0);
    const baleni = spocitejNakupniBaleni({ nazev: "Máslo", gramy: 0, baleniG: 250, cenaZa100g: 14 });
    expect(baleni.pocet).toBe(0);
    expect(baleni.cenaCelkem).toBe(0);
    const vazene = spocitejNakupniBaleni({ nazev: "Brokolice", gramy: 0, cenaZa100g: 4 });
    expect(vazene.nakoupeno).toBe(0);
    expect(vazene.cenaCelkem).toBe(0);
  });
});
