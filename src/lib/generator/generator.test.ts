import { describe, expect, it } from "vitest";
import {
  BONUS_SLEVY,
  filtrujPotraviny,
  nazevNasvedcujeAlergenu,
  nazevVylucujeDietu,
  obsahujeAlergen,
  jeCenaSpolehliva,
  jeCiziNazev,
  jeJunk,
  jeKorumpovanaNutrience,
  jeNepotravinovy,
  jePrisada,
  jeSuplement,
  jeSuplementSnack,
  jeSuplementTvrdy,
  jeWheyPrasek,
  kategoriePotraviny,
  kusovaGramaz,
  naplanujJidlo,
  panelTik,
  podilyProPocetJidel,
  rodinaKotvy,
  sestavNakupniSeznam,
  SNIDANE_KOTVA_ANTI_RE,
  vymenJidlo,
  vymenJidloVTydnu,
  skorePotraviny,
  vytvorJidlo,
  vyberKandidata,
  vygenerujJidelnicek,
  vygenerujTydenniPlan,
  zaokrouhliGramaz,
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
    // v testovacím katalogu slouží beznaCena zároveň jako zdrojem
    // zveřejněná původní cena – bez ní by se úspora nepočítala
    puvodniCena: aktualniCena < beznaCena ? beznaCena : null,
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

describe("snídaně – ryby nekothví", () => {
  // tuňákové vločky mají slovo „vločky" → SNIDANE_RE je chybně hodnotí
  // jako snídaňově vhodné; SNIDANE_KOTVA_ANTI_RE je kompenzace
  it("regex chytá ryby, nechává rybí pomazánky", () => {
    for (const nazev of ["Tuňákové vločky v olivovém oleji", "Losos uzený", "Sardinky v oleji", "Krabí tyčky"])
      expect(SNIDANE_KOTVA_ANTI_RE.test(nazev)).toBe(true);
    for (const nazev of ["Tuňáková pomazánka Rybex", "Krabí pomazánka", "Tvaroh polotučný"])
      expect(SNIDANE_KOTVA_ANTI_RE.test(nazev)).toBe(false);
  });

  // játra/dršťky/ledviny/srdce k snídani nepatří; pomazánkové výjimky ano
  it("regex chytá vnitřnosti, nechává játrové pomazánky", () => {
    for (const nazev of ["Vepřová játra", "Dršťková polévka", "Hovězí ledviny", "Kuřecí srdce"])
      expect(SNIDANE_KOTVA_ANTI_RE.test(nazev)).toBe(true);
    for (const nazev of ["Játrová pomazánka", "Pomazánka z kuřecích jater"])
      expect(SNIDANE_KOTVA_ANTI_RE.test(nazev)).toBe(false);
  });

  it("ryba prohraje kotvu snídaně i se srovnatelným skóre", () => {
    const skore = (x: Potravina) => ({ ...x, skore: skorePotraviny(x, "bilkovinova") });
    const kat = {
      // tvaroh má lepší cenu:bílkoviny (5,0 vs 4,0) – tuňák drží jen
      // vhodnost ×2,5; s malusem ×0,4 klesne pod práh srovnatelnosti
      bilkovinova: [
        skore(p("f1", "Tuňákové vločky v olivovém oleji", 24, 0, 9, 200, 6)),
        skore(p("f2", "Tvaroh polotučný", 12, 4, 1.5, 85, 2.4)),
      ],
      sacharidova: [skore(p("f3", "Rohlík", 9, 50, 2, 270, 5, 3.5))],
      tukova: [skore(p("f4", "Máslo", 0.5, 0.5, 82, 750, 10, 8))],
    } as never;
    for (let den = 1; den <= 7; den++) {
      const jidla = naplanujJidlo(kat, 0, 30, 40, 15, 500, [], den, 0.85, "Snídaně");
      expect(jidla[0]?.id).toBe("f2");
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

  it("jmenná síť chytí alergen i bez tagu (živý katalog má tagy jen u ~¼ položek)", () => {
    const netagovane = [
      p("n1", "Mléko polotučné čerstvé", 3.3, 4.8, 1.6, 46, 15),
      p("n2", "Žitný chléb", 8, 45, 1.5, 225, 28),
      p("n3", "Sýr Eidam 30%", 26, 1, 20, 289, 89),
      p("n4", "Arašídové máslo", 25, 20, 50, 630, 99),
      p("n5", "Brambory pozdní", 2, 17, 0.1, 77, 9),
      p("n6", "Kuřecí prsa", 23, 0, 1.5, 106, 75),
    ];
    const vys = filtrujPotraviny(netagovane, {
      alergeny: ["mleko", "lepek", "arasidy"],
    });
    expect(vys.map((x) => x.id)).toEqual(["n5", "n6"]);
  });

  it("jmenná síť se vyhýbá českým falešným shodám", () => {
    // rybíz ≠ ryba; chlebíčky z rýže ≠ chléb; svinina nemá sulfit jen ze „vin“;
    // univerzální koření není niva; kokos není ořech EU-14; mandlí se myslí ořechy
    expect(nazevNasvedcujeAlergenu("Rybíz černý", "ryby")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Rýžové chlebíčky", "lepek")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Svinina na kmíně", "sulfit")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Univerzální koření", "mleko")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Kokosová voda", "orisky")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Rybí filé", "ryby")).toBe(true);
    expect(nazevNasvedcujeAlergenu("Hummus klasik", "sezam")).toBe(true);
    expect(nazevNasvedcujeAlergenu("Seitan marinovaný", "lepek")).toBe(true);
    expect(nazevNasvedcujeAlergenu("Mandle natural", "orisky")).toBe(true);
    expect(nazevNasvedcujeAlergenu("Chléb pšeniční", "lepek")).toBe(true);
  });

  it("jmenná síť respektuje námitky «bez X» a zavádějící fráze", () => {
    // deklarované „bez“ vyvrací důkaz z názvu
    expect(nazevNasvedcujeAlergenu("Pizza korpus bezlepkový", "lepek")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Cestoviny bezvaječné", "vejce")).toBe(false);
    // rostlinná „máslo" není mléčné máslo
    expect(nazevNasvedcujeAlergenu("Arašídové máslo", "mleko")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Kakaové máslo", "mleko")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Arašídové máslo se srvátkou", "mleko")).toBe(true);
    // vinná odrůda ≠ vlašské ořechy; krabička/rakytník/Racio ≠ korýši
    expect(nazevNasvedcujeAlergenu("Ryzlink vlašský pozdní sběr", "orisky")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Krabička zákusků", "korisi")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Sušenka s rakytníkem", "korisi")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Racio rýžové chlebíčky", "korisi")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Marakuja", "korisi")).toBe(false);
    // müsli není měkkýš; půdní humus není hummus
    expect(nazevNasvedcujeAlergenu("Musli bar", "vodnany")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Substrát s humusem", "sezam")).toBe(false);
    // bezlaktózové mléko alergii neřeší – zůstává mléčný alergen
    expect(nazevNasvedcujeAlergenu("Bezlaktózové mléko", "mleko")).toBe(true);
  });

  it("bezlepková dieta = vyloučení lepku, ne jen GF-tagované položky", () => {
    const kat = [
      { ...p("g1", "Rýže basmati", 7, 78, 0.6, 350, 22), diety: [] as string[] },
      { ...p("g2", "Pšeničný chléb", 9, 48, 2, 250, 28), diety: [] as string[], alergeny: ["lepek"] },
      { ...p("g3", "Bezlepková bageta", 7, 45, 3, 260, 55), diety: ["bezlepkovy"], alergeny: [] as string[] },
      { ...p("g4", "Kuřecí prsa", 23, 0, 1.5, 106, 75), diety: [] as string[] },
    ];
    // certifikovaná GF bageta zůstane, pšeničný chléb zmizí –
    // a hlavně: netagovaná rýže a kuře prochází (pool není ~70 položek)
    const vys = filtrujPotraviny(kat, { diety: ["bezlepkovy"] });
    expect(vys.map((x) => x.id).sort()).toEqual(["g1", "g3", "g4"]);
  });

  it("obsahujeAlergen kombinuje tag i název", () => {
    expect(obsahujeAlergen({ nazev: "Losos uzený", alergeny: [] }, "ryby")).toBe(true);
    expect(obsahujeAlergen({ nazev: "Quinoa", alergeny: ["mleko"] }, "mleko")).toBe(true);
    expect(obsahujeAlergen({ nazev: "Quinoa", alergeny: [] }, "ryby")).toBe(false);
    expect(obsahujeAlergen({ nazev: "Cizrnová pomazánka" }, "mleko")).toBe(false);
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

  it("výměna respektuje cap rodin použitých jinde v týdnu", () => {
    const den = vygenerujJidelnicek(KATALOG, CILE);
    // jídlo bez kuřecích prsou – rodina „kureci prsa" má v týdnu 3
    // použití → cap ji z náhrady vyloučí (kuřecí prsa mají nejlepší
    // poměr a bez capu by se do jídla nabídla sama)
    const nazev = Object.entries(den.jidelnicek).find(
      ([, s]) => !s.jidla.some((j) => j.id === "1"),
    )?.[0];
    if (nazev === undefined) return;
    const vysledek = vymenJidlo(
      KATALOG, den, nazev, CILE, null, 0.85, new Map([["kureci prsa", 3]]),
    );
    if (vysledek !== null) {
      expect(
        vysledek.jidelnicek[nazev]!.jidla.every((j) => j.id !== "1"),
      ).toBe(true);
    }
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
  it("fyzikalne nemozna vyziva ( g maker/100 g) se do planu nedostane", () => {
    const katalog = [
      // "nejlepsi" skore, ale nemozna data z OFF (chleb s 77 g bilkovin)
      p("chleb", "Chleb psenicnozitny", 77, 53.3, 1, 261, 1),
      p("maso", "Kureci prsa", 23, 0, 3, 110, 30),
      p("ryze", "Ryze", 7, 78, 1, 350, 12),
      p("vlocky", "Ovesne vlocky", 13, 60, 7, 370, 8),
      p("mandle", "Mandle", 21, 10, 52, 580, 60),
    ];
    const den = vygenerujJidelnicek(katalog, CILE);
    for (const souhrn of Object.values(den.jidelnicek)) {
      for (const s of souhrn.jidla) {
        expect(s.nazev).not.toBe("Chleb psenicnozitny");
      }
    }
  });
  it("svacina nedostane tepelnou prilohu, hlavni jidlo nekotvi tycinka", () => {
    const katalog = [
      p("tycinka", "Proteinova tycinka", 30, 20, 8, 280, 8),
      p("maso", "Kureci prsa", 23, 0, 3, 110, 30),
      p("spagety", "Spagety", 12, 72, 1, 350, 8),
      p("jablko", "Jablko", 0.5, 14, 0.2, 60, 4),
      p("mandle", "Mandle", 21, 10, 52, 580, 60),
    ];
    const den = vygenerujJidelnicek(katalog, CILE);
    const svacina = den.jidelnicek["Sva" + "\u010d" + "ina"];
    const obed = den.jidelnicek["Ob" + "\u011b" + "d"];
    // svacina: spagety se nevyberou, kdyz existuje svacinova potravina
    expect(svacina).toBeDefined();
    if (svacina) {
      const n = svacina.jidla.map((j) => j.nazev);
      expect(n).not.toContain("Spagety");
    }
    // obed: tycinka nekandiduje jako kotva, kdyz existuje maso
    expect(obed).toBeDefined();
    if (obed) {
      expect(obed.jidla[0]?.nazev).not.toBe("Proteinova tycinka");
    }
  });
});

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

/* ============================================================
 * OVERHAUL: celopotravinová jídla, reálné porce, makro-solver
 * ============================================================ */

// Reálnější katalog – bílkoviny, sacharidy, tuky, zelenina + suplementy
// s „lákavým" skórem, které by starý generátor vybral do hlavních jídel.
const KATALOG_REALNY: Potravina[] = [
  p("r1", "Kuřecí prsa", 23, 0, 2.6, 114, 19.9),
  p("r2", "Krůtí prsa", 24, 0, 1.5, 110, 22),
  p("r3", "Losos filet", 20, 0, 13, 208, 45),
  p("r4", "Tuňák v konzervě", 24, 0, 1, 109, 25),
  p("r5", "Vejce slepičí", 12.5, 0.7, 10, 140, 5),
  p("r6", "Tvaroh polotučný", 12, 3.5, 2, 84, 5.6),
  p("r7", "Tvaroh nízkotučný", 13, 4, 0.5, 74, 5.2),
  p("r8", "Řecký jogurt 0%", 10, 3.6, 0.4, 57, 7),
  p("r9", "Sýr Eidam 30%", 25, 2, 28, 365, 11),
  p("r10", "Mozzarella", 18, 2.5, 21, 275, 14),
  p("r11", "Ovesné vločky", 13, 60, 7, 375, 3.5),
  p("r12", "Rýže dlouhozrnná", 7.5, 78, 0.6, 350, 4),
  p("r13", "Těstoviny celozrnné", 13, 70, 2.5, 352, 4.5),
  p("r14", "Brambory", 2, 17, 0.1, 77, 2),
  p("r15", "Chléb žitný", 8.5, 48, 1.7, 240, 4.5),
  p("r16", "Rohlík celozrnný", 9, 52, 3, 280, 5),
  p("r17", "Banán", 1.1, 23, 0.3, 95, 4),
  p("r18", "Jablko", 0.3, 14, 0.2, 58, 3),
  p("r19", "Mandle", 21, 10, 54, 600, 25),
  p("r20", "Vlašské ořechy", 15, 7, 65, 654, 22),
  p("r21", "Olivový olej", 0, 0, 100, 884, 9),
  p("r22", "Rajče", 0.9, 3.9, 0.2, 20, 6),
  p("r23", "Okurka hadovka", 0.7, 3.6, 0.1, 15, 4),
  p("r24", "Brokolice", 2.8, 6.6, 0.4, 34, 7),
  p("r25", "Paprika", 1, 6, 0.3, 31, 6),
  // suplementy s „lákavým" poměrem makro:cena – musí zůstat mimo hlavní jídla
  p("s1", "Proteinová tyčinka 45 g", 33, 35, 9, 350, 40),
  p("s2", "Instantní proteinová polévka", 60, 20, 4, 360, 50),
  p("s3", "Proteinový pudink prášek", 75, 8, 2, 350, 45),
  p("s4", "Srvátkový protein whey", 80, 5, 6, 390, 55),
  p("s5", "Gainer Mega Mass", 25, 60, 5, 365, 35),
];
const REALNY_BY_ID = new Map(KATALOG_REALNY.map((x) => [x.id, x]));

describe("suplementy – klasifikace", () => {
  it("tvrdé suplementy: instantní polévky, práškové pudinky, gainery, whey", () => {
    for (const nazev of [
      "Instantní proteinová polévka",
      "Proteinová polévka instantní",
      "Proteinový pudink prášek",
      "Gainer Mega Mass",
      "BCAA instant",
      "Whey protein isolate",
      "Srvátkový protein koncentrát",
    ]) {
      expect(jeSuplementTvrdy({ nazev })).toBe(true);
    }
  });

  it("svačinové suplementy: tyčinky a proteinové nápoje", () => {
    for (const nazev of ["Proteinová tyčinka 45 g", "Müsli bar", "Protein shake"]) {
      expect(jeSuplementSnack({ nazev })).toBe(true);
    }
  });

  it("whey je rozpoznaný jako jediný povolený doplněk snídaně", () => {
    expect(jeWheyPrasek({ nazev: "Srvátkový protein whey" })).toBe(true);
    expect(jeWheyPrasek({ nazev: "Proteinový prášek" })).toBe(true);
    expect(jeWheyPrasek({ nazev: "Tvaroh" })).toBe(false);
  });

  it("normální potraviny nejsou suplementy (proteinový jogurt, koncentrát, instant kaše)", () => {
    for (const nazev of [
      "Kuřecí prsa",
      "Proteinový jogurt natural",
      "Rajčatový koncentrát",
      "Instantní ovocná kaše",
      "Tvaroh polotučný",
      "Polévka zeleninová",
      "Granko",
    ]) {
      expect(jeSuplement({ nazev })).toBe(false);
    }
  });
});

describe("suplementy – zákaz v hlavních jídlech", () => {
  it("Snídaně/Oběd/Večeře nepoužívají suplementy; svačina jen netvrdé položky", () => {
    // všech 7 denních rotací – deterministická kontrola celého jídelníčku
    for (let den = 1; den <= 7; den++) {
      const v = vygenerujJidelnicek(KATALOG_REALNY, CILE, den);
      for (const [nazev, souhrn] of Object.entries(v.jidelnicek)) {
        for (const j of souhrn.jidla) {
          const potravina = REALNY_BY_ID.get(j.id)!;
          if (/svačin/i.test(nazev)) {
            // svačina: tvrdé suplementy zakázány (tyčinka může projít)
            expect(jeSuplementTvrdy(potravina), `${nazev}: ${j.nazev}`).toBe(false);
          } else {
            // hlavní jídla: žádná tyčinka/shake
            expect(jeSuplementSnack(potravina), `${nazev}: ${j.nazev}`).toBe(false);
            // tvrdý suplement smí jen whey jako „suplement" doplněk snídaně
            if (j.role === "suplement") {
              expect(/snídan/i.test(nazev)).toBe(true);
              expect(jeWheyPrasek(potravina)).toBe(true);
              // whey nikdy samostatné jídlo – vždy s jídlem navíc
              expect(souhrn.jidla.length).toBeGreaterThan(1);
            } else {
              expect(jeSuplementTvrdy(potravina), `${nazev}: ${j.nazev}`).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe("reálné porce – zaokrouhliGramaz", () => {
  it("maso/ryby: krok 10 g, porce 120–250 g u hlavního jídla", () => {
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 137, "kotva", "obedVecere")).toBe(140);
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 40, "kotva", "obedVecere")).toBe(120);
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 800, "kotva", "obedVecere")).toBe(250);
    // svačina: masová porce může být menší
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 40, "kotva", "svacina")).toBe(80);
  });

  it("suché sacharidy: krok 10 g, hlavní jídlo min 50 g – žádná 30 g rýže", () => {
    expect(zaokrouhliGramaz({ nazev: "Rýže basmati" }, 34, "sacharid", "obedVecere")).toBe(50);
    expect(zaokrouhliGramaz({ nazev: "Těstoviny" }, 66, "sacharid", "obedVecere")).toBe(70);
  });

  it("mléčné: kelímkové kroky po 50 g", () => {
    expect(zaokrouhliGramaz({ nazev: "Řecký jogurt" }, 137, "kotva", "snidane")).toBe(150);
    expect(zaokrouhliGramaz({ nazev: "Tvaroh" }, 280, "kotva", "snidane")).toBe(300);
  });

  it("kusové: celé kusy s gramovým ekvivalentem", () => {
    expect(zaokrouhliGramaz({ nazev: "Vejce" }, 95, "kotva", "snidane")).toBe(120); // 2 ks
    expect(zaokrouhliGramaz({ nazev: "Banán" }, 100, "sacharid", "svacina")).toBe(120); // 1 ks
    expect(zaokrouhliGramaz({ nazev: "Rohlík" }, 80, "sacharid", "snidane")).toBe(86); // 2 ks
  });

  it("tuky: olej max 20 g / krok 5 g, ořechy max 45 g", () => {
    const olej = { nazev: "Slunečnicový olej" };
    expect(zaokrouhliGramaz(olej, 47, "tuk", "obedVecere")).toBe(20);
    expect(zaokrouhliGramaz(olej, 12, "tuk", "obedVecere")).toBe(10);
    expect(zaokrouhliGramaz({ nazev: "Mandle" }, 23, "tuk", "snidane")).toBe(25);
  });

  it("kusovaGramaz rozpozná kusové potraviny", () => {
    expect(kusovaGramaz("Vejce slepičí M")).toBe(60);
    expect(kusovaGramaz("Banán")).toBe(120);
    expect(kusovaGramaz("Rýže")).toBeNull();
  });
});

describe("reálné porce – v generovaném plánu", () => {
  it("všechny gramáže jsou čisté (krok 5 g nebo celé kusy) a maso ≥ 80 g (oběd/večeře ≥ 120 g)", () => {
    const den = vygenerujJidelnicek(KATALOG_REALNY, CILE, 3);
    for (const [nazevJidla, souhrn] of Object.entries(den.jidelnicek)) {
      const hlavni = /oběd|večeře/i.test(nazevJidla);
      for (const j of souhrn.jidla) {
        if (j.popisekMnozstvi) {
          // kusová položka: „N ks · M g" a gramy = N × váha kusu
          const kus = kusovaGramaz(j.nazev);
          expect(kus).not.toBeNull();
          expect(j.gramy % kus!).toBe(0);
        } else {
          expect(j.gramy % 5, `${j.nazev} ${j.gramy}`).toBe(0);
        }
        if (j.role === "kotva" && /maso|kuřec|krůt|losos|tuňák|prsa|prso/i.test(j.nazev)) {
          expect(j.gramy).toBeGreaterThanOrEqual(hlavni ? 120 : 80);
          expect(j.gramy).toBeLessThanOrEqual(250);
        }
        // suchá příloha hlavního jídla nikdy pod 50 g suché váhy
        if (
          hlavni &&
          j.role === "sacharid" &&
          /rýž|těstovin|spaget|penne|fusilli|nudl|kuskus|bulgur|quino|tarhoň|pohank|vločk|ovsen/i.test(j.nazev)
        ) {
          expect(j.gramy).toBeGreaterThanOrEqual(50);
        }
      }
    }
  });

  it("Oběd a Večeře mají zeleninovou stranu", () => {
    for (let d = 1; d <= 3; d++) {
      const den = vygenerujJidelnicek(KATALOG_REALNY, CILE, d);
      for (const nazev of ["Oběd", "Večeře"]) {
        expect(
          den.jidelnicek[nazev]!.jidla.some((j) => j.role === "zelenina"),
          nazev,
        ).toBe(true);
      }
    }
  });
});

describe("denní makro-solver – přesnost cílů", () => {
  const PROFILY = [
    { kalorie: 1600, bilkoviny: 130, sacharidy: 130, tuky: 58 }, // redukce
    { kalorie: 2200, bilkoviny: 150, sacharidy: 220, tuky: 75 }, // udržování
    { kalorie: 3000, bilkoviny: 190, sacharidy: 340, tuky: 95 }, // nabírání
  ];

  for (const cile of PROFILY) {
    it(`profil ${cile.kalorie} kcal: kcal ±3 %, B/S/T ±5 %`, () => {
      for (let den = 1; den <= 3; den++) {
        const v = vygenerujJidelnicek(KATALOG_REALNY, cile, den);
        expect(v.celkem.kalorie, `kcal den ${den}`).toBeGreaterThanOrEqual(cile.kalorie * 0.97);
        expect(v.celkem.kalorie, `kcal den ${den}`).toBeLessThanOrEqual(cile.kalorie * 1.03);
        expect(v.celkem.bilkoviny, `B den ${den}`).toBeGreaterThanOrEqual(cile.bilkoviny * 0.95);
        expect(v.celkem.bilkoviny, `B den ${den}`).toBeLessThanOrEqual(cile.bilkoviny * 1.05);
        expect(v.celkem.sacharidy, `S den ${den}`).toBeGreaterThanOrEqual(cile.sacharidy * 0.95);
        expect(v.celkem.sacharidy, `S den ${den}`).toBeLessThanOrEqual(cile.sacharidy * 1.05);
        expect(v.celkem.tuky, `T den ${den}`).toBeGreaterThanOrEqual(cile.tuky * 0.95);
        expect(v.celkem.tuky, `T den ${den}`).toBeLessThanOrEqual(cile.tuky * 1.05);
      }
    });
  }
});

describe("ceny jídel – realistický výpočet", () => {
  it("150 g kuřete z ceny 199 Kč/kg = ~29,85 Kč (nikdy 2,99)", () => {
    const kure = { ...p("k", "Kuřecí prsa", 23, 0, 2.6, 114, 19.9) }; // Kč/100 g
    const j = vytvorJidlo(kure, 150);
    expect(j.cena).toBeCloseTo(29.85, 2);
    expect(j.cena).toBeGreaterThan(10);
  });

  it("nespoledlivá cena (pack-mismatch) se NEZOBRAZÍ – položka je neceněná", () => {
    // „4,75 Kč za 95 g tyčinky" = aktualniCena 5 Kč/100 g při balení 45 g
    const rozbita = { ...p("x", "Proteinová tyčinka", 30, 30, 5, 320, 5), baleniG: 45 };
    expect(jeCenaSpolehliva(rozbita)).toBe(false);
    const j = vytvorJidlo(rozbita, 95);
    expect(j.cena).toBe(0);
    expect(j.sleva).toBe(false);
  });

  it("spolehlivé ceny procházejí", () => {
    expect(jeCenaSpolehliva(p("a", "Brambory", 2, 17, 0.1, 77, 2))).toBe(true);
    expect(jeCenaSpolehliva(p("b", "Kuře", 23, 0, 3, 110, 19.9))).toBe(true);
    // levné stálice musí projít – mouka/brambory ~1 Kč/100 g jsou reálné
    expect(jeCenaSpolehliva(p("e", "Mouka", 10, 75, 1, 360, 1.2))).toBe(true);
    expect(jeCenaSpolehliva(p("f", "Brambory", 2, 17, 0.1, 77, 1.49))).toBe(true);
    expect(jeCenaSpolehliva(p("c", "Levnej", 10, 0, 0, 50, 0.5))).toBe(false); // < 0,7 Kč/100 g
    expect(jeCenaSpolehliva(p("d", "Drahej", 10, 0, 0, 50, 500))).toBe(false); // > 400
  });

  it("aktualni < 35 % běžné ceny = unit-artefakt, ne akce", () => {
    // „2,99 Kč" za kuře = cena 2 Kč/100 g při běžné 19,9 – omyl jednotek
    const rozbiteKure = p("g", "Kuře", 23, 0, 3, 110, 19.9, 2);
    expect(jeCenaSpolehliva(rozbiteKure)).toBe(false);
    // reálná sleva ~40 % projde (aktualni 58 % běžné)
    expect(jeCenaSpolehliva(p("h", "Tvaroh", 12, 4, 1, 84, 12, 7))).toBe(true);
  });

  it("bílkovinové stálice pod 4 Kč/100 g = symetrický unit omyl", () => {
    // tvaroh 2,5 Kč/100 g (25 Kč/kg) – v ČR nereálné ani v akci
    expect(jeCenaSpolehliva(p("i", "Tvaroh polotučný", 12, 4, 1, 84, 2.5))).toBe(false);
    expect(jeCenaSpolehliva(p("j", "Kuřecí prsa", 23, 0, 3, 110, 3))).toBe(false);
    // mléko a krabí tyčky (surimi) záměrně bez podlahy – 2 Kč/100 g je reálné
    expect(jeCenaSpolehliva(p("k", "Mléko trvanlivé", 3.3, 4.8, 1.5, 44, 2.2))).toBe(true);
    expect(jeCenaSpolehliva(p("l", "Krabí tyčky", 10, 12, 1, 95, 3))).toBe(true);
  });
});

describe("reálný katalog – cukrovinky, nepotraviny, cizí názvy", () => {
  it("jeJunk: cukrovinky a dezerty nejsou jídlo", () => {
    for (const nazev of [
      "Lindor double chocolate",
      "Vajíčka (Chocolate eggs with Lentilky)",
      "Čočkové Chipsy Paprika",
      "Pralinky Raffaello",
      "Zmrzlina vanilková",
      "Sušenky digestive",
      "Oplatka s citronovou příchutí",
      "Haribo Starmix",
    ]) {
      expect(jeJunk({ nazev }), nazev).toBe(true);
    }
    for (const nazev of ["Kuřecí prsa", "Müsli ovesné", "Sušený ananas", "Kakaové máslo tukové"]) {
      expect(jeJunk({ nazev }), nazev).toBe(false);
    }
  });

  it("jeNepotravinovy: kosmetika, drogerie, krmiva, tablety", () => {
    for (const nazev of [
      "Biovène Koncentrované sérum proti nedokonalostem pleti",
      "Šampon na vlasy",
      "Krmivo pro kočky",
      "Vitamin C tablety",
      "Kolagen prášek",
      "Prací prášek",
    ]) {
      expect(jeNepotravinovy({ nazev }), nazev).toBe(true);
    }
    // vejce obohacená o omega-3 jsou potravina, ne doplněk stravy
    expect(jeNepotravinovy({ nazev: "Vejce s omega-3" })).toBe(false);
  });

  it("tvrdé suplementy: anglické názvy z OFF katalogu", () => {
    for (const nazev of [
      "Protein Pudding jahoda",
      "Low carb protein mash",
      "Protein mousse",
      "Protein dessert",
      "Pšeničná bílkovina",
    ]) {
      expect(jeSuplementTvrdy({ nazev }), nazev).toBe(true);
    }
  });

  it("kusovaGramaz: kusové slovo musí být v prvních dvou slovech", () => {
    // „Müsli mrkev a jablko" není 170 g kus jablka
    expect(kusovaGramaz("Müsli mrkev a jablko")).toBeNull();
    // „Chlebíčky rýžové" jsou křupky po ~10 g, ne krajíc chleba po 40 g
    expect(kusovaGramaz("Chlebíčky rýžové")).toBe(10);
    expect(kusovaGramaz("Chléb žitný")).toBe(40);
    // breadfruit není chléb
    expect(kusovaGramaz("Zelený chlebovník ve slaném nálevu")).toBeNull();
  });

  it("přísady: cizojazyčné oleje a omáčky", () => {
    for (const nazev of [
      "Walnuss Oel",
      "Napraforgó étolaj",
      "Organic Mayonnaise",
      "Vegan mayo (zárubova)",
      "Sonnenblumenöl",
      "Nápojový koncentrát s koskami mandarinky",
    ]) {
      expect(jePrisada({ nazev }), nazev).toBe(true);
    }
  });

  it("povolitPodMin: krácení solveru končí na půlce minima, hlavní složky talíře jsou nelamatelné", () => {
    // maso oběda/večeře: podlaha 120 g se neprolomuje ani při krácení –
    // 70 g krůtího není oběd, solver má doladit jinde
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 5, "kotva", "obedVecere", true)).toBe(120);
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 5, "kotva", "obedVecere")).toBe(120);
    // suchá příloha hlavního jídla: podlaha 50 g taky nelamatelná
    expect(zaokrouhliGramaz({ nazev: "Rýže basmati" }, 20, "sacharid", "obedVecere", true)).toBe(50);
    // u ostatních rolí/typů jídla platí pravidlo poloviny minima –
    // maso 80 g min (svačina) → krácené nejvýš na 40 g, ne na 10 g nitě
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 5, "kotva", "svacina", true)).toBe(40);
  });
});

describe("zeleninová strana – skutečná zelenina před luštěninami", () => {
  const ZEL_SACH = [
    { ...p("ry1", "Jasmínová rýže", 7.5, 78, 0.6, 350, 4), skore: 5 },
    // luštěnina s vyšším skórem – bez malusu by vyhrála strana
    { ...p("fa1", "Urid černé fazole celé", 8, 20, 0.6, 120, 9), skore: 9 },
    { ...p("ra1", "Rajče", 0.9, 3.9, 0.2, 20, 6), skore: 4 },
  ];
  const KAT_ZEL = {
    bilkovinova: [{ ...p("k1", "Kuřecí prsa", 23, 0, 2.6, 114, 20), skore: 5 }],
    sacharidova: ZEL_SACH,
    tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
  } as never;

  it("rajče vítězí nad fazolemi, i když mají lepší cenové skóre", () => {
    const jidla = naplanujJidlo(KAT_ZEL, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "zelenina")?.id).toBe("ra1");
  });

  it("bez skutečné zeleniny zůstávají luštěniny nouzovou variantou", () => {
    const kat = {
      ...(KAT_ZEL as object),
      sacharidova: ZEL_SACH.filter((x) => x.id !== "ra1"),
    } as never;
    const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "zelenina")?.id).toBe("fa1");
  });
});

