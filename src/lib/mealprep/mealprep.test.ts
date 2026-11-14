import { describe, expect, it } from "vitest";
import { sestavMealprep, type MealprepVstup } from "@/lib/mealprep/mealprep";
import type { Potravina } from "@/lib/generator/generator";
import type { Recept } from "@/lib/data/recepty";

/** Testovací potraviny – ceny za 100 g, výživa za 100 g. */
const potravinyy: Potravina[] = [
  {
    id: "p-kuze", nazev: "Kuřecí prsa", bilkoviny: 31, sacharidy: 0, tuky: 3.5, kalorie: 165,
    beznaCena: 12, aktualniCena: 9.49, obchod: "Billa", sleva: true, kategorie: "maso_ryby",
  },
  {
    id: "p-ryze", nazev: "Rýže basmati", bilkoviny: 7, sacharidy: 78, tuky: 1, kalorie: 350,
    beznaCena: 4, aktualniCena: 4, obchod: null, sleva: false, kategorie: "suchary_testoviny",
  },
  {
    id: "p-brambory", nazev: "Brambory", bilkoviny: 2, sacharidy: 17, tuky: 0.1, kalorie: 77,
    beznaCena: 2, aktualniCena: 1.49, obchod: "Billa", sleva: true, kategorie: "ovoce_zelenina",
  },
  {
    id: "p-tvaroh", nazev: "Tvaroh polotučný", bilkoviny: 12, sacharidy: 4, tuky: 1.5, kalorie: 85,
    beznaCena: 6, aktualniCena: 4.49, obchod: "Tesco", sleva: true, kategorie: "mlecne_vyrobky",
  },
  {
    id: "p-bezceny", nazev: "Bez ceny", bilkoviny: 10, sacharidy: 10, tuky: 10, kalorie: 200,
    beznaCena: 0, aktualniCena: 0, obchod: null, sleva: false, kategorie: "ostatni",
  },
];

function recept(id: string, nazev: string, porce: number, suroviny: { foodId: string; gramyNaPorce: number }[]): Recept {
  return {
    id,
    userId: null,
    nazev,
    popis: null,
    kategorie: "hlavni",
    porce,
    casMinuty: 30,
    postup: "",
    zdroj: "test",
    suroviny: suroviny.map((s) => ({ foodId: s.foodId, nazev: "", gramyNaPorce: s.gramyNaPorce, poznamka: null })),
  };
}

const recepty: Recept[] = [
  recept("r-kuze-ryze", "Kuře s rýží", 2, [
    { foodId: "p-kuze", gramyNaPorce: 150 },
    { foodId: "p-ryze", gramyNaPorce: 80 },
  ]),
  recept("r-tvaroh", "Tvaroh mísa", 1, [
    { foodId: "p-tvaroh", gramyNaPorce: 200 },
    { foodId: "p-brambory", gramyNaPorce: 100 },
  ]),
  recept("r-bezceny", "S bezcennou surovinou", 2, [
    { foodId: "p-bezceny", gramyNaPorce: 100 },
  ]),
];

describe("sestavMealprep", () => {
  it("sečte gramy téže potraviny přes více receptů", () => {
    const vstupy: MealprepVstup[] = [
      { receptId: "r-kuze-ryze", porce: 4 },
      { receptId: "r-tvaroh", porce: 2 },
    ];
    const vysledek = sestavMealprep(vstupy, recepty, potravinyy);

    const brambory = vysledek.polozky.find((p) => p.id === "p-brambory");
    // jen recept „tvaroh mísa" má brambory: 100 g × 2 porce
    expect(brambory?.gramy).toBe(200);

    const kuze = vysledek.polozky.find((p) => p.id === "p-kuze");
    // 150 g × 4 porce
    expect(kuze?.gramy).toBe(600);
  });

  it("počítá ceny a úspory podle slev za 100 g", () => {
    const vysledek = sestavMealprep([{ receptId: "r-kuze-ryze", porce: 2 }], recepty, potravinyy);

    const kuze = vysledek.polozky.find((p) => p.id === "p-kuze");
    // 300 g × 9,49/100 = 28,47; bez slevy 12 → úspora 300 g × (12−9,49)/100 = 7,53
    expect(kuze?.cenaCelkem).toBeCloseTo(28.47, 2);
    expect(kuze?.usetreno).toBeCloseTo(7.53, 2);

    // rýže bez slevy → usetreno 0
    const ryze = vysledek.polozky.find((p) => p.id === "p-ryze");
    expect(ryze?.cenaCelkem).toBeCloseTo(6.4, 2);
    expect(ryze?.usetreno).toBe(0);
  });

  it("součty výživy odpovídají porcím a surovinám", () => {
    const vysledek = sestavMealprep([{ receptId: "r-kuze-ryze", porce: 2 }], recepty, potravinyy);

    // kuře: 300 g → 31·3 = 93 g bílkovin; rýže: 160 g → 7·1,6 = 11,2 → 104,2
    expect(vysledek.soucty.bilkoviny).toBeCloseTo(104.2, 1);
    // kalorie: kuře 165·3 = 495; rýže 350·1,6 = 560 → 1055
    expect(vysledek.soucty.kalorie).toBe(1055);
    expect(vysledek.porceCelkem).toBe(2);
    // detail receptu má kalorie na celý úsek (2 porce) = 1055
    expect(vysledek.detaily[0]?.kalorie).toBe(1055);
  });

  it("vynechá recepty s nulovou porcí a chybějící potraviny nezboří součet", () => {
    const vysledek = sestavMealprep(
      [
        { receptId: "r-kuze-ryze", porce: 0 },
        { receptId: "r-bezceny", porce: 2 },
      ],
      recepty,
      potravinyy,
    );

    expect(vysledek.porceCelkem).toBe(2);
    // bezcenná surovina: cena 0, ale výživa se počítá
    expect(vysledek.soucty.kalorie).toBe(400);
    expect(vysledek.chybejiciCeny).toEqual(["Bez ceny"]);
    // žádné nákupní položky (cenu neznáme)
    expect(vysledek.polozky).toHaveLength(0);
  });

  it("celkový nákup se rovná součtu cen za porce (úspory zahrnuty)", () => {
    const vstupy: MealprepVstup[] = [
      { receptId: "r-kuze-ryze", porce: 4 },
      { receptId: "r-tvaroh", porce: 2 },
    ];
    const vysledek = sestavMealprep(vstupy, recepty, potravinyy);

    const sumaNakupu = vysledek.polozky.reduce((s, p) => s + p.cenaCelkem, 0);
    expect(sumaNakupu).toBeCloseTo(vysledek.soucty.cena, 2);
  });

  it("prázdný vstup → prázdný výsledek", () => {
    const vysledek = sestavMealprep([], recepty, potravinyy);
    expect(vysledek.porceCelkem).toBe(0);
    expect(vysledek.polozky).toHaveLength(0);
    expect(vysledek.detaily).toHaveLength(0);
  });
});
