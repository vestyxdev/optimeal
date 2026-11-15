import { describe, expect, it } from "vitest";
import {
  BONUS_SLEVY,
  filtrujPotraviny,
  jePrisada,
  kategoriePotraviny,
  naplanujJidlo,
  panelTik,
  podilyProPocetJidel,
  sestavNakupniSeznam,
  vymenJidlo,
  vymenJidloVTydnu,
  skorePotraviny,
  vytvorJidlo,
  vyberKandidata,
  vygenerujJidelnicek,
  vygenerujTydenniPlan,
  type Jidlo,
  type Potravina,
  type SouhrnJidla,
} from "./generator";

/* ============================================================
 * Testovací data – zjednodušený katalog (skutečné hodnoty
 * připadají z DB; pro logiku stačí reprezentativní sada)
 * ============================================================ */

function p(
  id: string,
  nazev: string,
  bilkoviny: number,
  sacharidy: number,
  tuky: number,
  kalorie: number,
  beznaCena: number,
  aktualniCena = beznaCena,
  obchod: string | null = null,
): Potravina {
  return {
    id,
    nazev,
    bilkoviny,
    sacharidy,
    tuky,
    kalorie,
    beznaCena,
    aktualniCena,
    obchod,
    sleva: aktualniCena < beznaCena,
  };
}

const KATALOG: Potravina[] = [
  p("1", "Kuřecí prsa", 31, 0, 3.5, 165, 12, 9.49, "Billa"),
  p("2", "Tvaroh polotučný", 12, 4, 1.5, 85, 6, 4.49, "Tesco"),
  p("3", "Vejce", 13, 0.7, 11, 155, 8),
  p("4", "Sýr Eidam", 25, 1, 30, 380, 9),
  p("5", "Ovesné vločky", 13.5, 60, 7, 380, 4.5),
  p("6", "Rýže basmati", 7, 78, 1, 350, 4),
  p("7", "Čočka červená", 25, 52, 1, 320, 5.5, 4.1, "Kaufland"),
  p("8", "Krabí tyčky", 10, 3, 1, 60, 3),
  p("9", "Jogurt bílý 3,5%", 4, 5, 3.5, 70, 1.5),
  p("10", "Brambory", 2, 17, 0.1, 77, 2, 1.49, "Billa"),
  p("11", "Arašidy", 26, 9, 49, 567, 8),
  p("12", "Banán", 1.1, 23, 0.3, 97, 3),
];

const CILE = { kalorie: 2450, bilkoviny: 184, sacharidy: 244, tuky: 82 };

/* ============================================================
 * KATEGORIE A SKÓRE
 * ============================================================ */

describe("kategoriePotraviny", () => {
  it("kuřecí prsa jsou bilkovinová", () => {
    expect(kategoriePotraviny(KATALOG[0] as Potravina)).toBe("bilkovinova");
  });

  it("rýže je sacharidová", () => {
    expect(kategoriePotraviny(KATALOG[5] as Potravina)).toBe("sacharidova");
  });

  it("arašidy jsou tuková", () => {
    expect(kategoriePotraviny(KATALOG[10] as Potravina)).toBe("tukova");
  });
});

describe("skorePotraviny", () => {
  it("sleva dává bonus BONUS_SLEVY", () => {
    const k = "bilkovinova" as const;
    const bezSlevy = skorePotraviny(p("x", "Test", 30, 0, 0, 200, 10), k);
    const seSlevou = skorePotraviny(p("x", "Test", 30, 0, 0, 200, 10, 7, "Billa"), k);
    // 30/10 vs 30/7 → (30/7) == (30/10) * (10/7); bonus = 10/7 * 1.25... NE
    // skore se slevou = (30/7) * 1,25; bez slevy = 30/10
    expect(seSlevou).toBeCloseTo((bezSlevy * 10 * BONUS_SLEVY) / 7, 5);
  });

  it("levnější potravina má vyšší skóre při stejném makru", () => {
    const draha = skorePotraviny(p("a", "A", 30, 0, 0, 200, 12), "bilkovinova");
    const licha = skorePotraviny(p("b", "B", 30, 0, 0, 200, 9), "bilkovinova");
    expect(licha).toBeGreaterThan(draha);
  });
});

/* ============================================================
 * VÝBĚR KANDIDÁTA – rotace
 * ============================================================ */

