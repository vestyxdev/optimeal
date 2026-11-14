import { describe, expect, it } from "vitest";
import { filtrujKatalog } from "@/routes/Potraviny";
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
});