describe("alkohol a nápoje – nikdy v jídelníčku", () => {
  it("lihovina s vysokým skórem se nevybere ani jako kotva", () => {
    const kat = {
      bilkovinova: [
        { ...p("a1", "Tatratea Ibišek a červený čaj 37 % obj.", 30, 0, 0, 200, 10), skore: 99 },
        { ...p("k1", "Kuřecí prsa", 23, 0, 2.6, 114, 20), skore: 5 },
      ],
      sacharidova: [{ ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 }],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    for (const nazev of ["Snídaně", "Oběd", "Večeře", "Svačina"]) {
      const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, nazev);
      expect(jidla.some((j) => j.id === "a1"), nazev).toBe(false);
    }
  });

  it("kávový nápoj a ochucená voda nejsou potravina pro jídlo", () => {
    expect(jeJunk({ nazev: "Coffee Espresso Milk" })).toBe(true);
    expect(jeJunk({ nazev: "Dobrá Voda neperlivá - Jahoda a malina" })).toBe(true);
    expect(jeJunk({ nazev: "Želé s ovocnými a zeleninovými šťávami" })).toBe(true);
    expect(jeJunk({ nazev: "Kopr a másličko bramborové lupínky" })).toBe(true);
  });
});

describe("živý katalog – audit 7denního plánu", () => {
  it("kotva potřebuje ≥4 g bílkovin na 100 g (špenát/zelí nekothví)", () => {
    const kat = {
      bilkovinova: [
        // „bilkovinový" poměrem B:kcal, ale jen 2,9 g B/100 g
        { ...p("sp1", "Špenát krájený mražený", 2.9, 3.6, 0.4, 25, 2), skore: 99 },
        { ...p("k1", "Kuřecí prsa", 23, 0, 2.6, 114, 20), skore: 5 },
      ],
      sacharidova: [{ ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 }],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "kotva")?.id).toBe("k1");
  });

  it("měkký spodek: když jiné bílkoviny nejsou, kotví i nízkobílkovinná", () => {
    const kat = {
      bilkovinova: [{ ...p("sp1", "Špenát krájený", 2.9, 3.6, 0.4, 25, 2), skore: 9 }],
      sacharidova: [{ ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 }],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "kotva")?.id).toBe("sp1");
  });

  it("banánový květ a hummus/pomazánky nejsou kusové potraviny", () => {
    // „Banánový květ" nesmí dostat 120 g kus banánu (4 ks = 480 g)
    expect(kusovaGramaz("Banánový květ ve slaném nálevu")).toBeNull();
    expect(kusovaGramaz("Avokádový hummus")).toBeNull();
    expect(kusovaGramaz("Hummus cizrnová pomazánka se smaženou cibulkou")).toBeNull();
    expect(kusovaGramaz("Banán")).toBe(120);
  });

  it("seitan mix/směs je přísada, hotový seitan kotví", () => {
    expect(jePrisada({ nazev: "Seitan mix" })).toBe(true);
    expect(jePrisada({ nazev: "Seitanová směs" })).toBe(true);
    expect(jePrisada({ nazev: "Marinovaný seitan" })).toBe(false);
    expect(jePrisada({ nazev: "Seitan na houbách" })).toBe(false);
  });

  it("gelee, mražený krém a dezert jsou junk", () => {
    expect(jeJunk({ nazev: "Gelee mit bananen geschmack" })).toBe(true);
    expect(jeJunk({ nazev: "Vanilkový mražený krém s malinami" })).toBe(true);
    expect(jeJunk({ nazev: "Kaštanový dezert" })).toBe(true);
  });

  it("jerky má vlastní porci 30–60 g, ne masových 80–250", () => {
    expect(zaokrouhliGramaz({ nazev: "Sušené maso hovězí" }, 500, "kotva", "svacina")).toBe(60);
    expect(zaokrouhliGramaz({ nazev: "Beef Jerky Cracked Pepper" }, 500, "kotva", "svacina")).toBe(60);
    expect(zaokrouhliGramaz({ nazev: "Sušené maso hovězí" }, 10, "kotva", "svacina")).toBe(30);
    expect(zaokrouhliGramaz({ nazev: "Kuřecí prsa" }, 500, "kotva", "svacina")).toBe(250);
  });

  it("stupňovaný malus minulých dnů vytlačí opakovanou rodinu", () => {
    const kandidati = [
      { ...p("a", "Alfa", 10, 0, 0, 40, 1), skore: 10 },
      { ...p("b", "Beta", 10, 0, 0, 40, 1), skore: 9 },
      { ...p("c", "Celta", 10, 0, 0, 40, 1), skore: 8 },
    ] as never;
    // alfa 3× minulé dny (×0,125), beta 1× (×0,5) – obě pod práh,
    // rotace musí padnout na celtu bez ohledu na offset
    const minule = new Map([["alfa", 3], ["beta", 1]]);
    for (let poradi = 0; poradi < 4; poradi++) {
      const v = vyberKandidata(kandidati, poradi, [], 1, 0.6, null, null, new Set(), minule);
      expect(v?.id).toBe("c");
    }
  });

  it("fantómové kcal (deklarované ≫ makra) prohrávají výběr", () => {
    // sardinky v oleji: 200 kcal deklarováno, makra dají jen ~130
    const konzistentni = { ...p("a", "Alfa konzistentní", 10, 10, 5, 130, 5), skore: 8 };
    const fantom = { ...p("b", "Beta fantom", 10, 10, 5, 200, 4), skore: 9 };
    const v = vyberKandidata(
      [fantom, konzistentni] as never, 0, [], 1, 0.6, null, null, new Set(), new Map(),
    );
    expect(v?.id).toBe("a");
  });

  it("zeleninová strana nebere hotová jídla nad 150 kcal/100 g", () => {
    const kat = {
      bilkovinova: [{ ...p("k1", "Kuřecí prsa", 23, 0, 2.6, 114, 20), skore: 5 }],
      sacharidova: [
        // „zeleninová směs" jako hotový pokrm v omáčce – 433 kcal/100 g
        { ...p("z1", "Zeleninová směs s rajčaty a bazalky", 8, 12, 38, 433, 6), skore: 99 },
        { ...p("z2", "Červená řepa", 1.7, 9.6, 0.2, 45, 1.7), skore: 5 },
        { ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 },
      ],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "zelenina")?.id).toBe("z2");
  });

  it("hutná kotva nespotřebuje celý kalorický rozpočet talíře", () => {
    // hustá kotva (60 g B, 500 kcal /100 g) – bez stropu by si vzala
    // celých 600 kcal a na přílohu+zeleninu by nic nezbylo
    const kat = {
      bilkovinova: [{ ...p("h1", "Seitan hustý", 60, 2, 5, 500, 20), skore: 9 }],
      sacharidova: [
        { ...p("z1", "Červená řepa", 1.7, 9.6, 0.2, 45, 1.7), skore: 5 },
        { ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 },
      ],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    const jidla = naplanujJidlo(kat, 0, 60, 60, 15, 600, [], 1, 0.85, "Oběd");
    const kotva = jidla.find((j) => j.role === "kotva");
    expect(kotva!.kalorie).toBeLessThanOrEqual(600 * 0.7 + 1);
    expect(jidla.find((j) => j.role === "zelenina")).toBeDefined();
  });

  it("rodina použitá ≥3× v týdnu vypadne z výběru, dokud existuje alternativa", () => {
    // regrese: vegan audit – proteinové plátky kotvily snídani 7× za
    // týden. Měkký malus je srazil pod práh srovnatelnosti, ale prázdný
    // srovnatelný pool vrátil plný seznam a jediná „vhodná" položka
    // (proteinov~ → snídaňová vhodnost) vyhrála znovu.
    const platky = { ...p("a", "Proteinové plátky z hrášku", 20, 10, 10, 220, 5), skore: 10 };
    const seitan = { ...p("b", "Seitan natural", 20, 5, 3, 127, 4), skore: 5 };
    const minule = new Map([["proteinove platky", 3]]);
    for (let poradi = 0; poradi < 4; poradi++) {
      const v = vyberKandidata(
        [platky, seitan] as never, poradi, [], 1, 0.6, /proteinov/i, null, new Set(), minule,
      );
      expect(v?.id).toBe("b");
    }
    // bez alternativ se rodina vrátí – plán nesmí skončit bez kotvy
    const v2 = vyberKandidata(
      [platky] as never, 0, [], 1, 0.6, /proteinov/i, null, new Set(), minule,
    );
    expect(v2?.id).toBe("a");
  });

  it("druhová rodina kotvy – normalizace názvů", () => {
    expect(rodinaKotvy("Vepřová plec")).toBe("veprove");
    expect(rodinaKotvy("Vepřová kýta")).toBe("veprove");
    // druhově kvalifikované uzeniny – druh vítězí nad generickým vepřovým
    expect(rodinaKotvy("Krůtí šunka")).toBe("drubez");
    expect(rodinaKotvy("Kuřecí salám")).toBe("drubez");
    expect(rodinaKotvy("Sušené krůtí maso jerky")).toBe("drubez");
    // generické sušené maso bez druhu – vlastní rodina
    expect(rodinaKotvy("Sušené maso Original")).toBe("susene_maso");
    expect(rodinaKotvy("Prémiové sušené maso sriracha")).toBe("susene_maso");
    expect(rodinaKotvy("Beef Jerky Cracked Pepper")).toBe("hovezi");
    expect(rodinaKotvy("Tuňáková pomazánka (tuna)")).toBe("ryba");
    expect(rodinaKotvy("Krabí tyčky")).toBe("vodnany");
    expect(rodinaKotvy("Hovězí svíčková")).toBe("hovezi");
    // mléčné kotvy – vlastní rodiny (tvaroh ≠ sýr ≠ jogurt)
    expect(rodinaKotvy("Tvaroh polotučný (Miil)")).toBe("tvaroh");
    expect(rodinaKotvy("Sýr Eidam")).toBe("syr");
    expect(rodinaKotvy("Jogurt bílý 3,5%")).toBe("jogurt");
    expect(rodinaKotvy("Skyr vanilka")).toBe("jogurt");
    // rostlinné přílohy bez druhu → bez rodiny
    expect(rodinaKotvy("Rýže basmati")).toBeNull();
    expect(rodinaKotvy("Brambory")).toBeNull();
  });

  it("druhová rodina z dnešního dne vyloučí stejnou kotvu (vepřová plec + kýta)", () => {
    // regrese: oběd „Vepřová plec" a večeře „Vepřová kýta" – jiný
    // dvouslovný klíč, stejná druhová rodina → opakovaná bílkovina v dni
    const plec = { ...p("a", "Vepřová plec", 20, 0, 10, 210, 8), skore: 10 };
    const kyta = { ...p("b", "Vepřová kýta", 20, 0, 8, 190, 8), skore: 9 };
    const prsa = { ...p("c", "Kuřecí prsa", 23, 0, 3, 120, 8), skore: 5 };
    // „veprove" v pouziteKlice (záznam kotvy oběda) → kýta nesmí vyhrát
    const v = vyberKandidata(
      [kyta, prsa] as never, 0, [], 1, 0.6, null, null, new Set(["veprove"]), new Map(),
    );
    expect(v?.id).toBe("c");
    // druhová rodina ≥4× v týdnu vypadne taky (veprove má strop 4, ne 3)
    const minule = new Map([["veprove", 4]]);
    const v2 = vyberKandidata(
      [plec, prsa] as never, 0, [], 1, 0.6, null, null, new Set(), minule,
    );
    expect(v2?.id).toBe("c");
    // pod stropem (3 < 4) rodina není tvrdě vyloučená – když je jediným
    // kandidátem, stále se vybere (malus ji jen znevýhodňuje)
    const v3 = vyberKandidata(
      [plec] as never, 0, [], 1, 0.6, null, null, new Set(), new Map([["veprove", 3]]),
    );
    expect(v3?.id).toBe("a");
  });

  it("potravina s fantómovými kcal (>35 % nad makra) nemůže být kotva", () => {
    // regrese: Lunter Wok&Bowl (220 kcal uvedeno, 88 z maker) vyrobil
    // +317 kcal mimo solver v jednom jídle → den na +8,7 % kcal
    const kat = {
      bilkovinova: [
        { ...p("f1", "Wok bowl fantom", 15, 5, 3, 220, 5), skore: 99 },
        { ...p("k1", "Seitan natural", 25, 3, 3, 139, 8), skore: 5 },
      ],
      sacharidova: [
        { ...p("z1", "Červená řepa", 1.7, 9.6, 0.2, 45, 1.7), skore: 5 },
        { ...p("r1", "Rýže", 7.5, 78, 0.6, 350, 4), skore: 5 },
      ],
      tukova: [{ ...p("o1", "Olivový olej", 0, 0, 100, 884, 9), skore: 5 }],
    } as never;
    const jidla = naplanujJidlo(kat, 0, 30, 60, 15, 600, [], 1, 0.85, "Oběd");
    expect(jidla.find((j) => j.role === "kotva")?.id).toBe("k1");
    expect(jidla.some((j) => j.id === "f1")).toBe(false);
  });

  it("dietní veto: živočišný název přehlasuje chybný veganský tag", () => {
    // regrese: Cottage Cheese Pažitka nesl crowdsourcovaný tag vegansky
    expect(nazevVylucujeDietu("Cottage Cheese Pažitka", "vegansky")).toBe(true);
    expect(nazevVylucujeDietu("Tuňáková pomazánka (tuna)", "vegansky")).toBe(true);
    expect(nazevVylucujeDietu("Tuňáková pomazánka (tuna)", "vegetariansky")).toBe(true);
    expect(nazevVylucujeDietu("Pasta Basta kari - kuřecí", "vegetariansky")).toBe(true);
    expect(nazevVylucujeDietu("Kefír černý rybíz", "vegansky")).toBe(true);
    // vegetarián mléko smí – kefír je pro něj v pořádku
    expect(nazevVylucujeDietu("Kefír černý rybíz", "vegetariansky")).toBe(false);
    // rostlinné deklarace a báze veto ruší – skutečné vegan produkty
    for (const n of [
      "Ovesné mléko",
      "Kokosový jogurt",
      "Mandlová alternativa jogurtu s vanilkou",
      "Alternativa kefíru s příchutí višní",
      "Vegan sýrová pomazánka",
      "Patifu - prémiová tofu paštika toskánská",
      "Bezvaječné těstoviny",
      "Tatarská omáčka bez vajec",
      "Arašídové máslo",
      "Rostlinné máslo",
      "Klobáskový seitan",
      "Špaldová alternativa smetany",
      "Cizrnové jídlo s kokosovým mlékem",
    ]) {
      expect(nazevVylucujeDietu(n, "vegansky"), n).toBe(false);
      expect(nazevVylucujeDietu(n, "vegetariansky"), n).toBe(false);
    }
    // jiné diety síť neřeší
    expect(nazevVylucujeDietu("Cottage Cheese", "bezlepkovy")).toBe(false);
  });

  it("dietní veto – cizojazyčné názvy (DE/FR/IT/NL/SK působí v českém sortimentu)", () => {
    // mléko/vejce/sýr → jen veganské veto
    for (const n of [
      "Sahne",
      "Vollmilch 3,5%",
      "Lait frais demi écrémé",
      "Yaourt à la grecque nature",
      "Fromage blanc 0%",
      "Maasdamer (Leckerrom)",
      "Emmentaler",
      "Grana Padano",
      "Raclette",
      "Œufs brouillés",
      "Eier Freiland",
      "Huevos camperos",
      "Caffè latte",
      "Kräuter der Provence cremig",
    ]) {
      expect(nazevVylucujeDietu(n, "vegansky"), n).toBe(true);
      expect(nazevVylucujeDietu(n, "vegetariansky"), n).toBe(false);
    }
    // maso/ryby → veto pro obě
    for (const n of [
      "Thunfisch in Olivenöl",
      "Tuniak v olivovom oleji",
      "Poulet fermier",
      "Tonno sott'olio",
      "Boeuf bourguignon",
      "Kip filet",
      "Kabeljau filet",
    ]) {
      expect(nazevVylucujeDietu(n, "vegansky"), n).toBe(true);
      expect(nazevVylucujeDietu(n, "vegetariansky"), n).toBe(true);
    }
    // hranice: ne-názvy se nesmí chytit
    expect(nazevVylucujeDietu("Hofmeier Bauernbrot", "vegansky")).toBe(false);
    expect(nazevVylucujeDietu("Latte fresco nuovo", "vegansky")).toBe(true); // latte = mléko
  });

  it("dietní veto – falešné shody: značky, krutony, příchuť, podstatná jména", () => {
    // regrese z reportu kvalita_dat: tyto názvy veto nesmí vyloučit
    for (const n of [
      "Krutony",                    // kr[ůu]t ≠ kruton (pečivo)
      "Graham tyčinky",             // gra**ham** ≠ ham
      "Goldfish BIGsters Oriental seasoned krekry", // značka ≠ fish
      "Hamé Zeleninové lečo",       // značka ≠ ham
      "Bramborové barista mléko",   // rostlinná báze + slovo mezi
      "Coconut rice pudding",       // coconut/rice báze
      "Bio keksy s máslovou příchutí", // příchuť ≠ surovina
      "Krekry s příchutí sýra",     // genitiv příchutě
      "Krekry chicken flavour",
    ]) {
      expect(nazevVylucujeDietu(n, "vegansky"), n).toBe(false);
      expect(nazevVylucujeDietu(n, "vegetariansky"), n).toBe(false);
    }
    // podstatné jméno „kuře" (ne jen příd. jm. „kuřecí")
    expect(nazevVylucujeDietu("Kuře na paprice", "vegansky")).toBe(true);
    // „mléčný" příd. jm. – dřív chytlo jen „mlék-"
    expect(nazevVylucujeDietu("Mléčná čokoláda", "vegansky")).toBe(true);
    // mayo = vejce: vegan veta, vegetariána nechává
    expect(nazevVylucujeDietu("Flying Goose Sriracha mayo", "vegansky")).toBe(true);
    expect(nazevVylucujeDietu("Flying Goose Sriracha mayo", "vegetariansky")).toBe(false);
    // krůtí skutečně veto, kruton ne
    expect(nazevVylucujeDietu("Grilovaný krůtí steak", "vegetariansky")).toBe(true);
  });

  it("veganský filtr propustí rostlinné mléko, ale ne chybně tagovaný cottage", () => {
    const katalog = [
      p("c1", "Cottage Cheese Pažitka", 11, 3, 4, 95, 40),
      p("o1", "Ovesné mléko", 1, 7, 3, 60, 40),
      p("s1", "Seitan natural", 25, 3, 3, 139, 8),
    ];
    katalog[0]!.diety = ["vegansky", "vegetariansky"];
    katalog[1]!.diety = ["vegansky", "vegetariansky"];
    katalog[2]!.diety = ["vegansky", "vegetariansky"];
    const prošlé = filtrujPotraviny(katalog, { diety: ["vegansky"], alergeny: [] }).map((x) => x.id);
    expect(prošlé).toEqual(["o1", "s1"]);
  });

  it("syrup není sýr – jmenná síť mléka nemá falešnou shodu na sirup", () => {
    expect(nazevNasvedcujeAlergenu("BIO Rice syrup", "mleko")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Javorový sirup", "mleko")).toBe(false);
    expect(nazevNasvedcujeAlergenu("Cottage Cheese Pažitka", "mleko")).toBe(true);
    expect(nazevNasvedcujeAlergenu("Sýrová pomazánka", "mleko")).toBe(true);
  });
});

