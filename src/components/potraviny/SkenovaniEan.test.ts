import { afterEach, describe, expect, it } from "vitest";
import { podporujeSkenovaniKodu } from "./SkenovaniEan";

const n = navigator as { mediaDevices?: { getUserMedia?: unknown } };
const puvodni = n.mediaDevices;

afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    value: puvodni,
    configurable: true,
  });
});

describe("podporujeSkenovaniKodu", () => {
  it("false bez kamery (node, starý prohlížeč)", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });
    expect(podporujeSkenovaniKodu()).toBe(false);
  });

  it("true s kamerou – detekci řeší BarcodeDetector nebo ZXing fallback", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: () => Promise.resolve({}) },
      configurable: true,
    });
    // i bez nativního BarcodeDetector (Firefox, Safari) skenujeme přes ZXing
    expect(podporujeSkenovaniKodu()).toBe(true);
  });
});
