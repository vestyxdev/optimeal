// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Jidelnicek } from "@/routes/Jidelnicek";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ uzivatel: { id: "u1" } }) }));
vi.mock("@/lib/data/plany", () => ({
  nactiPotravinySeSlevami: vi.fn(async () => []),
  nactiMePlany: vi.fn(async () => []),
  smazPlan: vi.fn(),
  ulozPlan: vi.fn(),
}));
vi.mock("@/lib/data/profil", () => ({
  nactiAktivniCile: vi.fn(async () => null),
  nactiProfil: vi.fn(async () => null),
}));
vi.mock("@/lib/data/nakup", () => ({ ulozNakupniSeznam: vi.fn() }));
vi.mock("@/components/jidelnicek/Vysledky", () => ({
  DenniVysledek: () => null,
  TydennyVysledek: () => null,
}));

afterEach(() => cleanup());

function renderJidelnicek() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Jidelnicek />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Jídelníček – formulář cílů", () => {
  it("pole kalorií lze vyprázdnit a přepsat (regrese: dřív skákalo na výchozí hodnotu)", () => {
    renderJidelnicek();
    const input = screen.getByLabelText("Kalorie (kcal)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "1800" } });
    expect(input.value).toBe("1800");
  });

  it("všechna čtyři pole jsou editovatelná nezávisle", () => {
    renderJidelnicek();
    for (const [label, hodnota] of [
      ["Kalorie (kcal)", "2000"],
      ["Bílkoviny (g)", "150"],
      ["Sacharidy (g)", "200"],
      ["Tuky (g)", "70"],
    ] as const) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
      fireEvent.change(input, { target: { value: hodnota } });
      expect(input.value).toBe(hodnota);
    }
  });
});
