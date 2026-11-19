import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ChevronUp, Clock, Minus, Plus, Receipt, Trash2, Users } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GramazPill } from "@/components/ui/GramazPill";
import { Input, Label } from "@/components/ui/Input";
import {
  KATEGORIE_NAZVY,
  nactiRecept,
  ulozRecept,
  upravRecept,
} from "@/lib/data/recepty";
import { nactiPotravinySeSlevami } from "@/lib/data/plany";
import { makraProMnozstvi } from "@/lib/data/denik";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import type { Potravina } from "@/lib/generator/generator";
import { Skeleton } from "@/components/ui/Nacitani";
import { useAuth } from "@/lib/auth";
import { VyberPotraviny } from "@/components/ui/VyberPotraviny";
import { cn } from "@/lib/cn";

/**
 * „Receptová kasa“ – nový / úprava vlastního receptu.
 * Levá sloupce: redakční formulář (kuchařka). Pravý sloupec:
 * živá papírová účtenka, která se „tiskne“ při psaní – každá
 * surovina je položka s gramáží a dnešní cenou, patička ukazuje
 * cenu a výživu na porci. Na mobilu shrinknutá páska nad spodní
 * navigací drží součty po ruce.
 */

const KATEGORIE = ["snidane", "polevka", "hlavni", "svacina", "desert"] as const;

const schema = z.object({
  nazev: z.string().trim().min(2, "Název musí mít alespoň 2 znaky.").max(120),
  popis: z.string().trim().max(500, "Popis je moc dlouhý.").optional(),
  kategorie: z.enum(KATEGORIE),
  porce: z.number("Zadejte číslo.").int("Celé číslo.").min(1).max(12),
  casMinuty: z.number("Zadejte číslo.").int().min(1).max(600).nullable(),
  postup: z.string().trim().max(5000, "Postup je moc dlouhý."),
  suroviny: z
    .array(
      z.object({
        foodId: z.string().min(1, "Vyberte potravinu."),
        gramyNaPorce: z
          .number("Zadejte číslo.")
          .positive("Gramáž musí být kladná.")
          .max(2000, "Max 2000 g."),
        poznamka: z.string().trim().max(120).optional(),
      }),
    )
    .min(1, "Přidejte alespoň jednu surovinu.")
    .refine(
      (s) => {
        const ids = s.map((x) => x.foodId).filter(Boolean);
        return new Set(ids).size === ids.length;
      },
      "Každá potravina smí být v receptu jen jednou – sečtěte gramáže dohromady.",
    ),
});

type Hodnoty = z.infer<typeof schema>;

const VYCHOZI_SUROVINA = { foodId: "", gramyNaPorce: 100, poznamka: "" };

const kc = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });
const celo = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

interface PolozkaUctenky {
  nazev: string;
  gramy: number;
  cena: number | null; // null = potravina bez ceny v katalogu
  sleva: number; // usetřeno oproti běžné ceně
}

/** Živé položky účtenky z formuláře + katalogu cen. */
function spocitejUctenku(
  suroviny: Hodnoty["suroviny"],
  mapa: Map<string, Potravina>,
): { polozky: PolozkaUctenky[]; kcal: number; b: number; s: number; t: number } {
  let kcal = 0;
  let b = 0;
  let s = 0;
  let t = 0;
  const polozky = suroviny.map((sur) => {
    const p = mapa.get(sur.foodId);
    const g = Number.isFinite(sur.gramyNaPorce) && sur.gramyNaPorce > 0 ? sur.gramyNaPorce : 0;
    if (!p) return { nazev: "—", gramy: g, cena: null, sleva: 0 };
    const podil = g / 100;
    kcal += p.kalorie * podil;
    b += p.bilkoviny * podil;
    s += p.sacharidy * podil;
    t += p.tuky * podil;
    return {
      nazev: p.nazev,
      gramy: g,
      cena: p.aktualniCena > 0 ? p.aktualniCena * podil : null,
      sleva: p.sleva && p.puvodniCena != null && p.puvodniCena > p.aktualniCena
        ? (p.puvodniCena - p.aktualniCena) * podil
        : 0,
    };
  });
  return { polozky, kcal, b, s, t };
}

