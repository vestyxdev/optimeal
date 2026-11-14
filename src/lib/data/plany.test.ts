import { describe, expect, it } from "vitest";
import { cenaPlanu, usporaPlanu } from "@/lib/data/plany";

/* Čisté funkce nad JSONB `data` uložených plánů – přijímají všechny
 * tři tvary výsledku (den=`celkem`, týden=`tyden`, mealprep=`soucty`)
 * a musí být odolné vůči poškozeným/úplně jiným datům. */

describe("usporaPlanu", () => {
  it("spočítá úsporu pro denní plán (klíč celkem)", () => {
    expect(usporaPlanu({ celkem: { cena: 80, cenaBezna: 100 } })).toBe(20);
  });

  it("spočítá úsporu pro týdenní plán (klíč tyden)", () => {
    expect(usporaPlanu({ tyden: { cena: 500.5, cenaBezna: 560 } })).toBe(59.5);
  });

  it("spočítá úsporu pro mealprep výsledek (klíč soucty)", () => {
    expect(usporaPlanu({ soucty: { cena: 200, cenaBezna: 250.25 } })).toBe(50.25);
  });

  it("zaokrouhlí na 2 desetinná místa", () => {
    expect(usporaPlanu({ celkem: { cena: 10.111, cenaBezna: 20.444 } })).toBe(10.33);
  });

  it("nikdy nevrací zápornou úsporu (dražší sleva = 0)", () => {
    expect(usporaPlanu({ celkem: { cena: 120, cenaBezna: 100 } })).toBe(0);
  });

  it.each([null, undefined, 42, "text", {}, { celkem: null }])(
    "odolí nečekaným datům: %j",
    (vstup) => expect(usporaPlanu(vstup)).toBe(0),
  );
});

describe("cenaPlanu", () => {
  it("vrátí aktuální cenu denního plánu", () => {
    expect(cenaPlanu({ celkem: { cena: 75.5 } })).toBe(75.5);
  });

  it("vrátí aktuální cenu týdenního plánu a mealprepu", () => {
    expect(cenaPlanu({ tyden: { cena: 300 } })).toBe(300);
    expect(cenaPlanu({ soucty: { cena: 123 } })).toBe(123);
  });

  it("preferuje celkem před tyden před soucty", () => {
    expect(cenaPlanu({ celkem: { cena: 1 }, tyden: { cena: 2 } })).toBe(1);
  });

  it.each([null, undefined, 0, {}, { celkem: {} }])(
    "odolí nečekaným datům: %j",
    (vstup) => expect(cenaPlanu(vstup)).toBe(0),
  );
});
