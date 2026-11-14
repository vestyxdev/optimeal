import { describe, expect, it } from "vitest";
import { parsujOffProdukty } from "@/lib/data/potraviny";

describe("parsujOffProdukty", () => {
  it("preferuje energy-kcal_100g a český název", () => {
    const v = parsujOffProdukty([
      {
        product_name: "Skyr natural",
        product_name_cs: "Skyr přírodní",
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
    });
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