export function ReceptEditace() {
  const { id } = useParams<{ id: string }>();
  const { uzivatel } = useAuth();
  const editace = id !== undefined;
  const naviguj = useNavigate();
  const klientQ = useQueryClient();

  const dotazPotraviny = useQuery({ queryKey: ["aktualni_ceny"], queryFn: nactiPotravinySeSlevami });
  const dotazRecept = useQuery({
    queryKey: ["recept", id],
    queryFn: () => nactiRecept(id as string),
    enabled: editace,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Hodnoty>({
    resolver: zodResolver(schema),
    defaultValues: {
      nazev: "",
      popis: "",
      kategorie: "hlavni",
      porce: 2,
      casMinuty: null,
      postup: "",
      suroviny: [VYCHOZI_SUROVINA],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "suroviny" });

  const [uctenkaOtevrena, setUctenkaOtevrena] = useState(false);

  // živé hodnoty pro účtenku
  const suroviny = useWatch({ control, name: "suroviny" }) ?? [];
  const porce = useWatch({ control, name: "porce" }) ?? 1;
  const nazev = useWatch({ control, name: "nazev" }) ?? "";
  const postup = useWatch({ control, name: "postup" }) ?? "";

  const potraviny = dotazPotraviny.data ?? [];
  const mapaPotravin = useMemo(() => new Map(potraviny.map((p) => [p.id, p])), [potraviny]);
  const uctenka = useMemo(
    () => spocitejUctenku(suroviny, mapaPotravin),
    [suroviny, mapaPotravin],
  );
  const cenaZaPorce = useMemo(
    () =>
      uctenka.polozky.some((p) => p.cena === null)
        ? null
        : uctenka.polozky.reduce((sum, p) => sum + (p.cena ?? 0), 0),
    [uctenka],
  );
  const usetreno = uctenka.polozky.reduce((sum, p) => sum + p.sleva, 0);
  const kroky = postup.split("\n").filter((l) => l.trim() !== "").length;
  const duplicitni = useMemo(() => {
    const pocty = new Map<string, number>();
    suroviny.forEach((s) => {
      if (s.foodId) pocty.set(s.foodId, (pocty.get(s.foodId) ?? 0) + 1);
    });
    return [...pocty]
      .filter(([, n]) => n > 1)
      .map(([fid]) => mapaPotravin.get(fid)?.nazev ?? "potravina");
  }, [suroviny, mapaPotravin]);

  // mobilní účtenka-sheet: Escape zavře + zámek posouvání pozadí
  useEffect(() => {
    if (!uctenkaOtevrena) return;
    const stary = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUctenkaOtevrena(false);
    };
    document.addEventListener("keydown", naKlavesu);
    return () => {
      document.documentElement.style.overflow = stary;
      document.removeEventListener("keydown", naKlavesu);
    };
  }, [uctenkaOtevrena]);

  // předvyplnění při editaci
  useEffect(() => {
    const r = dotazRecept.data;
    if (!r) return;
    reset({
      nazev: r.nazev,
      popis: r.popis ?? "",
      kategorie: (KATEGORIE as readonly string[]).includes(r.kategorie)
        ? (r.kategorie as (typeof KATEGORIE)[number])
        : "hlavni",
      porce: r.porce,
      casMinuty: r.casMinuty,
      postup: r.postup,
      suroviny: r.suroviny.map((s) => ({
        foodId: s.foodId,
        gramyNaPorce: s.gramyNaPorce,
        poznamka: s.poznamka ?? "",
      })),
    });
  }, [dotazRecept.data, reset]);

  const mutace = useMutation({
    mutationFn: async (h: Hodnoty) => {
      const vstup = {
        nazev: h.nazev,
        popis: h.popis || undefined,
        kategorie: h.kategorie,
        porce: h.porce,
        casMinuty: h.casMinuty,
        postup: h.postup,
        suroviny: h.suroviny.map((s) => ({
          foodId: s.foodId,
          gramyNaPorce: s.gramyNaPorce,
          poznamka: s.poznamka || null,
        })),
      };
      if (editace) {
        await upravRecept(id, vstup);
        return id;
      }
      return ulozRecept(vstup);
    },
    onSuccess: (idReceptu) => {
      toast.success(editace ? "Recept byl upraven." : "Recept byl uložen.");
      void klientQ.invalidateQueries({ queryKey: ["recepty"] });
      void klientQ.invalidateQueries({ queryKey: ["recept", idReceptu] });
      naviguj(`/recepty/${idReceptu}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editace && dotazRecept.isLoading) {
    return (
      <div className="space-y-3" aria-label="Načítám recept">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (editace && (dotazRecept.isError || !dotazRecept.data)) {
    return (
      <Card className="bg-danger-soft text-sm text-danger">
        {(dotazRecept.error as Error | undefined)?.message ?? "Recept se nepodařilo načíst."}
      </Card>
    );
  }
  // editovat lze jen vlastní recepty – seed/sdílené se ukážou jen ke čtení
  if (editace && uzivatel && dotazRecept.data?.userId !== uzivatel.id) {
    return (
      <Card className="space-y-3 bg-warning-soft text-sm text-warning">
        <p>Tento recept nemůžete upravit – není váš.</p>
        <Link to={`/recepty/${id}`} className="font-medium underline">
          Zpět na recept
        </Link>
      </Card>
    );
  }

  const porceBezpecne = Number.isFinite(porce) && porce > 0 ? porce : 1;

  return (
    <div className="max-w-5xl pb-14 lg:pb-0">
      <Link
        to={editace ? `/recepty/${id}` : "/recepty"}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" /> {editace ? "Zpět na recept" : "Zpět na recepty"}
      </Link>
      <h1 className="om-display mt-2 text-3xl font-extrabold tracking-tight">
        {editace ? "Upravit recept" : "Nový recept"}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Gramáže pište na 1 porci – účtenka vedle rovnou počítá cenu a výživu
        z dnešních cen.
      </p>

      <form
        onSubmit={handleSubmit((h) => mutace.mutate(h))}
        className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        {/* -------- formulář -------- */}
        <div className="min-w-0 space-y-6">
          {/* základ */}
          <Card className="space-y-4">
            <div>
              <Label htmlFor="nazev">Název receptu</Label>
              <Input
                id="nazev"
                {...register("nazev")}
                placeholder="Kuře s rýží a brokolicí"
                className="h-12 px-3 text-lg font-semibold"
              />
              {errors.nazev && <Chyba text={errors.nazev.message} />}
            </div>
            <div>
              <Label htmlFor="popis">Popis (volitelný)</Label>
              <Input id="popis" {...register("popis")} placeholder="Rychlý oběd s dostatečným obsahem bílkovin…" />
              {errors.popis && <Chyba text={errors.popis.message} />}
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-fg">Kategorie</legend>
                <Controller
                  control={control}
                  name="kategorie"
                  render={({ field }) => (
                    <div role="radiogroup" aria-label="Kategorie receptu" className="flex flex-wrap gap-1.5">
                      {KATEGORIE.map((kat) => (
                        <button
                          key={kat}
                          type="button"
                          role="radio"
                          aria-checked={field.value === kat}
                          onClick={() => field.onChange(kat)}
                          className={cn(
                            "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                            field.value === kat
                              ? "border-primary bg-primary text-primary-fg"
                              : "border-border bg-surface text-muted hover:border-primary/50 hover:text-fg",
                          )}
                        >
                          {KATEGORIE_NAZVY[kat]}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.kategorie && <Chyba text={errors.kategorie.message} />}
              </fieldset>

              <div>
                <Label>Porce</Label>
                <Controller
                  control={control}
                  name="porce"
                  render={({ field }) => (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Méně porcí"
                        disabled={field.value <= 1}
                        onClick={() => field.onChange(Math.max(1, field.value - 1))}
                        className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="flex h-9 min-w-12 items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                        <Users className="size-3.5 text-muted" />
                        {field.value}×
                      </span>
                      <button
                        type="button"
                        aria-label="Více porcí"
                        disabled={field.value >= 12}
                        onClick={() => field.onChange(Math.min(12, field.value + 1))}
                        className="grid size-9 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  )}
                />
                {errors.porce && <Chyba text={errors.porce.message} />}
              </div>

              <div>
                <Label htmlFor="casMinuty">Čas (volitelné)</Label>
                <div className="relative w-28">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    id="casMinuty" type="number" inputMode="numeric" min={1} max={600}
                    {...register("casMinuty", { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
                    placeholder="30"
                    className="pl-8 pr-8 tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">min</span>
                </div>
                {errors.casMinuty && <Chyba text={errors.casMinuty.message} />}
              </div>
            </div>
          </Card>

          {/* suroviny */}
          <Card>
            <CardNadpis>Suroviny (na 1 porci)</CardNadpis>
            {errors.suroviny?.message && <Chyba text={errors.suroviny.message} />}
            <ul className="space-y-3">
              {fields.map((pole, i) => {
                const polozka = uctenka.polozky[i];
                const potravina = mapaPotravin.get(suroviny[i]?.foodId ?? "");
                const makraSuroviny = potravina
                  ? makraProMnozstvi(potravina, Number(suroviny[i]?.gramyNaPorce) || 0)
                  : null;
                return (
                  <li
                    key={pole.id}
                    className="grid grid-cols-[1.4rem_1fr_104px_36px] items-start gap-2 sm:grid-cols-[1.4rem_1fr_104px_1fr_36px]"
                  >
                    <span className="mt-2.5 text-xs font-medium tabular-nums text-muted">
                      {i + 1}.
                    </span>
                    <div>
                      <Controller
                        control={control}
                        name={`suroviny.${i}.foodId`}
                        render={({ field }) => (
                          <VyberPotraviny
                            potraviny={potraviny}
                            hodnota={field.value}
                            onZmena={field.onChange}
                            chyba={Boolean(errors.suroviny?.[i]?.foodId)}
                            ariaLabel={`Surovina ${i + 1} – potravina`}
                          />
                        )}
                      />
                      {errors.suroviny?.[i]?.foodId && <Chyba text={errors.suroviny[i]?.foodId?.message} />}
                    </div>
                    <div>
                      <Controller
                        control={control}
                        name={`suroviny.${i}.gramyNaPorce`}
                        render={({ field }) => (
                          <GramazPill
                            hodnota={Number.isFinite(field.value) ? field.value : 0}
                            baleniG={potravina?.baleniG ?? null}
                            onZmena={field.onChange}
                            chyba={Boolean(errors.suroviny?.[i]?.gramyNaPorce)}
                            ariaLabel={`Surovina ${i + 1} – gramáž na porci`}
                          />
                        )}
                      />
                      {makraSuroviny && (
                        <p className="mt-1 text-[11px] tabular-nums text-muted">
                          {formatujKcal(makraSuroviny.kalorie)} kcal · B{" "}
                          {formatujMakro(makraSuroviny.bilkoviny)} · S{" "}
                          {formatujMakro(makraSuroviny.sacharidy)} · T{" "}
                          {formatujMakro(makraSuroviny.tuky)}
                          {polozka && polozka.cena !== null && ` · ${kc.format(polozka.cena)} Kč`}
                        </p>
                      )}
                      {errors.suroviny?.[i]?.gramyNaPorce && (
                        <Chyba text={errors.suroviny[i]?.gramyNaPorce?.message} />
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <Input
                        placeholder="pozn. (volitelné)"
                        aria-label={`Surovina ${i + 1} – poznámka`}
                        {...register(`suroviny.${i}.poznamka`)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={fields.length <= 1}
                      aria-label={`Odebrat surovinu ${i + 1}`}
                      className="col-start-4 row-start-1 grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30 sm:col-start-5"
                      title="Odebrat surovinu"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => append(VYCHOZI_SUROVINA)}
              disabled={fields.length >= 30}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
            >
              <Plus className="size-4" /> Přidat surovinu
            </button>
            {duplicitni.length > 0 && (
              <p className="mt-2 text-xs text-warning">
                {duplicitni.join(", ")} {duplicitni.length === 1 ? "je" : "jsou"} v receptu vícekrát – sečtěte gramáže do jedné suroviny.
              </p>
            )}
            {dotazPotraviny.isError && (
              <p className="mt-2 text-xs text-danger">Katalog potravin se nepodařilo načíst.</p>
            )}
          </Card>

          {/* postup */}
          <Card>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="postup" className="text-sm font-medium text-fg">
                Postup (každý krok na nový řádek)
              </label>
              {kroky > 0 && (
                <span className="text-xs tabular-nums text-muted">
                  {kroky} {sklonuj(kroky, "krok", "kroky", "kroků")}
                </span>
              )}
            </div>
            <textarea
              id="postup"
              rows={7}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
              placeholder={"Rýži uvařte podle návodu.\nKuře opepřete, osolte a orestujte…"}
              {...register("postup")}
            />
            {errors.postup && <Chyba text={errors.postup.message} />}
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" varianta="accent" velikost="lg" disabled={mutace.isPending}>
              {mutace.isPending ? "Ukládám…" : editace ? "Uložit změny" : "Uložit recept"}
            </Button>
            <Button
              type="button"
              varianta="ghost"
              velikost="lg"
              onClick={() => naviguj(editace ? `/recepty/${id}` : "/recepty")}
            >
              Zrušit
            </Button>
          </div>
        </div>

        {/* -------- živá účtenka (desktop sticky) -------- */}
        <Uctenka
          nazev={nazev}
          porce={porceBezpecne}
          uctenka={uctenka}
          cenaZaPorce={cenaZaPorce}
          usetreno={usetreno}
          className="sticky top-24 hidden self-start lg:block"
        />
      </form>

      {/* mobilní páska se součty – sedí nad spodní navigací, tap = účtenka */}
      <button
        type="button"
        onClick={() => setUctenkaOtevrena(true)}
        aria-label="Zobrazit účtenku receptu"
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-dashed border-border bg-surface/95 px-4 py-2.5 font-mono text-xs backdrop-blur lg:hidden"
      >
        <span className="flex items-center justify-between gap-3" aria-live="polite">
          <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <Receipt className="size-3.5 shrink-0" />
            <span className="truncate">{nazev.trim() || "nový recept"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-fg">
            {cenaZaPorce !== null ? `${celo.format(cenaZaPorce)} Kč` : "— Kč"} · {celo.format(uctenka.kcal)} kcal
            <ChevronUp className="size-3.5 text-muted" />
          </span>
        </span>
      </button>

      {/* mobilní účtenka – bottom sheet */}
      {uctenkaOtevrena && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Účtenka receptu">
          <button
            type="button"
            aria-label="Zavřít účtenku"
            className="absolute inset-0 bg-black/55"
            onClick={() => setUctenkaOtevrena(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-bg px-5 pb-10 pt-9">
            <Uctenka
              nazev={nazev}
              porce={porceBezpecne}
              uctenka={uctenka}
              cenaZaPorce={cenaZaPorce}
              usetreno={usetreno}
              className="mx-auto w-64"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- účtenka ---------------- */

function Uctenka({
  nazev,
  porce,
  uctenka,
  cenaZaPorce,
  usetreno,
  className,
}: {
  nazev: string;
  porce: number;
  uctenka: ReturnType<typeof spocitejUctenku>;
  cenaZaPorce: number | null;
  usetreno: number;
  className?: string;
}) {
  const vyplnene = uctenka.polozky.filter((p) => p.nazev !== "—").length;
  const zobrazene = uctenka.polozky.slice(0, 9);
  const schovane = uctenka.polozky.length - zobrazene.length;
  const nejakaSleva = uctenka.polozky.some((p) => p.sleva > 0.009);
  const dnes = new Date().toLocaleDateString("cs-CZ");

  return (
    <aside className={cn("relative", className)} aria-label="Živá účtenka receptu">
      <span className="om-cenovka absolute -right-2 -top-3 z-10 rotate-3 text-xs">
        {cenaZaPorce !== null ? `${celo.format(cenaZaPorce)} Kč / porce` : "živě z cen"}
      </span>
      <div className="om-uctenka rotate-[0.5deg] px-4 pb-9 pt-4 text-[11px] leading-relaxed">
        <div className="text-center font-bold tracking-[0.2em]">OPTIMEAL</div>
        <div className="text-center text-[10px] opacity-70">
          receptová účtenka · KASA 01
        </div>
        <div className="text-center text-[10px] opacity-50">{dnes}</div>
        {nazev.trim() && (
          <div className="mt-1 truncate text-center font-semibold uppercase">
            {nazev.trim()}
          </div>
        )}
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        {vyplnene === 0 ? (
          <p className="py-3 text-center opacity-60">
            přidáním surovin se účtenka začne tisknout…
          </p>
        ) : (
          zobrazene.map((p, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className="min-w-0 truncate">
                {p.nazev === "—" ? "(nevybráno)" : p.nazev}
                {p.sleva > 0.009 && <span className="font-bold">*</span>}
              </span>
              <span className="shrink-0 opacity-60">{celo.format(p.gramy)} g</span>
              <span className="mx-0.5 flex-1 -translate-y-0.5 border-b border-dotted border-[#c9c9bd]" />
              <span className="shrink-0 tabular-nums">
                {p.cena !== null ? `${kc.format(p.cena)}` : "—"}
              </span>
            </div>
          ))
        )}
        {schovane > 0 && (
          <div className="opacity-60">… a {schovane} {sklonuj(schovane, "surovina", "suroviny", "surovin")} navíc</div>
        )}
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        <div className="flex justify-between font-bold">
          <span>ZA PORCI</span>
          <span className="tabular-nums">
            {cenaZaPorce !== null ? `${kc.format(cenaZaPorce)} Kč` : "— Kč"}
          </span>
        </div>
        {porce > 1 && (
          <div className="flex justify-between">
            <span>ZA {porce}× PORCI CELKEM</span>
            <span className="tabular-nums">
              {cenaZaPorce !== null ? `${kc.format(cenaZaPorce * porce)} Kč` : "— Kč"}
            </span>
          </div>
        )}
        {usetreno > 0.009 && (
          <div className="flex justify-between font-bold">
            <span>Z TOHO SLEVA</span>
            <span className="tabular-nums">−{kc.format(usetreno)} Kč</span>
          </div>
        )}
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        <div className="grid grid-cols-4 gap-1 text-center">
          <span><b>{celo.format(uctenka.kcal)}</b><br />kcal</span>
          <span><b>{celo.format(uctenka.b)}</b><br />bílk.</span>
          <span><b>{celo.format(uctenka.s)}</b><br />sach.</span>
          <span><b>{celo.format(uctenka.t)}</b><br />tuky</span>
        </div>
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        {/* čárový kód – dekorativní, „EAN“ odvozený z receptu */}
        <div
          aria-hidden="true"
          className="mx-auto h-7 w-3/4"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg,#21261f 0 2px,transparent 2px 5px,#21261f 5px 6px,transparent 6px 8px,#21261f 8px 11px,transparent 11px 13px,#21261f 13px 14px,transparent 14px 17px)",
          }}
        />
        <div className="mt-1 text-center tracking-[0.3em] opacity-70">
          8 5940 {String(vyplnene).padStart(3, "0")} {String(porce).padStart(2, "0")}
        </div>
        {nejakaSleva && <div className="mt-1 opacity-60">* dnes v akci</div>}
        <div className="mt-2 text-center font-semibold">DĚKUJEME, ŽE VAŘÍTE</div>
        <div className="text-center opacity-60">
          gramáže na 1 porci · ceny z dnešních slev
        </div>
      </div>
    </aside>
  );
}

/** české tvary podle počtu: sklonuj(5, "krok", "kroky", "kroků") */
function sklonuj(n: number, jedna: string, malo: string, mnoho: string): string {
  if (n === 1) return jedna;
  if (n >= 2 && n <= 4) return malo;
  return mnoho;
}

function Chyba({ text }: { text?: string | undefined }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-danger">{text}</p>;
}