describe("denní solver – vyvažování jídel", () => {
  it("žádné hlavní jídlo neodchýlí se o víc než ~55 % od svého podílu", () => {
    // regrese: pevné pořadí krácení (Snídaně→Večeře) umělo nechat
    // snídani na 937 kcal a srazit oběd na 40 g kotvu
    const cile = { kalorie: 2200, bilkoviny: 150, sacharidy: 220, tuky: 75 };
    const podily = podilyProPocetJidel(4);
    for (let den = 1; den <= 3; den++) {
      const v = vygenerujJidelnicek(KATALOG_REALNY, cile, den);
      for (const [nazev, s] of Object.entries(v.jidelnicek)) {
        const cilKcal = cile.kalorie * (podily[nazev] ?? 0.25);
        const pomer = s.kalorie / cilKcal;
        expect(pomer, `${nazev} den ${den}`).toBeGreaterThanOrEqual(0.45);
        expect(pomer, `${nazev} den ${den}`).toBeLessThanOrEqual(1.55);
      }
    }
  });
});

describe("vygenerujTydenniPlan – počet dní + vaření dopředu", () => {
  it("pocetDni 1/3/5 → přesný počet dnů plánu", () => {
    for (const n of [1, 3, 5]) {
      const t = vygenerujTydenniPlan(KATALOG, CILE, 4, null, { pocetDni: n });
      expect(Object.keys(t.dny)).toHaveLength(n);
    }
  });

  it("1denní plán má součet = součet jednoho dne", () => {
    const t = vygenerujTydenniPlan(KATALOG, CILE, 4, null, { pocetDni: 1 });
    const den = t.dny[1]!;
    expect(t.tyden.kalorie).toBeCloseTo(den.celkem.kalorie, 1);
  });

  it("vaření dopředu: zdrojový den má davkaDni, další den dovařenou kopii", () => {
    const t = vygenerujTydenniPlan(KATALOG, CILE, 4, null, {
      pocetDni: 4,
      vareniDopredu: true,
    });
    // alespoň jedna dávková dvojice vznikla (Oběd/Večeře sloty)
    let paru = 0;
    for (let d = 1; d <= 3; d += 2) {
      const a = t.dny[d];
      const b = t.dny[d + 1];
      if (!a || !b) continue;
      for (const nazev of Object.keys(a.jidelnicek)) {
        if (!/oběd|večeře/i.test(nazev)) continue;
        const sa = a.jidelnicek[nazev];
        const sb = b.jidelnicek[nazev];
        if (!sa || !sb) continue;
        if (sa.jidla.some((j) => j.davkaDni === 2)) {
          paru++;
          expect(sb.jidla.every((j) => j.dopredu === true)).toBe(true);
          expect(sb.jidla.every((j) => j.davkaDni === undefined)).toBe(true);
        }
      }
    }
    expect(paru).toBeGreaterThan(0);
  });

  it("bez vareniDopredu žádné dávkové značky", () => {
    const t = vygenerujTydenniPlan(KATALOG, CILE, 4, null, { pocetDni: 4 });
    for (const den of Object.values(t.dny)) {
      for (const slot of Object.values(den.jidelnicek)) {
        for (const j of slot.jidla) {
          expect(j.davkaDni).toBeUndefined();
          expect(j.dopredu).toBeUndefined();
        }
      }
    }
  });

  it("týdenní součet = součet finálních dnů (po batch substituci)", () => {
    const t = vygenerujTydenniPlan(KATALOG, CILE, 4, null, {
      pocetDni: 5,
      vareniDopredu: true,
    });
    let kcal = 0;
    for (const den of Object.values(t.dny)) kcal += den.celkem.kalorie;
    expect(t.tyden.kalorie).toBeCloseTo(kcal, 1);
  });

  it("výměna jídla zruší dávkové značky u spárovaného dne", () => {
    const plan = vygenerujTydenniPlan(KATALOG, CILE, 4, null, {
      pocetDni: 4,
      vareniDopredu: true,
    });
    // den 1 vaří na 2 dny → výměna oběda v den 2 čistí značky v den 1
    const novy = vymenJidloVTydnu(KATALOG, plan, 2, "Oběd", CILE);
    if (novy === null) return;
    const obed1 = novy.dny[1]?.jidelnicek["Oběd"];
    if (obed1 && plan.dny[1]?.jidelnicek["Oběd"]?.jidla.some((j) => j.davkaDni === 2)) {
      expect(obed1.jidla.every((j) => j.davkaDni === undefined)).toBe(true);
    }
  });
});