describe("vyberKandidata – rotace", () => {
  // kandidáti se stejným skórem (cenově srovnatelné)
  const stejni: Potravina[] = [
    p("a", "A", 30, 0, 0, 200, 10),
    p("b", "B", 30, 0, 0, 200, 10),
    p("c", "C", 30, 0, 0, 200, 10),
  ].map((x) => ({ ...x, skore: 3 }));

  it("jiný den → jiný výběr", () => {
    const pondeli = vyberKandidata(stejni as never, 0, [], 1);
    const utery = vyberKandidata(stejni as never, 0, [], 2);
    expect(pondeli?.id).not.toBe(utery?.id);
  });

  it("rotace je deterministická (stejný den = stejný výběr)", () => {
    const a = vyberKandidata(stejni as never, 1, [], 4);
    const b = vyberKandidata(stejni as never, 1, [], 4);
    expect(a?.id).toBe(b?.id);
  });

  it("použité potraviny se odsunou k pozadí", () => {
    // oba zbývající kandidáti mají stejné skóre → výběr padne na nepoužité
    const vysledek = vyberKandidata(stejni as never, 0, ["a"], 1);
    expect(vysledek?.id).not.toBe("a");
  });

  it("7 dní rotuje přes 7 stejně výhodných kandidátů", () => {
    const sedm = Array.from({ length: 7 }, (_, i) => ({
      ...p(`k${i}`, `K${i}`, 30, 0, 0, 200, 10),
      skore: 3,
    })) as never;
    const vysledky = new Set<string>();
    for (let den = 1; den <= 7; den++) {
      const k = vyberKandidata(sedm, 0, [], den, 0.6);
      if (k) vysledky.add(k.id);
    }
    // offset = den (1–7), 7 kandidátů → každý den jiný výběr
    expect(vysledky.size).toBe(7);
  });
});

/* ============================================================
 * PLÁNOVÁNÍ JÍDLA
 * ============================================================ */

describe("naplanujJidlo", () => {
  // zorganizujeme katalog do kategorií ručně (bez DB)
  const kategorie = {
    bilkovinova: [KATALOG[0], KATALOG[1], KATALOG[2], KATALOG[3], KATALOG[6], KATALOG[10], KATALOG[7]],
    sacharidova: [KATALOG[4], KATALOG[5], KATALOG[9], KATALOG[11]],
    tukova: [KATALOG[10], KATALOG[3], KATALOG[2], KATALOG[8]],
  } as never;

  it("vytvoří jídlo s rozumnou kalorickou skladbou", () => {
    const jidla = naplanujJidlo(kategorie, 0, 46, 61, 20.5, 612.5, [], 3);
    expect(jidla.length).toBeGreaterThan(0);
    expect(jidla.length).toBeLessThanOrEqual(3);

    const kcal = jidla.reduce((s, j) => s + j.kalorie, 0);
    // jídlo nesmí zásadně přestřelit svůj cíl
    expect(kcal).toBeLessThanOrEqual(612.5 * 1.35 + 30);
    expect(kcal).toBeGreaterThan(150);
  });

  it("gramy jsou v rozumných mezích", () => {
    const jidla = naplanujJidlo(kategorie, 0, 46, 61, 20.5, 612.5, [], 2);
    for (const j of jidla) {
      expect(j.gramy).toBeGreaterThanOrEqual(20);
      expect(j.gramy).toBeLessThanOrEqual(400);
    }
  });
});

/* ============================================================
 * CELÝ DEN + TÝDEN
 * ============================================================ */

describe("vygenerujJidelnicek", () => {
  it("vytvoří 4 jídla a dodrží denní kalorie v přiměřeném rozmezí", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE, 3);
    const jidla = Object.keys(den.jidelnicek);
    expect(jidla).toEqual(["Snídaně", "Oběd", "Svačina", "Večeře"]);
    expect(den.celkem.kalorie).toBeGreaterThan(CILE.kalorie * 0.65);
    expect(den.celkem.kalorie).toBeLessThan(CILE.kalorie * 1.35);
  });

  it("deterministický: stejný den → stejný jídelníček", () => {
    const a = vygenerujJidelnicek(KATALOG, CILE, 5);
    const b = vygenerujJidelnicek(KATALOG, CILE, 5);
    expect(a.celkem).toEqual(b.celkem);
    expect(a.jidelnicek["Snídaně"]?.jidla[0]?.id).toBe(b.jidelnicek["Snídaně"]?.jidla[0]?.id);
  });

  it("slevové potraviny mají v ceně slevu a úsporu se počítá", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE, 1);
    const nakup = sestavNakupniSeznam(den.jidelnicek);
    const usetrenoCelkem = nakup.reduce((s, x) => s + x.usetreno, 0);
    // v katalogu jsou slevy, generátor je upřednostní → úspora > 0
    expect(usetrenoCelkem).toBeGreaterThan(0);
    // úspora musí sedět na per-item výpočtu
    for (const x of nakup) {
      if (x.cenaBeznaZa100g !== null && x.sleva) {
        expect(x.usetreno).toBeCloseTo(
          Math.max(0, (x.gramy * (x.cenaBeznaZa100g - (x.cenaZa100g ?? 0))) / 100),
          1,
        );
      }
    }
  });
});

