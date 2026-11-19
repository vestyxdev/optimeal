/**
 * Chytré formátování cen pro zobrazení.
 *
 * Ceny jsou v DB normalizované na Kč/100 g. Zákazník ale čte
 * cenu za balení – české e-shopy a letáky ukazují velkou cenu
 * balení + malou jednotkovou (zákon to dokonce vyžaduje).
 *
 * Pravidla:
 *  - baleniG známé  → hlavní „~25 Kč" (balení), vedlejší jednotková + gramáž
 *  - baleniG null   → vážené zboží → hlavní „14,90 Kč/kg" (DB ×10)
 *  - cena ≤ 0       → „—"
 */

export interface CenaZobrazeni {
  /** hlavní cena – velká, čitelná */
  hlavni: string;
  /** jednotková cena / gramáž – drobný podtitulek, může být null */
  vedlejsi: string | null;
}

const carkou = (n: number) => n.toFixed(2).replace(".", ",");

export function formatujCenu(
  cenaZa100g: number,
  baleniG?: number | null,
): CenaZobrazeni {
  if (!Number.isFinite(cenaZa100g) || cenaZa100g <= 0) {
    return { hlavni: "—", vedlejsi: null };
  }
  if (baleniG && baleniG > 0) {
    const baleni = (cenaZa100g * baleniG) / 100;
    return {
      hlavni: `~${Math.round(baleni)} Kč`,
      vedlejsi: `${carkou(cenaZa100g)} Kč/100 g · ${Math.round(baleniG)} g`,
    };
  }
  return { hlavni: `${carkou(cenaZa100g * 10)} Kč/kg`, vedlejsi: null };
}

/** Zkratka pro objekt s poli aktualniCena/baleniG (Potravina, PolozkaVyberu). */
export function formatujCenuPolozky(p: {
  aktualniCena: number;
  baleniG?: number | null;
}): CenaZobrazeni {
  return formatujCenu(p.aktualniCena, p.baleniG);
}

export interface ReferencniCena {
  /** referenční cena za 100 g (přeškrtnutá u slevy) */
  cena: number;
  /** true = reálně zveřejněná původní cena obchodu; false = běžná cena (medián reálných pozorování) */
  jePuvodni: boolean;
}

/**
 * Přeškrtnutá referenční cena u slevy.
 * 1) puvodni_cena – skutečná přeškrtnutá cena z letáku/obchodu (včetně
 *    Kupi „běžně stojí"), když ji zdroj zveřejnil.
 * 2) jinak bezna_cena – medián reálně pozorovaných cen produktu,
 *    zobrazuje se jako „běžně ~X" (nejde o původní cenu obchodu).
 * Referenční cena se ukazuje jen když je nad aktuální – jinak by
 * „sleva" vizuálně lživě vypadala jako zdražení.
 */
export function referencniCena(
  aktualniCena: number,
  puvodniCena?: number | null,
  beznaCena?: number | null,
): ReferencniCena | null {
  if (puvodniCena != null && puvodniCena > aktualniCena) {
    return { cena: puvodniCena, jePuvodni: true };
  }
  if (beznaCena != null && beznaCena > aktualniCena) {
    return { cena: beznaCena, jePuvodni: false };
  }
  return null;
}

const makroFmt = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const castkaFmt = new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const kcFmt = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

/** Makroživiny na max. 1 des. místo, česky s čárkou („7,7"). */
export function formatujMakro(n: number): string {
  return makroFmt.format(n);
}

/** Kilokalorie jako celé číslo s českým oddělovačem („2 450"). */
export function formatujKcal(n: number): string {
  return kcFmt.format(Math.round(n));
}

/** Peněžní částka na 2 des. místa česky („45,90"). Bez jednotky. */
export function formatujCastku(n: number): string {
  return castkaFmt.format(n);
}

/** Celé koruny česky s oddělovačem tisíců („2 450"). Bez „Kč". */
export function formatujKc(n: number): string {
  return kcFmt.format(n);
}

const DNY_KRATCE = ["ne", "po", "út", "st", "čt", "pá", "so"];

/**
 * Konec platnosti akce jako „do út 18. 11.“ / „do dneška“.
 * Letákové slevy trvají max týden – den v týdnu je pro nakupujícího
 * praktičtější než holé datum.
 */
export function formatujPlatnostDo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);
  if (d.getTime() === dnes.getTime()) return "do dneška";
  return `do ${DNY_KRATCE[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
}
