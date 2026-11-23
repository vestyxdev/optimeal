import { describe, expect, it } from "vitest";
import { filtrujKatalog } from "@/lib/katalog";
import type { KatalogPotravina } from "@/lib/data/potraviny";

function p(nazev: string, ean: string | null = null, kategorie = "ostatni"): KatalogPotravina {
  return {
    id: nazev,
    nazev,
    bilkoviny: 0,
    sacharidy: 0,
    tuky: 0,
    kalorie: 0,
    beznaCena: 0,
    aktualniCena: 0,
    obchod: null,
    sleva: false,
    kategorie,
    vytvoril: null,
    zdroj: "seed-v1",
    obrazek: null,
    ean,
    baleniLabel: null,
  };
}

const KATALOG = [
  p("Kuřecí prsa", "8590001", "maso_ryby"),
  p("Jogurt bílý", "8590002", "mlecne_vyrobky"),
  p("Rohlík", null, "peckoviny_obily"),
];

describe("filtrujKatalog", () => {
  it("filtruje podle názvu (case-insensitive)", () => {
    expect(filtrujKatalog(KATALOG, "kuřecí", "vse")).toHaveLength(1);
    expect(filtrujKatalog(KATALOG, "JOGURT", "vse")[0]?.nazev).toBe("Jogurt bílý");
  });

  it("číselný dotaz hledá i v EAN (naskenovaný kód najde potravinu)", () => {
    const v = filtrujKatalog(KATALOG, "8590002", "vse");
    expect(v).toHaveLength(1);
    expect(v[0]?.nazev).toBe("Jogurt bílý");
  });

  it("EAN s mezerami se normalizuje", () => {
    expect(filtrujKatalog(KATALOG, "859 0001", "vse")[0]?.nazev).toBe("Kuřecí prsa");
  });

  it("potravina bez EAN se podle kódu nenajde", () => {
    expect(filtrujKatalog(KATALOG, "9999999", "vse")).toHaveLength(0);
  });

  it("filtr kategorie + dotaz se kombinují", () => {
    expect(filtrujKatalog(KATALOG, "8590001", "mlecne_vyrobky")).toHaveLength(0);
    expect(filtrujKatalog(KATALOG, "8590001", "maso_ryby")).toHaveLength(1);
  });

  it("jenSlevy vrátí jen akční položky seřazené podle % slevy", () => {
    const kat = [
      { ...p("A"), sleva: true, slevaProcenta: 10 },
      { ...p("B"), sleva: false, slevaProcenta: null },
      { ...p("C"), sleva: true, slevaProcenta: 40 },
      { ...p("D"), sleva: true, slevaProcenta: null },
    ];
    const v = filtrujKatalog(kat, "", "vse", true);
    expect(v.map((x) => x.nazev)).toEqual(["C", "A", "D"]);
  });

  it("potraviny bez nutric (kalorie=0) jdou až za položky s makry", () => {
    const kat = [
      { ...p("Eshop chléb"), kalorie: 0 },
      { ...p("Ověřený chléb"), kalorie: 250 },
      { ...p("Eshop jogurt"), kalorie: 0 },
    ];
    const v = filtrujKatalog(kat, "", "vse");
    expect(v.map((x) => x.nazev)).toEqual([
      "Ověřený chléb",
      "Eshop chléb",
      "Eshop jogurt",
    ]);
  });

  it("u jenSlevy má % slevy přednost před nutricemi", () => {
    const kat = [
      { ...p("A"), sleva: true, slevaProcenta: 50, kalorie: 0 },
      { ...p("B"), sleva: true, slevaProcenta: 10, kalorie: 300 },
    ];
    const v = filtrujKatalog(kat, "", "vse", true);
    expect(v.map((x) => x.nazev)).toEqual(["A", "B"]);
  });

  it("hledání ignoruje diakritiku (kureci → kuřecí, mleko → mléko)", () => {
    const kat = [
      { ...p("Kuřecí prsa"), kalorie: 165 },
      { ...p("Mléko plnotučné"), kalorie: 66 },
      { ...p("Řecký jogurt"), kalorie: 100 },
    ];
    expect(filtrujKatalog(kat, "kureci", "vse")[0]?.nazev).toBe("Kuřecí prsa");
    expect(filtrujKatalog(kat, "mleko", "vse")[0]?.nazev).toBe("Mléko plnotučné");
    expect(filtrujKatalog(kat, "recky", "vse")[0]?.nazev).toBe("Řecký jogurt");
  });

  it("relevance: prefix > začátek slova > podřetězec", () => {
    const kat = [
      { ...p("Houskový rohlík"), kalorie: 1 },
      { ...p("Prohlíkový"), kalorie: 1 }, // „rohlik" uvnitř slova → jen podřetězec
      { ...p("Rohlík"), kalorie: 1 },
    ];
    const v = filtrujKatalog(kat, "rohlik", "vse");
    expect(v.map((x) => x.nazev)).toEqual([
      "Rohlík",
      "Houskový rohlík",
      "Prohlíkový",
    ]);
  });

  it("řazení 'jednotkova' podle Kč/100 g", () => {
    const kat = [
      { ...p("Drahá"), aktualniCena: 50, kalorie: 100 },
      { ...p("Levná"), aktualniCena: 5, kalorie: 100 },
      { ...p("Střední"), aktualniCena: 20, kalorie: 100 },
    ];
    const v = filtrujKatalog(kat, "", "vse", false, "jednotkova");
    expect(v.map((x) => x.nazev)).toEqual(["Levná", "Střední", "Drahá"]);
  });

  it("řazení 'cena' podle ceny balení (baleniG), vážené podle Kč/kg", () => {
    const kat = [
      { ...p("Balení velké"), aktualniCena: 10, baleniG: 500, kalorie: 100 }, // 50 Kč
      { ...p("Vážené"), aktualniCena: 4, baleniG: null, kalorie: 100 }, // 40 Kč/kg
      { ...p("Balení malé"), aktualniCena: 10, baleniG: 200, kalorie: 100 }, // 20 Kč
    ];
    const v = filtrujKatalog(kat, "", "vse", false, "cena");
    expect(v.map((x) => x.nazev)).toEqual(["Balení malé", "Vážené", "Balení velké"]);
  });

  it("řazení 'bilkovinyCena': nejvíc bílkovin za Kč nahoře, bez ceny na konec", () => {
    const kat = [
      { ...p("Bez ceny"), bilkoviny: 50, aktualniCena: 0, kalorie: 200 },
      { ...p("Top value"), bilkoviny: 22, aktualniCena: 11, kalorie: 165 }, // 200 g/100 Kč
      { ...p("Slabé"), bilkoviny: 5, aktualniCena: 20, kalorie: 200 }, // 25 g/100 Kč
    ];
    const v = filtrujKatalog(kat, "", "vse", false, "bilkovinyCena");
    expect(v.map((x) => x.nazev)).toEqual(["Top value", "Slabé", "Bez ceny"]);
  });
});