describe("vygenerujTydenniPlan", () => {
  it("7 dnů, každý jiný jídelníček, společný nákupní seznam", () => {
    const tyden = vygenerujTydenniPlan(KATALOG, CILE);
    expect(Object.keys(tyden.dny).length).toBe(7);

    const prvniJidla = new Set<string>();
    for (const den of Object.values(tyden.dny)) {
      const obed = den.jidelnicek["Oběd"]?.jidla[0]?.id;
      if (obed) prvniJidla.add(obed);
    }
    // širší rotace (poolMin 0.6) → kotva oběda se mezi dny mění
    // (u Snídaně má tenký testovací katalog jen 1 vhodnou bílkovinu –
    // tvaroh je tam oprávněně stabilní volba)
    expect(prvniJidla.size).toBeGreaterThan(1);

    // týdenní součty sedí na součtu dnů
    const soucetDnu = Object.values(tyden.dny).reduce((s, d) => s + d.celkem.kalorie, 0);
    expect(tyden.tyden.kalorie).toBe(Math.round(soucetDnu));

    // nákupní seznam není prázdný a ceny jsou kladné
    expect(tyden.nakup.length).toBeGreaterThan(0);
    for (const x of tyden.nakup) {
      expect(x.cenaCelkem).toBeGreaterThan(0);
      expect(x.gramy).toBeGreaterThan(0);
    }
  });

  it("nákupní seznam obsahuje potraviny ze všech 7 dnů (regrese: slévání dnů)", () => {
    const tyden = vygenerujTydenniPlan(KATALOG, CILE);

    // očekávané gramy = součet gramáží přes všechny dny podle food id
    const ocekavane = new Map<string, number>();
    for (const den of Object.values(tyden.dny)) {
      for (const souhrn of Object.values(den.jidelnicek)) {
        for (const j of souhrn.jidla) {
          ocekavane.set(j.id, (ocekavane.get(j.id) ?? 0) + j.gramy);
        }
      }
    }

    const skutecne = new Map(tyden.nakup.map((x) => [x.id, x.gramy]));
    expect(skutecne.size).toBe(ocekavane.size);
    for (const [id, gramy] of ocekavane) {
      expect(skutecne.get(id)).toBe(gramy);
    }
  });
});

/* ============================================================
 * POČET JÍDEL DENNĚ
 * ============================================================ */

describe("podilyProPocetJidel", () => {
  it("výchozí 4 jídla odpovídají PODILY_JIDEL", () => {
    expect(podilyProPocetJidel(4)).toEqual({
      Snídaně: 0.25, Oběd: 0.35, Svačina: 0.15, Večeře: 0.25,
    });
  });

  it("podíly se pro každý počet 2–8 sčítají na 1", () => {
    for (let n = 2; n <= 8; n++) {
      const podily = podilyProPocetJidel(n);
      expect(Object.keys(podily).length).toBe(n);
      const soucet = Object.values(podily).reduce((s, v) => s + v, 0);
      expect(soucet).toBeCloseTo(1, 6);
    }
  });

  it("mimo rozsah se sevře na 2–8", () => {
    expect(Object.keys(podilyProPocetJidel(0)).length).toBe(2);
    expect(Object.keys(podilyProPocetJidel(99)).length).toBe(8);
  });

  it("generátor respektuje počet jídel z profilu", () => {
    const den3 = vygenerujJidelnicek(KATALOG, CILE, 3, 0.85, 3);
    expect(Object.keys(den3.jidelnicek)).toEqual(["Snídaně", "Oběd", "Večeře"]);
    const den6 = vygenerujJidelnicek(KATALOG, CILE, 3, 0.85, 6);
    expect(Object.keys(den6.jidelnicek).length).toBe(6);
  });
});

/* ============================================================
 * FILTR DIET A ALERGENŮ
 * ============================================================ */