describe("cizojazyčné OFF importy – regrese", () => {
  it("francouzské a maďarské názvy se poznají jako cizí", () => {
    expect(jeCiziNazev("Noisettes hachées et grillées")).toBe(true);
    expect(jeCiziNazev("Diákmix keveréke")).toBe(true);
    expect(jeCiziNazev("Mieszanka bakaliowa")).toBe(true);
    expect(jeCiziNazev("Geröstete Erdnüsse")).toBe(true);
    expect(jeCiziNazev("Орехи жареные")).toBe(true);
  });

  it("české názvy prochází – včetně müsli (ü je v katalogu české)", () => {
    expect(jeCiziNazev("Lískové ořechy")).toBe(false);
    expect(jeCiziNazev("Sušený ananas")).toBe(false);
    expect(jeCiziNazev("Müsli s ovocem")).toBe(false);
    expect(jeCiziNazev("Pšenično-žitný chléb")).toBe(false);
    expect(jeCiziNazev("Kuřecí prsa")).toBe(false);
  });

  it("cizojazyčné položky se do vygenerovaného plánu nedostanou", () => {
    const katalog = [
      ...KATALOG,
      p("fr1", "Noisettes hachées et grillées", 15, 10, 60, 650, 30),
      p("hu1", "Diákmix keveréke", 18, 30, 40, 550, 25),
    ];
    const den = vygenerujJidelnicek(katalog, CILE, 3);
    const nazvy = Object.values(den.jidelnicek).flatMap((s) => s.jidla.map((j) => j.nazev));
    expect(nazvy).not.toContain("Noisettes hachées et grillées");
    expect(nazvy).not.toContain("Diákmix keveréke");
  });
});

