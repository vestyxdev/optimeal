// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog, PotvrdDialog } from "@/components/ui/Dialog";

/* jsdom nepodporuje <dialog>.showModal/close – jednoduchý stub,
 * který přepíná `open` atribut (interakce testujeme na DOM úrovni). */
beforeAll(() => {
  const proto = (
    globalThis as unknown as { HTMLDialogElement?: { prototype: HTMLDialogElement } }
  ).HTMLDialogElement?.prototype;
  if (proto && !proto.showModal) {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

afterEach(() => cleanup());

describe("Dialog", () => {
  it("vykreslí nadpis a obsah", () => {
    render(<Dialog otevren naZavreni={() => {}} nadpis="Test" deti="Obsah" />);
    expect(screen.getByText("Test")).toBeTruthy();
    expect(screen.getByText("Obsah")).toBeTruthy();
  });

  it("Escape (cancel) zavolá naZavreni", () => {
    const zavri = vi.fn();
    render(<Dialog otevren naZavreni={zavri} nadpis="T" deti="X" />);
    const dlg = document.querySelector("dialog")!;
    fireEvent(dlg, new Event("cancel"));
    expect(zavri).toHaveBeenCalled();
  });

  it("klik na pozadí (na samotný <dialog>) zavolá naZavreni", () => {
    const zavri = vi.fn();
    render(<Dialog otevren naZavreni={zavri} nadpis="T" deti="X" />);
    const dlg = document.querySelector("dialog")!;
    fireEvent.click(dlg);
    expect(zavri).toHaveBeenCalled();
  });

  it("klik dovnitř obsahu nezavře", () => {
    const zavri = vi.fn();
    render(
      <Dialog otevren naZavreni={zavri} nadpis="T" deti={<button>Vnitřní</button>} />,
    );
    fireEvent.click(screen.getByText("Vnitřní"));
    expect(zavri).not.toHaveBeenCalled();
  });
});

describe("PotvrdDialog", () => {
  it("Potvrdit zavolá naPotvrzeni i naZavreni", () => {
    const potvrd = vi.fn();
    const zavri = vi.fn();
    render(
      <PotvrdDialog
        otevren
        naZavreni={zavri}
        naPotvrzeni={potvrd}
        nadpis="Smazat?"
        text="Opravdu?"
      />,
    );
    fireEvent.click(screen.getByText("Potvrdit"));
    expect(potvrd).toHaveBeenCalledTimes(1);
    expect(zavri).toHaveBeenCalledTimes(1);
  });

  it("Zrušit volá jen naZavreni, ne potvrzení", () => {
    const potvrd = vi.fn();
    const zavri = vi.fn();
    render(
      <PotvrdDialog
        otevren
        naZavreni={zavri}
        naPotvrzeni={potvrd}
        nadpis="Smazat?"
        text="Opravdu?"
      />,
    );
    fireEvent.click(screen.getByText("Zrušit"));
    expect(potvrd).not.toHaveBeenCalled();
    expect(zavri).toHaveBeenCalledTimes(1);
  });
});
