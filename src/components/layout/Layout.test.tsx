// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";

const useAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/motiv", () => ({
  useMotiv: () => ({ motiv: "light", nastavMotiv: vi.fn() }),
}));

afterEach(() => cleanup());

function renderLayout() {
  useAuth.mockReturnValue({ uzivatel: { email: "a@b.cz" }, nacitaSe: false, odhlasit: vi.fn() });
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div>OBSAH</div>} />
          <Route path="/potraviny" element={<div>POTRAVINY</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function tlacitkoVice() {
  // mobilní i desktop varianta tlačítka jsou v DOM (md:hidden jen CSS)
  return screen.getByRole("button", { name: /Další sekce/ });
}

describe("Layout – nabídka „Více“", () => {
  it("otevře panel a přesune do něj fokus", () => {
    renderLayout();
    fireEvent.click(tlacitkoVice());

    const dialog = screen.getByRole("dialog", { name: "Další sekce" });
    expect(dialog).toBeTruthy();
    // fokus je uvnitř panelu (první interaktivní prvek)
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("sekundární sekce jsou v panelu dostupné", () => {
    renderLayout();
    fireEvent.click(tlacitkoVice());
    const dialog = screen.getByRole("dialog", { name: "Další sekce" });
    for (const nazev of ["Potraviny", "Mealprep", "Můj účet", "Nastavení"]) {
      expect(within(dialog).getByRole("link", { name: nazev })).toBeTruthy();
    }
  });

  it("Escape panel zavře a fokus se vrátí na tlačítko „Více“", () => {
    renderLayout();
    const tl = tlacitkoVice();
    fireEvent.click(tl);
    expect(screen.queryByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Další sekce" }).parentElement!, {
      key: "Escape",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(tl);
  });

  it("Tab na posledním prvku přeskočí na první (focus trap)", () => {
    renderLayout();
    fireEvent.click(tlacitkoVice());
    const dialog = screen.getByRole("dialog", { name: "Další sekce" });
    const prvky = dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const prvni = prvky[0]!;
    const posledni = prvky[prvky.length - 1]!;

    posledni.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(prvni);

    prvni.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(posledni);
  });
});
