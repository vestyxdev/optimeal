// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GramazPill } from "@/components/ui/GramazPill";

afterEach(() => cleanup());

describe("GramazPill", () => {
  it("zobrazí aktuální gramáž na pilulce", () => {
    render(<GramazPill hodnota={200} onZmena={() => {}} />);
    expect(screen.getByRole("button", { name: /200 g/ })).toBeTruthy();
  });

  it("klik otevře popover s předvolbami 1–250 g", () => {
    render(<GramazPill hodnota={100} onZmena={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    expect(screen.getByRole("menu")).toBeTruthy();
    for (const g of [1, 50, 100, 150, 200, 250]) {
      expect(screen.getByRole("menuitemradio", { name: `${g} g` })).toBeTruthy();
    }
  });

  it("přidá předvolbu balení, když baleniG není mezi předvolbami", () => {
    render(<GramazPill hodnota={100} onZmena={() => {}} baleniG={600} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    expect(screen.getByRole("menuitemradio", { name: "balení (600 g)" })).toBeTruthy();
  });

  it("nepřidá předvolbu balení, když gramáž sedí na předvolbu", () => {
    render(<GramazPill hodnota={100} onZmena={() => {}} baleniG={150} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    expect(screen.queryByText(/balení/)).toBeNull();
  });

  it("bez baleniG předvolbu balení neukáže", () => {
    render(<GramazPill hodnota={100} onZmena={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    expect(screen.queryByText(/balení/)).toBeNull();
  });

  it("výběr předvolby zavolá onZmena a popover zavře", () => {
    const zmena = vi.fn();
    render(<GramazPill hodnota={100} onZmena={zmena} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "150 g" }));
    expect(zmena).toHaveBeenCalledWith(150);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("označí aktivní hodnotu jako aria-checked", () => {
    render(<GramazPill hodnota={150} onZmena={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    const aktivni = screen.getByRole("menuitemradio", { name: "150 g" });
    expect(aktivni.getAttribute("aria-checked")).toBe("true");
  });

  it("vlastní gramáž propíše přes onZmena", () => {
    const zmena = vi.fn();
    render(<GramazPill hodnota={100} onZmena={zmena} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.change(screen.getByLabelText(/vlastní:/), { target: { value: "333" } });
    expect(zmena).toHaveBeenCalledWith(333);
  });

  it("vlastní gramáž ořeže na strop 10 000 g", () => {
    const zmena = vi.fn();
    render(<GramazPill hodnota={100} onZmena={zmena} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.change(screen.getByLabelText(/vlastní:/), { target: { value: "99999" } });
    expect(zmena).toHaveBeenCalledWith(10000);
  });

  it("zápornou vlastní gramáž ignoruje", () => {
    const zmena = vi.fn();
    render(<GramazPill hodnota={100} onZmena={zmena} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.change(screen.getByLabelText(/vlastní:/), { target: { value: "-5" } });
    expect(zmena).not.toHaveBeenCalled();
  });

  it("Escape zavře popover a zastaví propagaci (sheet zůstane)", () => {
    const rodic = vi.fn();
    document.addEventListener("keydown", rodic);
    render(<GramazPill hodnota={100} onZmena={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    document.removeEventListener("keydown", rodic);
  });

  it("klik na pozadí popover zavře", () => {
    render(<GramazPill hodnota={100} onZmena={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Množství/ }));
    fireEvent.click(screen.getByLabelText("Zavřít volbu množství"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
