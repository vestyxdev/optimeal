import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import {
  KATEGORIE_NAZVY,
  nactiRecept,
  ulozRecept,
  upravRecept,
} from "@/lib/data/recepty";
import { nactiPotravinySeSlevami } from "@/lib/data/plany";
import { Skeleton } from "@/components/ui/Nacitani";
import { cn } from "@/lib/cn";

/**
 * Nový / úprava vlastního receptu. Suroviny se vybírají z katalogu
 * potravin (živé ceny), gramáž je vždy na 1 porci. Validace zod +
 * react-hook-form; uložení přes RLS (jen vlastní recepty).
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

export function ReceptEditace() {
  const { id } = useParams<{ id: string }>();
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

  const potraviny = dotazPotraviny.data ?? [];

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          to={editace ? `/recepty/${id}` : "/recepty"}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" /> {editace ? "Zpět na recept" : "Zpět na recepty"}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
          {editace ? "Upravit recept" : "Nový recept"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Gramáže surovin zadávejte vždy na 1 porci – cena i výživa se dopočítají
          automaticky z aktuálních cen.
        </p>
      </div>

      <form onSubmit={handleSubmit((h) => mutace.mutate(h))} className="space-y-6">
        {/* hlavička */}
        <Card className="space-y-4">
          <div>
            <Label htmlFor="nazev">Název receptu</Label>
            <Input id="nazev" {...register("nazev")} placeholder="Kuře s rýží a brokolicí" />
            {errors.nazev && <Chyba text={errors.nazev.message} />}
          </div>
          <div>
            <Label htmlFor="popis">Popis (volitelný)</Label>
            <Input id="popis" {...register("popis")} placeholder="Rychlý oběd s dostatečným obsahem bílkovin…" />
            {errors.popis && <Chyba text={errors.popis.message} />}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="kategorie">Kategorie</Label>
              <select
                id="kategorie"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:outline-2 focus:outline-primary"
                {...register("kategorie")}
              >
                {KATEGORIE.map((k) => (
                  <option key={k} value={k}>{KATEGORIE_NAZVY[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="porce">Porce</Label>
              <Input id="porce" type="number" inputMode="numeric" min={1} max={12} {...register("porce", { valueAsNumber: true })} />
              {errors.porce && <Chyba text={errors.porce.message} />}
            </div>
            <div>
              <Label htmlFor="casMinuty">Čas (min, volitelné)</Label>
              <Input
                id="casMinuty" type="number" inputMode="numeric" min={1} max={600}
                {...register("casMinuty", { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
                placeholder="30"
              />
              {errors.casMinuty && <Chyba text={errors.casMinuty.message} />}
            </div>
          </div>
        </Card>

        {/* suroviny */}
        <Card>
          <CardNadpis>Suroviny (na 1 porci)</CardNadpis>
          {errors.suroviny?.message && <Chyba text={errors.suroviny.message} />}
          <ul className="space-y-3">
            {fields.map((pole, i) => (
              <li key={pole.id} className="grid grid-cols-[1fr_88px_36px] items-start gap-2 sm:grid-cols-[1fr_88px_1fr_36px]">
                <div>
                  <select
                    aria-label={`Surovina ${i + 1} – potravina`}
                    className={cn(
                      "h-10 w-full rounded-lg border bg-surface px-2 text-sm text-fg focus:outline-2 focus:outline-primary",
                      errors.suroviny?.[i]?.foodId ? "border-danger" : "border-border",
                    )}
                    {...register(`suroviny.${i}.foodId`)}
                  >
                    <option value="">— potravina —</option>
                    {potraviny.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nazev} ({p.aktualniCena.toFixed(2)} Kč/100 g{p.sleva ? " – sleva" : ""})
                      </option>
                    ))}
                  </select>
                  {errors.suroviny?.[i]?.foodId && <Chyba text={errors.suroviny[i]?.foodId?.message} />}
                </div>
                <div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min={1}
                    placeholder="g"
                    aria-label={`Surovina ${i + 1} – gramáž na porci`}
                    {...register(`suroviny.${i}.gramyNaPorce`, { valueAsNumber: true })}
                  />
                  {errors.suroviny?.[i]?.gramyNaPorce && (
                    <Chyba text={errors.suroviny[i]?.gramyNaPorce?.message} />
                  )}
                </div>
                <div className="col-span-3 sm:col-span-1">
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
                  className="col-start-3 row-start-1 grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30 sm:col-start-4"
                  title="Odebrat surovinu"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            varianta="outline"
            velikost="sm"
            className="mt-3"
            onClick={() => append(VYCHOZI_SUROVINA)}
            disabled={fields.length >= 30}
          >
            <Plus className="size-4" /> Přidat surovinu
          </Button>
          {dotazPotraviny.isError && (
            <p className="mt-2 text-xs text-danger">Katalog potravin se nepodařilo načíst.</p>
          )}
        </Card>

        {/* postup */}
        <Card>
          <Label htmlFor="postup">Postup (každý krok na nový řádek)</Label>
          <textarea
            id="postup"
            rows={6}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-2 focus:outline-primary"
            placeholder={"Rýži uvařte podle návodu.\nKuře opepřete a osolte…"}
            {...register("postup")}
          />
          {errors.postup && <Chyba text={errors.postup.message} />}
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutace.isPending}>
            {mutace.isPending ? "Ukládám…" : editace ? "Uložit změny" : "Uložit recept"}
          </Button>
          <Button
            type="button"
            varianta="ghost"
            onClick={() => naviguj(editace ? `/recepty/${id}` : "/recepty")}
          >
            Zrušit
          </Button>
        </div>
      </form>
    </div>
  );
}

function Chyba({ text }: { text?: string | undefined }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-danger">{text}</p>;
}
