/**
 * Sdílené vyhledávání – diakritika-insenzitivní porovnávání a
 * relevance řazení. Používá katalog i picker potravin, aby se
 * chovaly stejně („kureci" → „kuřecí" všude).
 */

/** Normalizace pro hledání: NFD → strip diakritiky → lowercase. */
export function bezDiakritiky(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Relevance skóre shody názvu s dotazem (oba již normalizované):
 *  3 – název začíná dotazem (nejlepší)
 *  2 – dotaz na začátku slova uvnitř názvu
 *  1 – dotaz kdekoli jako podřetězec
 *  0 – žádná shoda
 */
export function skoreShody(nazevNorm: string, dotazNorm: string): number {
  if (dotazNorm === "") return 1;
  if (nazevNorm.startsWith(dotazNorm)) return 3;
  // začátek slova = po mezeře, pomlčce nebo lomítku
  const slovo = nazevNorm.indexOf(` ${dotazNorm}`);
  const pomlcka = nazevNorm.indexOf(`-${dotazNorm}`);
  const lomitko = nazevNorm.indexOf(`/${dotazNorm}`);
  if (slovo >= 0 || pomlcka >= 0 || lomitko >= 0) return 2;
  if (nazevNorm.includes(dotazNorm)) return 1;
  return 0;
}
