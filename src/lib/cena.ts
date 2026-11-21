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

/**
 * Přeškrtnutá původní cena u slevy (Kč/100 g) – pouze ta, kterou
 * zdroj skutečně zveřejnil (letákové % / přeškrtnutá cena, e-shopová
 * was-price, Kupi „běžně stojí"). Nikdy žádný odhad z mediánu
 * ani historie – bez zdrojové ceny se vrací null a UI ukáže
 * holou aktuální cenu.
 */
export function referencniCena(
  aktualniCena: number,
  puvodniCena?: number | null,
): number | null {
  if (!Number.isFinite(aktualniCena) || aktualniCena <= 0) return null;
  if (puvodniCena == null || !Number.isFinite(puvodniCena)) return null;
  // Stejné meze jako view aktualni_ceny: původní cena musí znamenat
  // aspoň ~1 % slevu a nesmí přesáhnout 2,5× aktuální – nad ~60 % slevy
  // jde o pack-mismatch artefakt, ne o reálnou přeškrtnutou cenu.
  if (puvodniCena < aktualniCena * 1.01 || puvodniCena > aktualniCena * 2.5) {
    return null;
  }
  return puvodniCena;
}

/**
 * Ověřené procento slevy – stejný výpočet jako view
 * (`round((1 - cena/původní) * 100)`). Vrací null, když původní
 * cena sanity mezemi neprojde.
 */
export function slevaProcenta(
  aktualniCena: number,
  puvodniCena?: number | null,
): number | null {
  const puvodni = referencniCena(aktualniCena, puvodniCena);
  if (puvodni == null) return null;
  return Math.round(Math.max(0, 1 - aktualniCena / puvodni) * 100);
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

/**
 * Stáří cenového pozorování – „včera" / „z 18. 11." / null.
 * Zdroje se aktualizují jednou denně, ale letáky končí a scrape
 * občas vypadne – bez popisku vypadá i týden stará cena jako
 * živá. Dnešní cena vrací null (nic k hlášení), stejně tak
 * neznámé/nevalidní datum (nevymýšlíme si).
 */
export function formatujStariCeny(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);
  const pozor = new Date(d);
  pozor.setHours(0, 0, 0, 0);
  const dnyStari = Math.round((dnes.getTime() - pozor.getTime()) / 86400e3);
  if (dnyStari <= 0) return null;
  if (dnyStari === 1) return "včera";
  return `z ${d.getDate()}. ${d.getMonth() + 1}.`;
}