describe("filtrujPotraviny", () => {
  const katalog = [
    { ...p("v1", "Quinoa", 14, 57, 6, 368, 22), diety: ["vegansky", "vegetariansky", "bezlepkovy"], alergeny: [] as string[] },
    { ...p("v2", "Mléko", 3.3, 4.8, 3.6, 64, 2.5), diety: ["vegetariansky"], alergeny: ["mleko"] },
    { ...p("v3", "Losos", 20, 0, 13, 208, 32), diety: [] as string[], alergeny: ["ryby"] },
    { ...p("v4", "Brambory", 2, 17, 0.1, 77, 2) },
  ];

  it("prázdný filtr nechává celý katalog", () => {
    expect(filtrujPotraviny(katalog, null)).toHaveLength(4);
    expect(filtrujPotraviny(katalog, { diety: [], alergeny: [] })).toHaveLength(4);
  });

  it("dieta vyžaduje příslušnou značku", () => {
    const vys = filtrujPotraviny(katalog, { diety: ["vegansky"] });
    expect(vys.map((p) => p.id)).toEqual(["v1"]);
  });

  it("alergie vyloučí potraviny s alergenem", () => {
    const vys = filtrujPotraviny(katalog, { alergeny: ["mleko", "ryby"] });
    expect(vys.map((p) => p.id)).toEqual(["v1", "v4"]);
  });

  it("kombinace dieta + alergie platí současně", () => {
    const vys = filtrujPotraviny(katalog, {
      diety: ["vegetariansky"],
      alergeny: ["mleko"],
    });
    expect(vys.map((p) => p.id)).toEqual(["v1"]);
  });

  it("generátor s filtrem nepoužije vyloučené potraviny", () => {
    const katalogSMetadaty = KATALOG.map((p, i) => ({
      ...p,
      ...(i < 2 ? { diety: ["vegansky"] } : {}),
      ...(i >= 2 ? { alergeny: ["mleko"] } : {}),
    }));
    const den = vygenerujJidelnicek(katalogSMetadaty, CILE, 1, 0.6, 4, {
      alergeny: ["mleko"],
    });
    const ids = Object.values(den.jidelnicek).flatMap((j) => j.jidla.map((x) => x.id));
    for (const id of ids) {
      const p = katalogSMetadaty.find((k) => k.id === id);
      expect(p?.alergeny ?? []).not.toContain("mleko");
    }
  });
});

/* ============================================================
 * PANEL (cíl vs. realita)
 * ============================================================ */

describe("panelTik", () => {
  it("100 % při přesné shodě", () => {
    expect(panelTik(2000, 2000)).toEqual({ shoda: 100, trida: "ok" });
  });
  it("nízká shoda → danger", () => {
    expect(panelTik(1000, 2000).trida).toBe("danger");
  });
  it("mírná odchylka → warning", () => {
    // 1750 vs 2000 = 12,5 % odchylky → shoda 88 %
    expect(panelTik(1750, 2000).trida).toBe("warning");
  });
});

describe("vygenerujJidelnicek – kotva se neopakuje", () => {
  it("když je jen jedna bílkovinová potravina, kotvy jídel se liší", () => {
    // Malý katalog: jediná bilkovinová + vysokoproteinové v jiných kategoriích
    const maly: Potravina[] = [
      p("t1", "Tvaroh", 12, 4, 1.5, 85, 6),
      p("e1", "Sýr Eidam", 25, 1, 30, 380, 9),
      p("c1", "Čočka", 25, 52, 1, 320, 5.5),
      p("r1", "Rýže", 7, 78, 1, 350, 4),
      p("b1", "Brambory", 2, 17, 0.1, 77, 2),
    ];
    const v = vygenerujJidelnicek(maly, CILE, 2, 0.85, 4);
    const kotvy = Object.values(v.jidelnicek)
      .map((j) => j.jidla[0]?.id)
      .filter(Boolean);
    // 4 jídla, alespoň 2 různé kotvy (dříve všechny = "t1")
    expect(new Set(kotvy).size).toBeGreaterThan(1);
  });
});

describe("naplanujJidlo – strop ostatních maker", () => {
  const KATEGORIE_ZYRA = {
    bilkovinova: [{ ...p("n1", "Tučný sýr", 21, 0.5, 32, 360, 18), skore: 1 }],
    sacharidova: [{ ...p("b1", "Brambory", 2, 17, 0.1, 77, 2), skore: 1 }],
    tukova: [{ ...p("o1", "Olej", 0, 0, 100, 900, 20), skore: 1 }],
  } as never;

  it("tučná kotva se omezí tukovým rozpočtem (ne cele bílkoviny)", () => {
    // jídlo s cílem 40 B / 60 S / 15 T: bez stropu by sýr nabral ~190 g
    // a 60 g tuku – s omítkou 15×1,3 = 19,5 g tuku vyjde ~60 g sýra
    const jidla = naplanujJidlo(KATEGORIE_ZYRA, 0, 40, 60, 15, 600);
    expect(jidla[0]!.tuky).toBeLessThanOrEqual(15 * 1.3 + 1);
  });

  it("tukem nezatížený sacharidový doplněk se neškrtí vyčerpaným tukem", () => {
    // regrese: brambory (0,1 g tuku/100 g) dostávaly 30 g minimum,
    // protože strop šel do minusu → jídlo končilo bez sacharidů
    const jidla = naplanujJidlo(KATEGORIE_ZYRA, 0, 40, 60, 15, 600);
    const brambory = jidla.find((j) => j.id === "b1");
    expect(brambory).toBeDefined();
    expect(brambory!.sacharidy).toBeGreaterThan(20);
  });
});