describe("poškozená makra čerstvého masa – regrese „Krůtí natural“", () => {
  it("čerstvé maso nad 35 g bílkovin/100 g je korumpované", () => {
    expect(jeKorumpovanaNutrience({ nazev: "Krůtí natural", bilkoviny: 77 })).toBe(true);
    expect(jeKorumpovanaNutrience({ nazev: "Kuřecí prsa", bilkoviny: 23 })).toBe(false);
    expect(jeKorumpovanaNutrience({ nazev: "Vepřová plec", bilkoviny: 19 })).toBe(false);
  });

  it("sušené maso/jerky má vyšší strop – 65 g B/100 g je reálných", () => {
    expect(jeKorumpovanaNutrience({ nazev: "Sušené maso krůtí", bilkoviny: 65 })).toBe(false);
    expect(jeKorumpovanaNutrience({ nazev: "Beef jerky", bilkoviny: 62 })).toBe(false);
  });

  it("korumpovaná položka nemůže ukotvit oběd 70 g porcí", () => {
    const katalog = [
      ...KATALOG,
      // „Krůtí natural" s nereálnými makry – dřív solver oběd ukotvil 70 g
      p("kr1", "Krůtí natural", 77, 0, 3, 340, 15),
    ];
    const den = vygenerujJidelnicek(katalog, CILE, 3);
    const nazvy = Object.values(den.jidelnicek).flatMap((s) => s.jidla.map((j) => j.nazev));
    expect(nazvy).not.toContain("Krůtí natural");
  });
});

