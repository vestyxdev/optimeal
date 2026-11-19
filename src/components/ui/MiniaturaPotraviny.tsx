import { useState } from "react";
import { Package } from "lucide-react";

/**
 * MiniaturaPotraviny – jednotný náhled potraviny napříč aplikací
 * (katalog, jídelníček, nákupní seznam, recepty, OFF picker).
 *
 * - bez `obrazek` nebo při chybě načtení → neutrální placeholder s ikonou
 * - `ikona` lze předat vlastní (např. ikonu kategorie), výchozí Package
 * - dekorativní (alt=""), tisk se skrývá v index.css
 */
export function MiniaturaPotraviny({
  obrazek,
  velikost = "size-8",
  inline = false,
  ikona: Ikona = Package,
}: {
  obrazek?: string | null | undefined;
  velikost?: string;
  /** inline-block pro použití v tabulkových buňkách vedle textu */
  inline?: boolean;
  ikona?: typeof Package;
}) {
  const [chybi, setChybi] = useState(false);

  if (!obrazek || chybi) {
    return (
      <span
        className={`${inline ? "mr-2 inline-flex align-middle" : "flex shrink-0"} ${velikost} items-center justify-center rounded-md bg-surface-2 text-muted`}
        aria-hidden
      >
        <Ikona className="size-3/5" />
      </span>
    );
  }

  return (
    <img
      src={obrazek}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${inline ? "mr-2 inline-block align-middle" : "shrink-0"} ${velikost} rounded-md object-cover`}
      onError={() => setChybi(true)}
    />
  );
}
