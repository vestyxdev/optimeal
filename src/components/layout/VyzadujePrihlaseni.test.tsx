// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { VyzadujePrihlaseni } from "@/components/layout/VyzadujePrihlaseni";

const useAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => useAuth(),
}));

afterEach(() => cleanup());

function renderSGuardem(stav: { uzivatel: unknown; nacitaSe: boolean }, cesta = "/jidelnicek") {
  useAuth.mockReturnValue(stav);
  return render(
    <MemoryRouter initialEntries={[cesta]}>
      <Routes>
        <Route
          path="/jidelnicek"
          element={
            <VyzadujePrihlaseni>
              <div>TAJNÝ OBSAH</div>
            </VyzadujePrihlaseni>
          }
        />
        <Route path="/prihlaseni" element={<div>PŘIHLÁŠENÍ</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VyzadujePrihlaseni", () => {
  it("nepřihlášeného přesměruje na /prihlaseni", () => {
    renderSGuardem({ uzivatel: null, nacitaSe: false });
    expect(screen.getByText("PŘIHLÁŠENÍ")).toBeTruthy();
    expect(screen.queryByText("TAJNÝ OBSAH")).toBeNull();
  });

  it("přihlášenému ukáže obsah", () => {
    renderSGuardem({ uzivatel: { email: "a@b.cz" }, nacitaSe: false });
    expect(screen.getByText("TAJNÝ OBSAH")).toBeTruthy();
  });

  it("během načítání ukáže skeleton, ne obsah ani redirect", () => {
    renderSGuardem({ uzivatel: null, nacitaSe: true });
    expect(screen.queryByText("TAJNÝ OBSAH")).toBeNull();
    expect(screen.queryByText("PŘIHLÁŠENÍ")).toBeNull();
  });
});
