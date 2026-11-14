import { describe, expect, it } from "vitest";
import { sklonuj } from "@/lib/sklonovani";

describe("sklonuj", () => {
  it("1 → jednotné číslo", () => {
    expect(sklonuj(1, "položka", "položky", "položek")).toBe("položka");
  });

  it("2–4 → tvar pro 2–4", () => {
    expect(sklonuj(2, "položka", "položky", "položek")).toBe("položky");
    expect(sklonuj(4, "recept", "recepty", "receptů")).toBe("recepty");
  });

  it("0 a 5+ → množné číslo", () => {
    expect(sklonuj(0, "položka", "položky", "položek")).toBe("položek");
    expect(sklonuj(5, "porce", "porce", "porcí")).toBe("porcí");
    expect(sklonuj(21, "recept", "recepty", "receptů")).toBe("receptů");
  });
});
