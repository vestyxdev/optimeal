import fs from "node:fs";
const t = "src/lib/generator/generator.test.ts";
const s = fs.readFileSync(t, "utf8");
const novy = `
describe("tydenni rotace rodin", () => {
  it("kotva se mezi dny rotuje, kdyz existuje srovnatelna alternativa", () => {
    const katalog = [
      p("jerky1", "Susene maso hovezi", 45, 2, 4, 230, 90),
      p("kure", "Kureci prsa", 23, 0, 3, 110, 35),
      p("ryze", "Ryze", 7, 78, 0.6, 350, 8),
      p("houska", "Houska", 8, 52, 2, 280, 5),
      p("mandle", "Mandle", 21, 10, 52, 580, 60),
      p("syr", "Eidam", 26, 1, 28, 350, 45),
    ];
    const tyden = vygenerujTydenniPlan(katalog, CILE);
    const rodiny = new Set();
    for (const den of Object.values(tyden.dny)) {
      for (const souhrn of Object.values(den.jidelnicek)) {
        for (const j of souhrn.jidla) {
          if (/prsa|maso/i.test(j.nazev)) rodiny.add(j.nazev);
        }
      }
    }
    expect(rodiny.size).toBeGreaterThanOrEqual(2);
  });
});
`;
if (!s.includes("tydenni rotace rodin")) fs.writeFileSync(t, s + novy);
console.log("OK");
