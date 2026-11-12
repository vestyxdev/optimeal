import { Leaf, TrendingDown, Utensils, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth";

/**
 * Přehled – domovská stránka. V této fázi bez dat (generátor a plány
 * přijdou v dalších fázích), ale s reálným stavem a smysluplnou
 * prázdnou zprávou, která uživatele navede dál.
 */

const HODNOTY = [
  {
    ikona: Utensils,
    nadpis: "Jezte lépe",
    text: "Jídelníček přesně na vaše cíle – kalorie i makra doladěná na gram.",
  },
  {
    ikona: Wallet,
    nadpis: "Šetřete peníze",
    text: "Generátor upřednostní potraviny, které jsou právě ve slevě v obchodech.",
  },
  {
    ikona: TrendingDown,
    nadpis: "Plýtváte méně",
    text: "Nákupní seznam z plánu a mealprep na více dní – žádné nevyužité potraviny.",
  },
];

export function Prehled() {
  const { uzivatel } = useAuth();

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="rounded-card bg-primary-strong px-6 py-10 text-primary-fg md:px-10 md:py-14">
        <Badge tono="accent" className="mb-4 bg-accent text-accent-fg">
          Chytrá strava pro Česko
        </Badge>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
          {uzivatel
            ? "Vítejte zpět v OptiMeal 👋"
            : "Jezte lépe. Šetřete peníze. Plánujte chytře."}
        </h1>
        <p className="mt-3 max-w-xl text-sm opacity-80 md:text-base">
          Osobní jídelníček podle vašich cílů, mealprep na více dní a nákupní
          seznam s aktuálními slevami z českých obchodů – vše v jedné aplikaci.
        </p>
      </div>

      {/* hodnoty */}
      <div className="grid gap-4 sm:grid-cols-3">
        {HODNOTY.map((h) => (
          <Card key={h.nadpis} className="flex flex-col gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
              <h.ikona className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">{h.nadpis}</h3>
              <p className="mt-1 text-sm text-muted">{h.text}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* prázdný stav přehledu – upřímný, navede dál */}
      <Card className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent-fg">
          <Leaf className="size-6" />
        </span>
        <h2 className="mt-3 font-semibold">Přehled se rozběhne, jakmile vytvoříte první plán</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {uzivatel
            ? "Jídelníček, mealprep i nákupní seznam se staví ve fázích – dlaždice denních jídel, rozpočtu a úspor přibudou hned, jakmile je generátor propojen s vaším účtem."
            : "Přihlaste se, abychom mohli stavět váš plán na míru – cíl, rozpočet i slevy."}
        </p>
      </Card>
    </div>
  );
}
