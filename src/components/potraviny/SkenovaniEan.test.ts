import { afterEach, describe, expect, it } from "vitest";
import { podporujeSkenovaniKodu } from "./SkenovaniEan";

const g = globalThis as { window?: unknown };

afterEach(() => {
  delete g.window;
});

describe("podporujeSkenovaniKodu", () => {
  it("false, když prohlížeč BarcodeDetector nemá (node, Firefox, Safari)", () => {
    g.window = {};
    expect(podporujeSkenovaniKodu()).toBe(false);
    delete g.window;
    expect(podporujeSkenovaniKodu()).toBe(false);
  });

  it("true, když window.BarcodeDetector existuje (Chrome, Edge)", () => {
    g.window = { BarcodeDetector: class {} };
    expect(podporujeSkenovaniKodu()).toBe(true);
  });
});