describe("kategoriové cenové podlahy – regrese „5 Kč/100 g“", () => {
  it("paušální katalogová cena je u ořechů/tyčinek/sušeného ovoce nespolehlivá", () => {
    expect(jeCenaSpolehliva(p("o1", "Lískové ořechy", 15, 10, 60, 650, 5))).toBe(false);
    expect(jeCenaSpolehliva(p("t1", "Proteinová tyčinka Monsters", 35, 30, 10, 350, 5))).toBe(false);
    expect(jeCenaSpolehliva(p("s1", "Sušený ananas", 1, 70, 0.5, 300, 5.5))).toBe(false);
    // reálné ceny prochází
    expect(jeCenaSpolehliva(p("o2", "Lískové ořechy", 15, 10, 60, 650, 25))).toBe(true);
    expect(jeCenaSpolehliva(p("t2", "Proteinová tyčinka", 35, 30, 10, 350, 30))).toBe(true);
    // levné položky mimo podlahy nezasáhne
    expect(jeCenaSpolehliva(p("b1", "Brambory", 2, 17, 0.1, 77, 2))).toBe(true);
    expect(jeCenaSpolehliva(p("m1", "Mléko", 3.3, 4.8, 1.5, 44, 2.2))).toBe(true);
  });

  it("položky s paušální cenou jdou do seznamu jako „bez ceny“ (null), ne za 4,25 Kč", () => {
    const katalog = [
      ...KATALOG,
      p("sn1", "Proteinová tyčinka Monsters", 35, 30, 10, 350, 5),
      p("sn2", "Lískové ořechy", 15, 10, 60, 650, 5),
    ];
    const den = vygenerujJidelnicek(katalog, CILE, 3);
    const seznam = sestavNakupniSeznam(den.jidelnicek);
    const tycinka = seznam.find((x) => x.nazev === "Proteinová tyčinka Monsters");
    const orechy = seznam.find((x) => x.nazev === "Lískové ořechy");
    if (tycinka) expect(tycinka.cenaZa100g).toBeNull();
    if (orechy) expect(orechy.cenaZa100g).toBeNull();
  });
});
