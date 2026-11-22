// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TydnySouhrn } from "@/components/denik/TydnySouhrn";
import type { PoznamkaDeniku } from "@/lib/data/denik";

const nactiCenoveHladiny = vi.fn();
vi.mock("@/lib/data/nakup", () => ({
  nactiCenoveHladiny: (ids: string[]) => nactiCenoveHladiny(ids),
}));

afterEach(() => cleanup());

function poz(over: Partial<PoznamkaDeniku>): PoznamkaDeniku {
  return {
    id: Math.random().toString(36).slice(2),
    foodId: "f1",
    nazev: "X",
    obrazek: null,
    typJidla: "snidane",
    mnozstviG: 100,
    zapsanoDne: "2026-11-22",
    zapsanoAt: "2026-11-22T08:00:00Z",
    kalorie: 100,
    bilkoviny: 10,
    sacharidy: 0,
    tuky: 0,
    ...over,
  };
}

function renderuj(poznamky: PoznamkaDeniku[], cile = { kalorie: 2000, bilkoviny: 120 }) {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={q}>
      <TydnySouhrn poznamky={poznamky} cile={cile} />
    </QueryClientProvider>,
  );
}

describe("TydnySouhrn", () => {
  it("průměruje jen dny se zápisy – prázdný den neznačí dolů", () => {
    // 3 dny à 1000 kcal → Ø 1000 (ne 3/7 × týden)
    const zaznamy = ["2026-11-20", "2026-11-21", "2026-11-22"].map((d) =>
      poz({ zapsanoDne: d, kalorie: 1000, mnozstviG: 100 }),
    );
    nactiCenoveHladiny.mockResolvedValue(new Map());
    renderuj(zaznamy);
    expect(screen.getByText(/1.000/)).toBeTruthy();
    expect(screen.getByText(/z 3 dnů se zápisy/)).toBeTruthy();
  });

  it("ukáže % cíle a odhad výdaje z nejlevnější nabídky", async () => {
    // 1 den: 200 g potraviny za 10 Kč/100 g (nejlevnější) → 20 Kč
    nactiCenoveHladiny.mockResolvedValue(
      new Map([
        ["f1", [
          { obchodId: "r1", obchod: "A", cena: 15, jeSleva: false, pozorovanoAt: "", baleniG: null, puvodniCena: null },
          { obchodId: "r2", obchod: "B", cena: 10, jeSleva: false, pozorovanoAt: "", baleniG: null, puvodniCena: null },
        ]],
      ]),
    );
    // kalorie/bilkoviny jsou per 100 g → 200 g = 2000 kcal + 120 g = 100 % cíle
    renderuj([poz({ kalorie: 1000, bilkoviny: 60, mnozstviG: 200 })]);
    await waitFor(() =>
      expect(screen.getByText(/~20,00 Kč/)).toBeTruthy(),
    );
    expect(screen.getAllByText(/100 % cíle/)).toHaveLength(2); // kcal + bílkoviny
  });

  it("položky bez ceny odhlásí pod čarou místo tichého podhodnocení", async () => {
    nactiCenoveHladiny.mockResolvedValue(new Map()); // žádné ceny
    renderuj([poz({ foodId: "f-bez", kalorie: 500, mnozstviG: 100 })]);
    await waitFor(() =>
      expect(screen.getByText(/1 položek bez ceny mimo odhad/)).toBeTruthy(),
    );
    expect(screen.getByText(/~0,00 Kč/)).toBeTruthy();
  });

  it("bez záznamů se nerenderuje", () => {
    nactiCenoveHladiny.mockResolvedValue(new Map());
    const { container } = renderuj([]);
    expect(container.firstChild).toBeNull();
  });
});
