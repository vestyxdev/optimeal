// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DenikZapis } from "@/components/denik/DenikZapis";
import type { PolozkaVyberu } from "@/components/ui/VyberPotraviny";
import type { Cile } from "@/lib/vyziva/cile";

/* DB zápis mockujeme – zbytek modulu (kalkulace, TYPY_JIDLA) zůstává reálný. */
vi.mock("@/lib/data/denik", async (importActual) => {
  const real = await importActual<typeof import("@/lib/data/denik")>();
  return { ...real, zapisDoDeniku: vi.fn().mockResolvedValue(undefined) };
});

/* Plný picker nahradíme tlačítkem, které rovnou „vybere“ první potravinu. */
vi.mock("@/components/ui/VyberPotraviny", () => ({
  VyberPotraviny: ({
    potraviny,
    onZmena,
  }: {
    potraviny: PolozkaVyberu[];
    onZmena: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onZmena(potraviny[0]!.id)}>
      test-pridej
    </button>
  ),
}));

import { zapisDoDeniku } from "@/lib/data/denik";
const zapisMock = vi.mocked(zapisDoDeniku);

const KURE: PolozkaVyberu = {
  id: "kure-id",
  nazev: "Kuřecí prsa",
  kalorie: 165,
  bilkoviny: 31,
  sacharidy: 0,
  tuky: 3.6,
  aktualniCena: 9.49,
  sleva: false,
  baleniG: 600,
};

const CILE: Cile = { kalorie: 2000, bilkoviny: 150, sacharidy: 200, tuky: 65 };

function vykresli(props: Partial<Parameters<typeof DenikZapis>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DenikZapis
        potraviny={[KURE]}
        cile={CILE}
        typPocatecni="snidane"
        datumPocatecni="2026-01-15"
        naZavreni={() => {}}
        {...props}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  zapisMock.mockClear();
});

describe("DenikZapis", () => {
  it("prázdný stav: typ jídla, datum+čas, vypnuté Zapsat", () => {
    vykresli();
    expect(screen.getByLabelText("Typ jídla")).toBeTruthy();
    expect(screen.getByLabelText("Datum zápisu")).toBeTruthy();
    expect(screen.getByLabelText("Čas zápisu")).toBeTruthy();
    expect(screen.getByText("Zatím prázdné.")).toBeTruthy();
    const zapsat = screen.getByRole("button", { name: "Zapsat" });
    expect((zapsat as HTMLButtonElement).disabled).toBe(true);
  });

  it("po výběru potraviny ukáže řádek s makry na 100 g", () => {
    vykresli();
    fireEvent.click(screen.getByText("test-pridej"));
    expect(screen.getByText("Kuřecí prsa")).toBeTruthy();
    // 165 kcal, B 31, S 0, T 3,6 na 100 g
    expect(screen.getByText(/165 kcal · B 31 · S 0 · T 3,6/)).toBeTruthy();
  });

  it("panel Vliv na příjem počítá +množství a % podíl cíle", () => {
    vykresli();
    fireEvent.click(screen.getByText("test-pridej"));
    expect(screen.getByText("Vliv na příjem")).toBeTruthy();
    // 165 z 2000 kcal → „+165“ + řádek „z 2 000 kcal“ (nbsp v tisících)
    expect(screen.getByText(/^\+165$/)).toBeTruthy();
    expect(screen.getByText(/z 2.000 kcal/)).toBeTruthy();
  });

  it("změna gramáže přepočítá řádek i vliv", () => {
    vykresli();
    fireEvent.click(screen.getByText("test-pridej"));
    fireEvent.click(screen.getByRole("button", { name: /Množství Kuřecí prsa/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "200 g" }));
    // 200 g → 330 kcal
    expect(screen.getByText(/^\+330$/)).toBeTruthy();
    expect(screen.getByText(/330 kcal · B 62/)).toBeTruthy();
  });

  it("balení potraviny se nabídne jako předvolba", () => {
    vykresli();
    fireEvent.click(screen.getByText("test-pridej"));
    fireEvent.click(screen.getByRole("button", { name: /Množství Kuřecí prsa/ }));
    expect(screen.getByRole("menuitemradio", { name: "balení (600 g)" })).toBeTruthy();
  });

  it("odebrání položky vrátí prázdný stav a Zapsat vypne", () => {
    vykresli();
    fireEvent.click(screen.getByText("test-pridej"));
    fireEvent.click(screen.getByLabelText("Odebrat Kuřecí prsa"));
    expect(screen.getByText("Zatím prázdné.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Zapsat" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("Zapsat odešle do DB typ, datum, čas i položky a zavře sheet", async () => {
    const zavri = vi.fn();
    vykresli({ naZavreni: zavri });
    fireEvent.click(screen.getByText("test-pridej"));
    fireEvent.click(screen.getByRole("button", { name: "Zapsat" }));
    await waitFor(() => expect(zapisMock).toHaveBeenCalledTimes(1));
    const [typ, datum, cas, polozky] = zapisMock.mock.calls[0]!;
    expect(typ).toBe("snidane");
    expect(datum).toBe("2026-01-15");
    expect(cas).toMatch(/^\d{2}:\d{2}$/);
    expect(polozky).toHaveLength(1);
    expect(polozky[0]!).toMatchObject({ foodId: "kure-id", mnozstviG: 100 });
    await waitFor(() => expect(zavri).toHaveBeenCalled());
  });

  it("přepnutí typu jídla se promítne do zápisu", async () => {
    vykresli();
    fireEvent.change(screen.getByLabelText("Typ jídla"), {
      target: { value: "vecere" },
    });
    fireEvent.click(screen.getByText("test-pridej"));
    fireEvent.click(screen.getByRole("button", { name: "Zapsat" }));
    await waitFor(() => expect(zapisMock).toHaveBeenCalled());
    expect(zapisMock.mock.calls[0]![0]).toBe("vecere");
  });

  it("Escape volá naZavreni", () => {
    const zavri = vi.fn();
    vykresli({ naZavreni: zavri });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(zavri).toHaveBeenCalled();
  });
});
