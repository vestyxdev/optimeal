// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KartaNakupu } from "@/components/jidelnicek/Vysledky";
import type { NakupniPolozka } from "@/lib/generator/generator";

afterEach(() => cleanup());

function polozka(x: Partial<NakupniPolozka>): NakupniPolozka {
  return {
    id: "f1",
    nazev: "Máslo",
    gramy: 250,
    cenaZa100g: 20,
    cenaBeznaZa100g: null,
    obchod: "Lidl",
    sleva: false,
    obrazek: null,
    baleniG: 250,
    cenaCelkem: 0,
    usetreno: 0,
    ...x,
  };
}

describe("KartaNakupu – slevy", () => {
  it("položka s ověřenou původní cenou ukáže úsporu v banneru", () => {
    // 250 g, akce 20 Kč/100 g místo 28 → nákup 250 g balení: 50 Kč, ušetří 20 Kč
    render(
      <KartaNakupu
        polozky={[polozka({ sleva: true, cenaBeznaZa100g: 28 })]}
        soucetPopisek="Celkem"
      />,
    );
    expect(screen.getByText(/šetříte\s+20,00\s+Kč/)).toBeTruthy();
    expect(screen.getAllByText("SLEVA").length).toBeGreaterThan(0);
  });

  it("položka bez ověřené původní ceny neukáže žádnou úsporu", () => {
    render(
      <KartaNakupu polozky={[polozka({})]} soucetPopisek="Celkem" />,
    );
    expect(screen.queryByText(/šetříte/)).toBeNull();
    expect(screen.queryByText("SLEVA")).toBeNull();
  });

  it("sleva bez původní ceny (jen flag) nevymyslí úsporu", () => {
    render(
      <KartaNakupu
        polozky={[polozka({ sleva: true, cenaBeznaZa100g: null })]}
        soucetPopisek="Celkem"
      />,
    );
    expect(screen.queryByText(/šetříte/)).toBeNull();
  });
});
