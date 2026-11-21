// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresní testy hostovské větve spíže/stálic a migrace po přihlášení.
 * Falešný Supabase klient: user=null → localStorage větev; user →
 * zachycujeme upserty a ověřujeme onConflict klíče i úklid localStorage.
 */
const stav = vi.hoisted(() => ({
  user: null as { id: string } | null,
  upserty: [] as { tabulka: string; radky: unknown[]; konflikt: string | undefined }[],
}));

vi.mock("@/lib/supabase", () => ({
  supabaseNastaveno: true,
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: stav.user } }),
    },
    from: (tabulka: string) => ({
      upsert: (radky: unknown, volby?: { onConflict?: string }) => {
        stav.upserty.push({
          tabulka,
          radky: radky as unknown[],
          konflikt: volby?.onConflict,
        });
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

import {
  migrujSpizAStaliceHosta,
  nactiSpiz,
  nactiStalice,
  odeberZeSpize,
  pridejDoSpize,
  prepnoutStalici,
} from "@/lib/data/spiz";

beforeEach(() => {
  localStorage.clear();
  stav.user = null;
  stav.upserty = [];
});

describe("spíž – host (localStorage)", () => {
  it("odebere podle foodId i když se název mezitím přejmenoval", async () => {
    await pridejDoSpize({ foodId: "f-ryze", nazev: "Rýže" });
    // potravina se v katalogu přejmenovala – „Došlo" posílá nový název;
    // stará implementace mazala jen podle názvu a záznam přežil
    await odeberZeSpize({ foodId: "f-ryze", nazev: "Rýže jasmínová" });
    expect(await nactiSpiz()).toEqual([]);
  });

  it("ruční položka bez foodId se odebere podle názvu", async () => {
    await pridejDoSpize({ foodId: null, nazev: "Domácí marmeláda" });
    await odeberZeSpize({ foodId: null, nazev: "domácí marmeláda" });
    expect(await nactiSpiz()).toEqual([]);
  });

  it("přidání deduplikuje podle názvu", async () => {
    await pridejDoSpize({ foodId: "f-ryze", nazev: "Rýže" });
    await pridejDoSpize({ foodId: "f-ryze", nazev: "Rýže" });
    expect(await nactiSpiz()).toHaveLength(1);
  });

  it("stálice se přepíná a čte z localStorage", async () => {
    expect(await prepnoutStalici("f-mleko", "Mléko")).toBe(true);
    expect(await nactiStalice()).toEqual(new Set(["f-mleko"]));
    expect(await prepnoutStalici("f-mleko", "Mléko")).toBe(false);
    expect(await nactiStalice()).toEqual(new Set());
  });
});

describe("migrujSpizAStaliceHosta", () => {
  it("bez přihlášení nic nemigruje a localStorage zůstává", async () => {
    await pridejDoSpize({ foodId: "f-ryze", nazev: "Rýže" });
    expect(await migrujSpizAStaliceHosta()).toBe(false);
    expect(await nactiSpiz()).toHaveLength(1);
    expect(stav.upserty).toEqual([]);
  });

  it("po přihlášení upsertuje spíž i stálice a smaže lokální kopie", async () => {
    await pridejDoSpize({ foodId: "f-ryze", nazev: "Rýže" });
    await pridejDoSpize({ foodId: null, nazev: "Marmeláda" });
    await prepnoutStalici("f-mleko", "Mléko");
    stav.user = { id: "u-1" };

    expect(await migrujSpizAStaliceHosta()).toBe(true);

    const tabulky = stav.upserty.map((u) => u.tabulka).sort();
    expect(tabulky).toEqual(["pantry_items", "pinned_staples"]);

    const spiz = stav.upserty.find((u) => u.tabulka === "pantry_items");
    expect(spiz?.konflikt).toBe("user_id,nazev");
    expect(spiz?.radky).toEqual([
      { user_id: "u-1", food_id: "f-ryze", nazev: "Rýže" },
      { user_id: "u-1", food_id: null, nazev: "Marmeláda" },
    ]);

    const stal = stav.upserty.find((u) => u.tabulka === "pinned_staples");
    expect(stal?.konflikt).toBe("user_id,food_id");
    expect(stal?.radky).toEqual([{ user_id: "u-1", food_id: "f-mleko" }]);

    // lokální kopie jsou pryč – opakovaná migrace nic nepřenese
    expect(localStorage.getItem("om-spiz")).toBeNull();
    expect(localStorage.getItem("om-stalice")).toBeNull();
    expect(await migrujSpizAStaliceHosta()).toBe(false);
  });

  it("stálice bez foodId se nemigrují (DB vyžaduje food_id)", async () => {
    localStorage.setItem("om-stalice", JSON.stringify([{ f: null, n: "Ruční" }]));
    stav.user = { id: "u-1" };
    expect(await migrujSpizAStaliceHosta()).toBe(true);
    expect(stav.upserty.find((u) => u.tabulka === "pinned_staples")).toBeUndefined();
  });
});