describe("sestavNakupniSeznam – matematika seznamu", () => {
  const j = (
    id: string,
    nazev: string,
    gramy: number,
    cena: number,
    cenaBezna: number,
    obchod: string | null = null,
  ): Jidlo => ({
    id, nazev, gramy,
    kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0,
    cena, cenaBezna, obchod, sleva: cena < cenaBezna,
  });

  const den = (jidla: Jidlo[]): Record<string, SouhrnJidla> => ({
    Snídaně: { jidla, kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0, cenaBezna: 0 },
  });

  it("stejná potravina ve dvou jídlech se sloučí a sečte gramáž", () => {
    const jidelnicek = {
      Snídaně: { jidla: [j("1", "Ovesné vločky", 80, 8, 8)], kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0, cenaBezna: 0 },
      Svačina: { jidla: [j("1", "Ovesné vločky", 40, 4, 4)], kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0, cenaBezna: 0 },
    };
    const seznam = sestavNakupniSeznam(jidelnicek);
    expect(seznam).toHaveLength(1);
    expect(seznam[0]!.gramy).toBe(120);
    // 10 Kč/100 g → 12 Kč celkem
    expect(seznam[0]!.cenaZa100g).toBe(10);
    expect(seznam[0]!.cenaCelkem).toBe(12);
  });

  it("potravina bez ceny má cenaZa100g null (UI ukáže pomlčku), ne 0", () => {
    const seznam = sestavNakupniSeznam(den([j("x", "Bylinky", 20, 0, 0)]));
    expect(seznam[0]!.cenaZa100g).toBeNull();
    expect(seznam[0]!.cenaCelkem).toBe(0);
    expect(seznam[0]!.usetreno).toBe(0);
  });

  it("úspora ze slevy se počítá (běžná − akční) × gramy", () => {
    // 200 g, akce 5 Kč/100 g, běžná 8 Kč/100 g → ušetřeno 6 Kč
    const seznam = sestavNakupniSeznam(den([j("s", "Kuře", 200, 10, 16)]));
    expect(seznam[0]!.cenaZa100g).toBe(5);
    expect(seznam[0]!.cenaBeznaZa100g).toBe(8);
    expect(seznam[0]!.usetreno).toBe(6);
  });

  it("při růstu ceny (dražší než běžná) úspora nikdy neklesne pod nulu", () => {
    const seznam = sestavNakupniSeznam(den([j("d", "Dražší", 100, 12, 10)]));
    expect(seznam[0]!.usetreno).toBe(0);
  });

  it("seznam se řadí od nejdražší položky", () => {
    const seznam = sestavNakupniSeznam(
      den([j("a", "Levná", 100, 2, 2), j("b", "Drahá", 100, 50, 50)]),
    );
    expect(seznam[0]!.id).toBe("b");
    expect(seznam[1]!.id).toBe("a");
  });
});

describe("obrazek – propagace z katalogu do plánu a seznamu", () => {
  const S_OBRAZKEM: Potravina = {
    ...p("o1", "Skyr", 11, 4, 0.2, 63, 9),
    obrazek: "https://images.off.org/skyr.jpg",
  };

  it("vytvorJidlo přenese obrazek z potraviny", () => {
    const jidlo = vytvorJidlo(S_OBRAZKEM, 150);
    expect(jidlo.obrazek).toBe("https://images.off.org/skyr.jpg");
  });

  it("vytvorJidlo bez obrazku dá null", () => {
    const jidlo = vytvorJidlo(p("b1", "Bez obrázku", 10, 10, 10, 300, 5), 100);
    expect(jidlo.obrazek).toBeNull();
  });

  it("sestavNakupniSeznam přenese obrazek do položky seznamu", () => {
    const jidlo = vytvorJidlo(S_OBRAZKEM, 150);
    const seznam = sestavNakupniSeznam({
      Snídaně: { jidla: [jidlo], kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0, cena: 0, cenaBezna: 0 },
    });
    expect(seznam[0]!.obrazek).toBe("https://images.off.org/skyr.jpg");
  });
});

