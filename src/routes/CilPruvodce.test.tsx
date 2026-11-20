// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CilPruvodce, LS_CILE_HOST } from "@/routes/CilPruvodce";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ uzivatel: null }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/data/profil", () => ({
  nactiProfil: vi.fn(async () => null),
  ulozProfil: vi.fn(async () => {}),
  ulozCile: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderPruvodce() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CilPruvodce />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function pokracuj() {
  fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
}

function projdiNaCil() {
  fireEvent.click(screen.getByRole("radio", { name: "Muž" }));
  pokracuj();
  fireEvent.click(screen.getByRole("radio", { name: /0–2/ }));
  pokracuj();
  // věk/výška/váha mají platné výchozí hodnoty
  pokracuj();
}

describe("Cílový průvodce", () => {
  it("vyžaduje výběr před pokračováním", () => {
    renderPruvodce();
    const dalsi = screen.getByRole("button", { name: "Pokračovat" }) as HTMLButtonElement;
    expect(dalsi.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Muž" }));
    expect(dalsi.disabled).toBe(false);
  });

  it("cíl „Udržet váhu“ přeskočí krok tempo a jde rovnou na souhrn", () => {
    renderPruvodce();
    projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    pokracuj();
    // souhrn – velké kalorie + makra, žádný posuvník tempa
    expect(screen.getByText("Tvůj plán")).toBeTruthy();
    expect(screen.queryByLabelText("Tempo")).toBeNull();
    expect(screen.getByRole("button", { name: /Uložit do zařízení/ })).toBeTruthy();
  });

  it("hubnutí ukáže krok tempo s posuvníkem a termínem", () => {
    renderPruvodce();
    projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Zhubnout/ }));
    pokracuj();
    expect(screen.getByLabelText("Tempo")).toBeTruthy();
    expect(screen.getByText(/Cílové váhy/)).toBeTruthy();
    pokracuj();
    expect(screen.getByText("Tvůj plán")).toBeTruthy();
  });

  it("krok Zpět se vrátí na předchozí otázku", () => {
    renderPruvodce();
    fireEvent.click(screen.getByRole("radio", { name: "Muž" }));
    pokracuj();
    expect(screen.getByText(/Kolikrát týdně/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zpět" }));
    expect(screen.getByText(/Jaké je tvé pohlaví/)).toBeTruthy();
  });

  it("ruční úprava kalorií přepočítá makra na přesnou energii", () => {
    renderPruvodce();
    projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    pokracuj();

    const velka = screen.getAllByLabelText(/Upravit hodnotu/)[0]!;
    fireEvent.click(velka);
    const input = screen.getByDisplayValue(/\d+/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3000" } });
    fireEvent.blur(input);

    // po úpravě se v souhrnu zobrazí 3 000 kcal
    expect(screen.getByLabelText(/Upravit hodnotu 3000/)).toBeTruthy();
  });

  it("hostovi se plán uloží do localStorage", async () => {
    renderPruvodce();
    projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    pokracuj();
    fireEvent.click(screen.getByRole("button", { name: /Uložit do zařízení/ }));

    await waitFor(() => {
      const raw = localStorage.getItem(LS_CILE_HOST);
      expect(raw).toBeTruthy();
      const host = JSON.parse(raw!) as {
        cile: { kalorie: number; bilkoviny: number; sacharidy: number; tuky: number };
        vstupy: { cilTela: string };
      };
      expect(host.vstupy.cilTela).toBe("udrzet");
      // energie sedí na makra
      const { kalorie: k, bilkoviny: b, sacharidy: s, tuky: t } = host.cile;
      expect(4 * b + 4 * s + 9 * t).toBe(k);
    });
  });
});
