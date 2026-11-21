import { describe, expect, it } from "vitest";
import { jeVeSpizi, type PolozkaSpize } from "@/lib/data/spiz";

const spiz: PolozkaSpize[] = [
  { foodId: "f-ryze", nazev: "Rýže" },
  { foodId: null, nazev: "Domácí marmeláda" },
];

describe("jeVeSpizi", () => {
  it("shoda přes foodId", () => {
    expect(jeVeSpizi(spiz, { foodId: "f-ryze", nazev: "Jiný název" })).toBe(true);
  });

  it("shoda přes název (ruční položka bez foodId)", () => {
    expect(jeVeSpizi(spiz, { foodId: null, nazev: "domácí marmeláda" })).toBe(true);
    expect(jeVeSpizi(spiz, { nazev: "  Domácí Marmeláda " })).toBe(true);
  });

  it("jiná potravina → false", () => {
    expect(jeVeSpizi(spiz, { foodId: "f-mouka", nazev: "Mouka" })).toBe(false);
    expect(jeVeSpizi(spiz, { nazev: "Mouka" })).toBe(false);
  });

  it("prázdná spíž → false", () => {
    expect(jeVeSpizi([], { foodId: "f-ryze", nazev: "Rýže" })).toBe(false);
  });
});