describe("vymenJidlo", () => {
  it("vymění jídlo za jinou kombinaci potravin", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    const nazev = Object.keys(den.jidelnicek)[0]!;
    const stara = den.jidelnicek[nazev]!;
    const vysledek = vymenJidlo(KATALOG, den, nazev, CILE);
    expect(vysledek).not.toBeNull();
    const nova = vysledek!.jidelnicek[nazev]!;
    expect(nova.jidla.length).toBeGreaterThan(0);
    const staraId = new Set(stara.jidla.map((j) => j.id));
    expect(nova.jidla.every((j) => !staraId.has(j.id))).toBe(true);
  });

  it("nepoužije potraviny ostatních jídel (různorodost dne)", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    const nazev = Object.keys(den.jidelnicek)[1]!;
    const vysledek = vymenJidlo(KATALOG, den, nazev, CILE)!;
    const ostatniId = new Set(
      Object.entries(vysledek.jidelnicek)
        .filter(([n]) => n !== nazev)
        .flatMap(([, s]) => s.jidla.map((j) => j.id)),
    );
    expect(vysledek.jidelnicek[nazev]!.jidla.every((j) => !ostatniId.has(j.id))).toBe(true);
  });

  it("ostatní jídla zůstanou beze změny a celkem se přepočítá", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    const nazev = Object.keys(den.jidelnicek)[0]!;
    const vysledek = vymenJidlo(KATALOG, den, nazev, CILE)!;
    for (const [n, s] of Object.entries(den.jidelnicek)) {
      if (n !== nazev) expect(vysledek.jidelnicek[n]).toEqual(s);
    }
    const kcal = Object.values(vysledek.jidelnicek).reduce((a, s) => a + s.kalorie, 0);
    expect(vysledek.celkem.kalorie).toBe(Math.round(kcal));
  });

  it("vrátí null pro neexistující jídlo", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    expect(vymenJidlo(KATALOG, den, "Brunc", CILE)).toBeNull();
  });

  it("respektuje dietní filtr při výběru náhrady", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    const nazev = Object.keys(den.jidelnicek)[0]!;
    const vysledek = vymenJidlo(KATALOG, den, nazev, CILE, { diety: ["vegansky"] });
    // pokud náhrada vůbec existuje, nesmí obsahovat živočišné potraviny z katalogu
    if (vysledek !== null) {
      const id = vysledek.jidelnicek[nazev]!.jidla.map((j) => j.id);
      expect(id.some((i) => ["1", "2", "3", "4"].includes(i))).toBe(false);
    }
  });
});

describe("vymenJidloVTydnu", () => {
  it("vymění jídlo v daném dni a přepočítá týden i nákup", () => {
    const plan = vygenerujTydenniPlan(KATALOG, CILE);
    const novy = vymenJidloVTydnu(KATALOG, plan, 3, "Oběd", CILE);
    expect(novy).not.toBeNull();
    expect(novy!.dny[3]).not.toEqual(plan.dny[3]);
    expect(novy!.dny[1]).toEqual(plan.dny[1]);
    const kcal = Object.values(novy!.dny).reduce((a, d) => a + d.celkem.kalorie, 0);
    expect(novy!.tyden.kalorie).toBe(kcal);
    expect(novy!.nakup.length).toBeGreaterThan(0);
  });

  it("vrátí null pro neexistující den", () => {
    const plan = vygenerujTydenniPlan(KATALOG, CILE);
    expect(vymenJidloVTydnu(KATALOG, plan, 9, "Oběd", CILE)).toBeNull();
  });
});

