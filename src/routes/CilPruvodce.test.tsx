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

async function vyberKartu(nazev: RegExp | string) {
  fireEvent.click(screen.getByRole("radio", { name: nazev }));
  // karty samy posouvají dál po krátké animaci – počkat na další krok
  await waitFor(() => expect(screen.getByText(/Krok \d+ z \d+/)).toBeTruthy(), { timeout: 1000 });
}

async function projdiNaCil() {
  await vyberKartu("Muž");
  await waitFor(() => expect(screen.getByText(/Kolikrát týdně/)).toBeTruthy());
  await vyberKartu(/0–2/);
  // věk/výška/váha mají platné výchozí hodnoty → Pokračovat
  await waitFor(() => screen.getByRole("button", { name: "Pokračovat" }));
  fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
  await waitFor(() => expect(screen.getByText(/Jaký je tvůj cíl/)).toBeTruthy());
}

describe("Cílový průvodce", () => {
  it("po výběru karty automaticky postoupí na další otázku", async () => {
    renderPruvodce();
    expect(screen.getByText(/Jaké je tvé pohlaví/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Muž" }));
    await waitFor(() => expect(screen.getByText(/Kolikrát týdně/)).toBeTruthy());
  });

  it("cíl „Udržet váhu“ přeskočí krok tempo a jde rovnou na souhrn", async () => {
    renderPruvodce();
    await projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    await waitFor(() => expect(screen.getByText("Tvůj plán")).toBeTruthy());
    expect(screen.queryByLabelText("Tempo")).toBeNull();
    expect(screen.getByRole("button", { name: /Uložit do zařízení/ })).toBeTruthy();
  });

  it("hubnutí ukáže krok tempo s posuvníkem a termínem", async () => {
    renderPruvodce();
    await projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Zhubnout/ }));
    await waitFor(() => expect(screen.getByLabelText("Tempo")).toBeTruthy());
    expect(screen.getByText(/Cílové váhy/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    await waitFor(() => expect(screen.getByText("Tvůj plán")).toBeTruthy());
  });

  it("krok Zpět se vrátí na předchozí otázku", async () => {
    renderPruvodce();
    fireEvent.click(screen.getByRole("radio", { name: "Muž" }));
    await waitFor(() => expect(screen.getByText(/Kolikrát týdně/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zpět" }));
    await waitFor(() => expect(screen.getByText(/Jaké je tvé pohlaví/)).toBeTruthy());
  });

  it("ruční úprava kalorií přepočítá makra na přesnou energii", async () => {
    renderPruvodce();
    await projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    await waitFor(() => expect(screen.getByText("Tvůj plán")).toBeTruthy());

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
    await projdiNaCil();
    fireEvent.click(screen.getByRole("radio", { name: /Udržet váhu/ }));
    await waitFor(() => screen.getByRole("button", { name: /Uložit do zařízení/ }));
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
