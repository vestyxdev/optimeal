import { describe, expect, it } from "vitest";
import { normalizujEan, parsujOffProdukty, parsujOffProduktyVice } from "@/lib/data/potraviny";

describe("parsujOffProdukty", () => {
  it("preferuje energy-kcal_100g a český název", () => {
    const v = parsujOffProdukty([
      {
        product_name: "Skyr natural",
        product_name_cs: "Skyr přírodní",
        image_small_url: "https://images.off.org/skyr.jpg",
        nutriments: {
          "energy-kcal_100g": 63,
          proteins_100g: 11,
          carbohydrates_100g: 4,
          fat_100g: 0.2,
        },
      },
    ]);
    expect(v).toEqual({
      nazev: "Skyr přírodní",
      kalorie: 63,
      bilkoviny: 11,
      sacharidy: 4,
      tuky: 0.2,
      obrazek: "https://images.off.org/skyr.jpg",
      alergeny: [],
      diety: [],
    });
  });

  it("mapuje OFF alergeny a dietní tagy na naše klíče", () => {
    const v = parsujOffProdukty([
      {
        product_name: "Skyr",
        nutriments: { "energy-kcal_100g": 63 },
        allergens_tags: ["en:milk"],
        traces_tags: ["en:nuts", "en:gluten"],
        ingredients_analysis_tags: ["en:vegetarian"],
      },
    ]);
    // traces („může obsahovat") bereme konzervativně jako alergen
    expect(v?.alergeny.sort()).toEqual(["lepek", "mleko", "orisky"]);
    expect(v?.diety).toEqual(["vegetariansky"]);
  });

  it("en:vegan znamená vegansky + vegetariansky; gluten-free label bez lepku → bezlepkovy", () => {
    const v = parsujOffProdukty([
      {
        product_name: "Rostlinný",
        nutriments: { "energy-kcal_100g": 50 },
        labels_tags: ["en:vegan", "en:gluten-free"],
      },
    ]);
    expect(v?.diety.sort()).toEqual(["bezlepkovy", "vegansky", "vegetariansky"]);
    // gluten-free label u produktu, který lepek DEKLARUJE, bezlepkovy nedá
    const v2 = parsujOffProdukty([
      {
        product_name: "Sporný",
        nutriments: { "energy-kcal_100g": 50 },
        allergens_tags: ["en:gluten"],
        labels_tags: ["en:gluten-free"],
      },
    ]);
    expect(v2?.diety).toEqual([]);
    expect(v2?.alergeny).toEqual(["lepek"]);
  });

  it("energy_100g je kJ – převádí na kcal (÷4,184)", () => {
    const v = parsujOffProdukty([
      {
        product_name: "Test",
        nutriments: { energy_100g: 418.4, proteins_100g: 5 },
      },
    ]);
    // 418,4 kJ = 100 kcal – NE 418 kcal (regrese: kJ se braly za kcal)
    expect(v?.kalorie).toBe(100);
  });

  it("přeskakuje produkty bez nutric nebo bez kladných kcal", () => {
    const v = parsujOffProdukty([
      { product_name: "Prázdný" },
      { product_name: "Nulový", nutriments: { "energy-kcal_100g": 0 } },
      {
        product_name: "Platný",
        nutriments: { "energy-kcal_100g": 250, fat_100g: 10 },
      },
    ]);
    expect(v?.nazev).toBe("Platný");
    expect(v?.kalorie).toBe(250);
  });

  it("přeskakuje produkty bez názvu", () => {
    const v = parsujOffProdukty([
      { nutriments: { "energy-kcal_100g": 100 } },
    ]);
    expect(v).toBeNull();
  });

  it("chybějící nutrienty vrací jako null (ne 0)", () => {
    const v = parsujOffProdukty([
      {
        product_name: "X",
        nutriments: { "energy-kcal_100g": 100 },
      },
    ]);
    expect(v).toMatchObject({
      kalorie: 100,
      bilkoviny: null,
      sacharidy: null,
      tuky: null,
    });
  });

  it("prázdný seznam produktů → null", () => {
    expect(parsujOffProdukty([])).toBeNull();
  });
});

describe("parsujOffProduktyVice", () => {
  it("vrátí všechny použitelné kandidáty a přeskočí neplatné", () => {
    const v = parsujOffProduktyVice([
      { product_name: "A", nutriments: { "energy-kcal_100g": 100 } },
      { product_name: "Bez nutric" },
      { product_name: "B", nutriments: { "energy-kcal_100g": 200 } },
      { product_name: "Nulová", nutriments: { "energy-kcal_100g": 0 } },
      { product_name: "C", nutriments: { energy_100g: 209.2 } },
    ]);
    expect(v.map((x) => x.nazev)).toEqual(["A", "B", "C"]);
    expect(v[2]?.kalorie).toBe(50); // 209,2 kJ ÷ 4,184
  });

  it("parsujOffProdukty je jen první kandidát", () => {
    const produkty = [
      { product_name: "První", nutriments: { "energy-kcal_100g": 100 } },
      { product_name: "Druhý", nutriments: { "energy-kcal_100g": 200 } },
    ];
    expect(parsujOffProdukty(produkty)?.nazev).toBe("První");
  });
});

describe("normalizujEan", () => {
  it("akceptuje EAN-13, EAN-8 a UPC-A (12 číslic)", () => {
    expect(normalizujEan("8590123456789")).toBe("8590123456789");
    expect(normalizujEan("12345678")).toBe("12345678");
    expect(normalizujEan("012345678905")).toBe("012345678905");
  });

  it("odstraní mezery a pomlčky z opsaného kódu", () => {
    expect(normalizujEan("859 0123 456 789")).toBe("8590123456789");
    expect(normalizujEan("859-0123-456-789")).toBe("8590123456789");
  });

  it("odmítá nečíselné znaky a špatné délky", () => {
    expect(normalizujEan("abc")).toBeNull();
    expect(normalizujEan("12345")).toBeNull();
    expect(normalizujEan("123456789012345")).toBeNull();
    expect(normalizujEan("")).toBeNull();
    expect(normalizujEan("859012345678a")).toBeNull();
  });
});
