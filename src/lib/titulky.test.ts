import { describe, expect, it } from "vitest";
import { titulekProCestu } from "@/lib/titulky";

describe("titulekProCestu", () => {
  it("přesné cesty vrací název sekce", () => {
    expect(titulekProCestu("/")).toBe("Přehled · OptiMeal");
    expect(titulekProCestu("/jidelnicek")).toBe("Jídelníček · OptiMeal");
    expect(titulekProCestu("/recepty")).toBe("Recepty · OptiMeal");
    expect(titulekProCestu("/ucet")).toBe("Můj účet · OptiMeal");
  });

  it("dynamické cesty mapuje na obecný název", () => {
    expect(titulekProCestu("/recepty/abc-123")).toBe("Recept · OptiMeal");
    expect(titulekProCestu("/recepty/abc-123/upravit")).toBe("Recept · OptiMeal");
    expect(titulekProCestu("/plany/xyz")).toBe("Plán · OptiMeal");
  });

  it("neznámá cesta vrací základní titulek", () => {
    expect(titulekProCestu("/neexistuje")).toBe("OptiMeal – jezte lépe, šetřete peníze");
  });
});
