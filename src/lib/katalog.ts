import type { KatalogPotravina } from "@/lib/data/potraviny";
import { bezDiakritiky, skoreShody } from "@/lib/vyhledavani";
import { gramyBilkovinNa100Kc } from "@/lib/vyziva/hodnota";

/** Režimy řazení katalogu – všechny z reálných dat, žádné odhady. */
export type RazeniKatalogu = "relevance" | "cena" | "jednotkova" | "sleva" | "bilkovinyCena";

/** Cena balení pro řazení – bez gramáže vážené zboží bere Kč/kg. */
function cenaBaleni(p: KatalogPotravina): number {
  if (p.baleniG != null && p.baleniG > 0) return (p.aktualniCena * p.baleniG) / 100;
  return p.aktualniCena * 10; // vážené → Kč/kg
}

/** Stabilní komparátor pro zvolený režim řazení. */
function seradit(vybrane: KatalogPotravina[], razeni: RazeniKatalogu): void {
  // potraviny bez nutric vždy až nakonec (krom řazení na výživu)
  const nutricNejprve = (a: KatalogPotravina, b: KatalogPotravina) =>
    Number(b.kalorie > 0) - Number(a.kalorie > 0);
  switch (razeni) {
    case "cena":
      vybrane.sort(
        (a, b) => cenaBaleni(a) - cenaBaleni(b) || nutricNejprve(a, b),
      );
      break;
    case "jednotkova":
      // ceny jsou normalizované na Kč/100 g – přímé porovnání
      vybrane.sort(
        (a, b) => a.aktualniCena - b.aktualniCena || nutricNejprve(a, b),
      );
      break;
    case "sleva":
      // jen ověřené slevy (view flag sleva = zdrojem ověřená původní cena)
      vybrane.sort(
        (a, b) =>
          (b.slevaProcenta ?? -1) - (a.slevaProcenta ?? -1) || nutricNejprve(a, b),
      );
      break;
    case "bilkovinyCena":
      // g bílkovin za 100 Kč; bez ceny/výživy klesne na konec
      vybrane.sort(
        (a, b) =>
          (gramyBilkovinNa100Kc(b.bilkoviny, b.aktualniCena) ?? -1) -
            (gramyBilkovinNa100Kc(a.bilkoviny, a.aktualniCena) ?? -1) ||
          nutricNejprve(a, b),
      );
      break;
    case "relevance":
      vybrane.sort(nutricNejprve);
      break;
  }
}

/**
 * Filtrace katalogu: diakritika-insenzitivní hledání v názvu s
 * relevance řazením (prefix > začátek slova > podřetězec),
 * čistě číselný dotaz hledá i v EAN.
 */
export function filtrujKatalog(
  potraviny: KatalogPotravina[],
  dotaz: string,
  kategorie: string,
  jenSlevy = false,
  razeni: RazeniKatalogu = jenSlevy ? "sleva" : "relevance",
): KatalogPotravina[] {
  const dot = bezDiakritiky(dotaz.trim());
  const eanDotaz = dot.replace(/[\s-]/g, "");
  const jeEan = /^\d{4,14}$/.test(eanDotaz);
  const skore = new Map<string, number>();

  const vybrane = potraviny.filter((p) => {
    if (kategorie !== "vse" && p.kategorie !== kategorie) return false;
    if (jenSlevy && !p.sleva) return false;
    if (dot === "") return true;
    const s = skoreShody(bezDiakritiky(p.nazev), dot);
    if (s > 0) {
      skore.set(p.id, s);
      return true;
    }
    return jeEan && p.ean !== null && p.ean.includes(eanDotaz);
  });

  if (dot !== "" && razeni === "relevance") {
    // při hledání vede relevance: prefix → začátek slova → podřetězec
    vybrane.sort(
      (a, b) =>
        (skore.get(b.id) ?? 0) - (skore.get(a.id) ?? 0) ||
        Number(b.kalorie > 0) - Number(a.kalorie > 0),
    );
    return vybrane;
  }
  seradit(vybrane, razeni);
  return vybrane;
}