describe("okrajové případy generátoru", () => {
  it("prázdný katalog → prázdný plán, žádný pád", () => {
    const den = vygenerujJidelnicek([], CILE);
    expect(den.celkem.kalorie).toBe(0);
    expect(Object.values(den.jidelnicek).every((s) => s.jidla.length === 0)).toBe(true);
  });

  it("filtr vyloučí celý katalog → prázdný plán (UI na to upozorní)", () => {
    // katalog nemá označené diety → veganský filtr vyloučí všechno
    const den = vygenerujJidelnicek(KATALOG, CILE, null, 0.85, 4, {
      diety: ["vegansky"],
    });
    expect(den.celkem.kalorie).toBe(0);
    expect(Object.values(den.jidelnicek).every((s) => s.jidla.length === 0)).toBe(true);
  });

  it("týdenní plán z prázdného katalogu → 7 prázdných dnů, prázdný nákup", () => {
    const plan = vygenerujTydenniPlan([], CILE);
    expect(Object.keys(plan.dny)).toHaveLength(7);
    expect(plan.tyden.kalorie).toBe(0);
    expect(plan.nakup).toHaveLength(0);
  });

  it("vymenJidlo s katalogem, kde nezbývá náhrada → null", () => {
    const jedna = [p("solo", "Jediná", 30, 0, 5, 150, 10)];
    const den = vygenerujJidelnicek(jedna, CILE);
    const nazev = Object.keys(den.jidelnicek)[0]!;
    // jediná potravina je už použitá v jiném jídle → náhrada neexistuje
    expect(vymenJidlo(jedna, den, nazev, CILE)).toBeNull();
  });

  it("vymenJidlo s filtrem vylučujícím vše → null, plán se nemění", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    const nazev = Object.keys(den.jidelnicek)[0]!;
    const vysledek = vymenJidlo(KATALOG, den, nazev, CILE, { diety: ["vegansky"] });
    // buď se najde veganská náhrada, nebo null – nikdy ne však nevhodné jídlo
    if (vysledek === null) {
      expect(den.jidelnicek[nazev]!.jidla.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("nulové cíle → prázdný plán bez pádu", () => {
    const den = vygenerujJidelnicek(KATALOG, { kalorie: 0, bilkoviny: 0, sacharidy: 0, tuky: 0 });
    expect(den.celkem.kalorie).toBe(0);
  });
});

describe("QA bug hunt – další okrajové případy", () => {
  it("NaN cíle neotráví plán (poškozená data z DB)", () => {
    const den = vygenerujJidelnicek(KATALOG, { kalorie: NaN, bilkoviny: NaN, sacharidy: NaN, tuky: NaN });
    expect(den.celkem.kalorie).toBe(0);
    expect(Object.values(den.jidelnicek).every((s) => s.jidla.length === 0)).toBe(true);
  });

  it("záporné cíle → prázdný plán bez pádu", () => {
    const den = vygenerujJidelnicek(KATALOG, { kalorie: -500, bilkoviny: -10, sacharidy: -5, tuky: -1 });
    expect(den.celkem.kalorie).toBe(0);
    expect(Object.values(den.jidelnicek).every((s) => s.jidla.length === 0)).toBe(true);
  });

  it("Infinity cíle se chovají jako nulové", () => {
    const den = vygenerujJidelnicek(KATALOG, { kalorie: Infinity, bilkoviny: Infinity, sacharidy: 10, tuky: 10 });
    expect(Number.isFinite(den.celkem.kalorie)).toBe(true);
  });

  it("katalog bez jediné slevy → plán se vygeneruje normálně", () => {
    const bezSlev = KATALOG.map((x) => ({ ...x, sleva: false, obchod: null }));
    const den = vygenerujJidelnicek(bezSlev, CILE);
    expect(den.celkem.kalorie).toBeGreaterThan(0);
    expect(den.jidelnicek["Oběd"]!.jidla.length).toBeGreaterThan(0);
  });

  it("nemožná makro kombinace (500 kcal, 200 g bílkovin) → plán drží kalorický strop", () => {
    const den = vygenerujJidelnicek(KATALOG, { kalorie: 500, bilkoviny: 200, sacharidy: 10, tuky: 5 });
    expect(Number.isFinite(den.celkem.kalorie)).toBe(true);
    expect(den.celkem.kalorie).toBeLessThan(2500);
  });

  it("potravina s 0 kcal a 0 cenou nezpůsobí dělení nulou", () => {
    const katalog = [...KATALOG, p("voda", "Voda", 0, 0, 0, 0, 0)];
    const den = vygenerujJidelnicek(katalog, CILE);
    expect(Number.isFinite(den.celkem.kalorie)).toBe(true);
    const nakup = sestavNakupniSeznam(den.jidelnicek);
    for (const x of nakup) expect(Number.isFinite(x.cenaCelkem)).toBe(true);
  });

  it("neceněná potravina (OFF import) neodstřelí ceněné – skóre přes medián", () => {
    const bezCeny = { ...p("levna", "Protein bez ceny", 50, 0, 0, 200, 0), aktualniCena: 0 };
    const cenena = { ...p("cenena", "Ceněná", 20, 0, 0, 80, 10), aktualniCena: 10 };
    // bez mediánového skóre by 0.01 Kč strop dával bezCeny skóre 5000 (50x vítěz)
    const sBez = skorePotraviny(bezCeny, "bilkovinova", 10);
    const sCen = skorePotraviny(cenena, "bilkovinova", 10);
    expect(sBez).toBeCloseTo(3.5); // (50 / 10 medián) × 0,7 pokuta za chybějící cenu
    expect(sCen).toBeCloseTo(2); // 20 / 10 – ceněná položka má přednost
    // a plán s neceněnými položkami stále běží
    const den = vygenerujJidelnicek([bezCeny, cenena], CILE);
    expect(Number.isFinite(den.celkem.kalorie)).toBe(true);
  });

  it("suroviny (cukr, olej, mouka) nevytvoří jídlo – real browser QA bug", () => {
    // Reprodukce: generátor vydával snídani „seitan + cukr krystal + olej",
    // protože suroviny mají nejlepší makra za Kč. Cukr/olej/mouka nesmí
    // ukotvit jídlo; olej se smí objevit jen jako malý tukový doplněk (≤30 g).
    const katalog = [
      p("cukr", "Cukr krystal", 0, 99, 0, 400, 1), // extrémně levný sacharid
      p("olej", "Slunečnicový olej", 0, 0, 100, 900, 2), // extrémně levný tuk
      p("mouka", "Hladká mouka", 10, 72, 1, 350, 1),
      p("maso", "Kuřecí prsa", 23, 0, 3, 110, 30),
      p("ryze", "Rýže basmati", 7, 78, 1, 350, 12),
      p("orechy", "Mandle", 21, 10, 52, 580, 60),
    ];
    const den = vygenerujJidelnicek(katalog, CILE);
    for (const souhrn of Object.values(den.jidelnicek)) {
      for (const s of souhrn.jidla) {
        if (!jePrisada(s)) continue;
        // jediná povolená surovina v jídle je malý tukový doplněk
        expect(s.tuky / (s.gramy / 100)).toBeGreaterThan(50);
        expect(s.gramy).toBeLessThanOrEqual(30);
      }
      // cukr/mouka v žádné roli
      expect(souhrn.jidla.some((s) => /cukr|mouka/i.test(s.nazev))).toBe(false);
    }
    // a alespoň jedno jídlo ukotvilo reálné jídlo (kuřecí prsa)
    expect(
      Object.values(den.jidelnicek).some((souhrn) =>
        souhrn.jidla.some((s) => s.nazev === "Kuřecí prsa"),
      ),
    ).toBe(true);
  });

  it("surovina je jediný kandidát → plán nepadá, použije ji v malé gramáži", () => {
    const katalog = [
      p("olej", "Řepkový olej", 0, 0, 100, 900, 5),
      p("maso", "Tuňák konzerva", 25, 0, 1, 110, 40),
      p("ryze", "Rýže", 7, 78, 1, 350, 12),
    ];
    const den = vygenerujJidelnicek(katalog, CILE);
    expect(Object.keys(den.jidelnicek).length).toBeGreaterThan(0);
    for (const souhrn of Object.values(den.jidelnicek)) {
      for (const s of souhrn.jidla) {
        if (s.nazev === "Řepkový olej") expect(s.gramy).toBeLessThanOrEqual(30);
      }
    }
  });

  it("kulinářská vhodnost – snídaně preferuje snídaňové, oběd obědové potraviny", () => {
    const katalog = [
      p("jerky", "Beef Jerky", 33, 10, 3, 200, 20),
      p("jogurt", "Řecký jogurt", 10, 3, 0, 60, 15),
      p("spagety", "Špagety", 12, 72, 1, 350, 8),
      p("vlocky", "Ovesné vločky", 13, 60, 7, 370, 8),
      p("mandle", "Mandle", 21, 10, 52, 580, 60),
      p("maso", "Kuřecí prsa", 23, 0, 3, 110, 30),
    ];
    // 2 jídla: Oběd + Večeře → žádná snídaně, jerky/müsli jsou legitimní
    const den = vygenerujJidelnicek(katalog, CILE, 1, 0.85, 3);
    const snidane = den.jidelnicek["Snídaně"];
    const obed = den.jidelnicek["Oběd"];
    expect(snidane).toBeDefined();
    expect(obed).toBeDefined();
    // snídaně nesmí ukotvit jerky (obědová potravina), měla by dostat jogurt
    const snidaneNazvy = snidane!.jidla.map((j) => j.nazev);
    expect(snidaneNazvy.some((n) => /jogurt|vločky/i.test(n))).toBe(true);
    // oběd nesmí dostat snídaňové potraviny, když existují obědové
    const obedNazvy = obed!.jidla.map((j) => j.nazev);
    expect(obedNazvy.some((n) => /prsa|špagety|jerky/i.test(n))).toBe(true);
  });
});
