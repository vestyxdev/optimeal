import { describe, expect, it } from "vitest";
import { rpcChybi } from "@/lib/supabase";

describe("rpcChybi", () => {
  it("PGRST202 → funkce není nasazená", () => {
    // skutečná odpověď živého PostgREST pro neexistující funkci
    expect(
      rpcChybi({
        code: "PGRST202",
        message:
          "Could not find the function public.uloz_cile(p_kalorie, ...) in the schema cache",
      }),
    ).toBe(true);
  });

  it("textová varianta bez kódu → taky nasazení chybí", () => {
    expect(
      rpcChybi({ message: "Could not find the function public.uloz_recept in the schema cache" }),
    ).toBe(true);
  });

  it("běžná chyba dat (RLS, FK…) → fallback se NESPOUSTÍ", () => {
    expect(rpcChybi({ code: "42501", message: "permission denied for table recipes" })).toBe(false);
    expect(rpcChybi({ code: "23503", message: "insert or update violates foreign key" })).toBe(false);
  });

  it("null/prázdná chyba → ne", () => {
    expect(rpcChybi(null)).toBe(false);
    expect(rpcChybi({})).toBe(false);
  });
});
