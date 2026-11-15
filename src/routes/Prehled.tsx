import { Suspense, lazy, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CookingPot,
  Leaf,
  Plus,
  ShoppingBasket,
  Target,
  TrendingDown,
  Utensils,
  Wallet,
} from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MiniaturaPotraviny } from "@/components/ui/MiniaturaPotraviny";
import { Skeleton } from "@/components/ui/Nacitani";
import { useAuth } from "@/lib/auth";
import { formatujCenu, formatujPlatnostDo } from "@/lib/cena";
import { nactiAktivniCile, nactiProfil } from "@/lib/data/profil";
import { cenaPlanu, nactiPosledniPlan, usporaPlanu } from "@/lib/data/plany";
import { nactiMeNakupniSeznamy } from "@/lib/data/nakup";
import { nactiAktualniSlevy, nactiVerejneAkce } from "@/lib/data/potraviny";

const MakroGraf = lazy(() => import("@/components/prehled/MakroGraf"));

/**
 * Přehled – přihlášenému uživateli živý dashboard (cíl, poslední plán,
 * úspory, rozpočet, seznamy), nepřihlášenému hodnota produktu a CTA.
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

const TYP_NAZVY: Record<string, string> = {
  den: "Denní plán",
  tyden: "Týdenní plán",
  mealprep: "Mealprep",
};

export function Prehled() {
  const { uzivatel, nacitaSe } = useAuth();
  if (nacitaSe) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  return uzivatel ? <PrihlasenyPrehled /> : <VerejnyPrehled />;
}

/* ============================================================
 * Veřejná varianta (marketing + CTA)
 * ============================================================ */

function VerejnyPrehled() {
  const naviguj = useNavigate();
  return (
    <div className="space-y-6">
      <Hero
        titulek="Jezte lépe. Šetřete peníze. Plánujte chytře."
        podtitul="Osobní jídelníček podle vašich cílů, mealprep na více dní a nákupní
          seznam s aktuálními slevami z českých obchodů – vše v jedné aplikaci."
        vizual={<UctenkaUkazka />}
      />

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

      <ZiveAkce />

      <Card className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent-fg">
          <Leaf className="size-6" />
        </span>
        <h2 className="mt-3 font-semibold">Začněte za minutku</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Založte si účet, vyplňte pár údajů o sobě a nechte generátor sestavit
          jídelníček přesně na vaše cíle – s dnešními slevami.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => naviguj("/registrace")}>Vytvořit účet</Button>
          <Button varianta="outline" onClick={() => naviguj("/prihlaseni")}>
            Přihlásit se
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Živé letákové akce na landing – dokazuje, že ceny v appce jsou reálné (RPC top_akce, i pro anon). */
function ZiveAkce() {
  const dotaz = useQuery({ queryKey: ["verejne_akce"], queryFn: () => nactiVerejneAkce(12) });
  const akce = dotaz.data ?? [];
  // bez dat (nebo bez Supabase) sekci vůbec nevykreslovat
  if (!dotaz.isLoading && akce.length === 0) return null;
  return (
    <section aria-label="Aktuální slevy">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-semibold">Dnes ve slevě – živě z letáků</h2>
        <Link
          to="/potraviny?slevy=1"
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          Všechny akce
        </Link>
      </div>
      {dotaz.isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-32 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          {akce.map((p) => (
            <Link
              key={`${p.nazev}-${p.obchod}`}
              to="/potraviny?slevy=1"
              className="w-32 shrink-0 snap-start rounded-xl border border-border bg-surface p-2 transition-colors hover:border-primary/60"
            >
              <span className="relative mb-1.5 block overflow-hidden rounded-lg bg-surface-2">
                <MiniaturaPotraviny obrazek={p.obrazek} velikost="aspect-square w-full" />
                {p.slevaProcenta != null && (
                  <span className="absolute left-1 top-1 rounded-md bg-accent px-1 py-0.5 text-[10px] font-bold text-accent-ink">
                    −{p.slevaProcenta} %
                  </span>
                )}
              </span>
              <span className="block truncate text-xs font-medium">{p.nazev}</span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-muted">
                {formatujCenu(p.cena, p.baleniG).hlavni}
                {p.obchod ? ` · ${p.obchod}` : ""}
              </span>
              {p.puvodniCena != null && p.puvodniCena > p.cena && (
                <span className="block text-[10px] tabular-nums text-muted line-through">
                  {formatujCenu(p.puvodniCena, p.baleniG).hlavni}
                </span>
              )}
              {formatujPlatnostDo(p.platnostDo) && (
                <span className="mt-0.5 block text-[10px] text-muted">
                  {formatujPlatnostDo(p.platnostDo)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * Dashboard přihlášeného uživatele
 * ============================================================ */

function PrihlasenyPrehled() {
  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil });
  const dotazCile = useQuery({ queryKey: ["cile"], queryFn: nactiAktivniCile });
  const dotazPlan = useQuery({ queryKey: ["posledni_plan"], queryFn: nactiPosledniPlan });
  const dotazSeznamy = useQuery({ queryKey: ["me_nakupni_seznamy"], queryFn: nactiMeNakupniSeznamy });
  const dotazSlevy = useQuery({ queryKey: ["aktualni_slevy"], queryFn: () => nactiAktualniSlevy(10) });

  const profil = dotazProfil.data ?? null;
  const cile = dotazCile.data ?? null;
  const plan = dotazPlan.data ?? null;
  const seznamy = dotazSeznamy.data ?? [];
  const aktivniSeznamy = seznamy.filter((s) => !s.hotovo);

  const nekdeChyba =
    dotazProfil.isError || dotazCile.isError || dotazPlan.isError || dotazSeznamy.isError;

  const jmeno = profil?.jmeno?.trim() || null;
  const uspora = plan ? usporaPlanu(plan.data?.vysledek) : 0;
  const cenaPosledniho = plan ? cenaPlanu(plan.data?.vysledek) : 0;
  const rozpocet = profil?.tydennyRozpocetKc ?? null;
  // rozpočet porovnáváme jen s týdenním plánem
  const tydeniCena = plan?.typ === "tyden" ? cenaPosledniho : null;
  const procentoRozpoctu =
    rozpocet !== null && tydeniCena !== null && rozpocet > 0
      ? Math.round((tydeniCena / rozpocet) * 100)
      : null;

  return (
    <div className="space-y-6">
      <Hero
        titulek={jmeno ? `Vítejte zpět, ${jmeno}` : "Vítejte zpět v OptiMeal"}
        podtitul="Váš přehled: denní cíl, poslední plán, úspory ze slev a nákupní seznamy – vše živě z účtu."
        vizual={
          uspora > 0 ? (
            <span className="om-cenovka rotate-6 self-center text-sm lg:self-auto">
              sleva −{uspora.toFixed(0)} Kč
            </span>
          ) : undefined
        }
      />

      {nekdeChyba && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-danger-soft text-sm text-danger">
          <span>Data přehledu se nepodařilo načíst – zkontrolujte připojení.</span>
          <Button
            varianta="outline"
            velikost="sm"
            onClick={() => {
              void dotazProfil.refetch();
              void dotazCile.refetch();
              void dotazPlan.refetch();
              void dotazSeznamy.refetch();
            }}
          >
            Zkusit znovu
          </Button>
        </Card>
      )}

      {/* rychlé akce */}
      <div className="flex flex-wrap gap-2">
        <Link to="/jidelnicek">
          <Button varianta="outline" velikost="sm">
            <CalendarDays className="size-4" /> Jídelníček
          </Button>
        </Link>
        <Link to="/mealprep">
          <Button varianta="outline" velikost="sm">
            <CookingPot className="size-4" /> Mealprep
          </Button>
        </Link>
        <Link to="/recepty/novy">
          <Button varianta="outline" velikost="sm">
            <Plus className="size-4" /> Nový recept
          </Button>
        </Link>
        <Link to="/nakup">
          <Button varianta="outline" velikost="sm">
            <ShoppingBasket className="size-4" /> Nákup ({aktivniSeznamy.length})
          </Button>
        </Link>
      </div>

      {/* živé akční nabídky ze scraperu – vede do katalogu */}
      <Card>
        <CardNadpis>Aktuální akce</CardNadpis>
        {dotazSlevy.isLoading ? (
          <Skeleton className="h-32" />
        ) : dotazSlevy.isError ? (
          <p className="text-sm text-muted">
            Slevy se nepodařilo načíst.{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => void dotazSlevy.refetch()}
            >
              Zkusit znovu
            </button>
          </p>
        ) : (dotazSlevy.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Dnes žádné aktivní slevy.</p>
        ) : (
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {(dotazSlevy.data ?? []).map((p) => (
              <Link
                key={p.id}
                to="/potraviny?slevy=1"
                className="w-32 shrink-0 snap-start rounded-xl border border-border bg-surface p-2 transition-colors hover:border-primary/60"
              >
                <span className="relative mb-1.5 block overflow-hidden rounded-lg bg-surface-2">
                  <MiniaturaPotraviny obrazek={p.obrazek} velikost="aspect-square w-full" />
                  {p.slevaProcenta != null && (
                    <span className="absolute left-1 top-1 rounded-md bg-accent px-1 py-0.5 text-[10px] font-bold text-accent-ink">
                      −{p.slevaProcenta} %
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs font-medium">{p.nazev}</span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-muted">
                  {formatujCenu(p.aktualniCena, p.baleniG).hlavni}
                  {p.obchod ? ` · ${p.obchod}` : ""}
                </span>
                {p.puvodniCena != null && p.puvodniCena > p.aktualniCena && (
                  <span className="block text-[10px] tabular-nums text-muted line-through">
                    {formatujCenu(p.puvodniCena, p.baleniG).hlavni}
                  </span>
                )}
                {formatujPlatnostDo(p.platnostDo) && (
                  <span className="mt-0.5 block text-[10px] text-muted">
                    {formatujPlatnostDo(p.platnostDo)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* denní cíl */}
        <Card>
          <CardNadpis>Denní cíl</CardNadpis>
          {dotazCile.isLoading ? (
            <Skeleton className="h-24" />
          ) : cile ? (
            <>
              <div className="text-2xl font-extrabold tabular-nums">{cile.kalorie} kcal</div>
              <div className="mt-1 text-sm text-muted">
                B {cile.bilkoviny} g · S {cile.sacharidy} g · T {cile.tuky} g
              </div>
              <div className="mt-2">
                <Suspense fallback={<p className="text-xs text-muted">Graf…</p>}>
                  <MakroGraf cile={cile} />
                </Suspense>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Cíl zatím nemáte – spočítáme ho z váhy, výšky a aktivity.
              </p>
              <Link to="/ucet" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <Target className="size-4" /> Nastavit v Mém účtu
              </Link>
            </div>
          )}
        </Card>

        {/* poslední plán */}
        <Card>
          <CardNadpis>Poslední plán</CardNadpis>
          {dotazPlan.isLoading ? (
            <Skeleton className="h-24" />
          ) : plan ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{TYP_NAZVY[plan.typ] ?? plan.typ}</span>
                {uspora > 0 && <Badge tono="ok">−{uspora.toFixed(2)} Kč</Badge>}
              </div>
              <p className="text-sm text-muted">
                Cíl {plan.cil_kalorie} kcal ·{" "}
                {new Date(plan.vytvoreno).toLocaleDateString("cs-CZ")}
                {cenaPosledniho > 0 && <> · nákup ≈ {cenaPosledniho.toFixed(0)} Kč</>}
              </p>
              <Link
                to={`/plany/${plan.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Otevřít plán <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Zatím žádný plán. Generátor ho sestaví na míru vašim cílům.
              </p>
              <Link to="/jidelnicek" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Vytvořit jídelníček <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </Card>

        {/* nákupní seznamy + rozpočet */}
        <div className="space-y-4">
          <Card>
            <CardNadpis>Nákupní seznamy</CardNadpis>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tabular-nums">{aktivniSeznamy.length}</span>
              <span className="text-sm text-muted">
                aktivních · {seznamy.length - aktivniSeznamy.length} hotových
              </span>
            </div>
            <Link
              to="/nakup"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Otevřít nákupy <ArrowRight className="size-4" />
            </Link>
          </Card>

          {rozpocet !== null && (
            <Card>
              <CardNadpis>Týdenní rozpočet</CardNadpis>
              {procentoRozpoctu !== null && tydeniCena !== null ? (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold tabular-nums">
                      {tydeniCena.toFixed(0)} / {rozpocet.toFixed(0)} Kč
                    </span>
                    <span className={procentoRozpoctu > 100 ? "font-semibold text-danger" : "text-muted"}>
                      {procentoRozpoctu} %
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-pill bg-surface-2">
                    <div
                      className={procentoRozpoctu > 100 ? "h-full bg-danger" : "h-full bg-primary"}
                      style={{ width: `${Math.min(100, procentoRozpoctu)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {procentoRozpoctu > 100
                      ? "Poslední týdenní plán překračuje rozpočet."
                      : "Poslední týdenní plán se vejde do rozpočtu."}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Rozpočet {rozpocet.toFixed(0)} Kč/týden – vygenerujte týdenní
                  plán a uvidíte, jak mu odpovídá.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hrdina přehledu – zelená tabule s nadpisem v displejovém písmu;
 * volitelný vizuál napravo (ukázková účtenka / cedulka s úsporou).
 */
function Hero({
  titulek,
  podtitul,
  vizual,
}: {
  titulek: string;
  podtitul: string;
  vizual?: ReactNode;
}) {
  return (
    <div className="om-hero rounded-card bg-primary-hero px-6 py-10 text-white md:px-10 md:py-14">
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <Badge tono="accent" className="mb-4">
            Chytrá strava pro Česko
          </Badge>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {titulek}
          </h1>
          <p className="mt-3 max-w-xl text-sm opacity-80 md:text-base">{podtitul}</p>
        </div>
        {vizual}
      </div>
    </div>
  );
}

const UKAZKA_UCTENKY = [
  { jidlo: "Snídaně", nazev: "Ovesná kaše, banán", cena: "12" },
  { jidlo: "Oběd", nazev: "Kuřecí prsa, rýže", cena: "39" },
  { jidlo: "Svačina", nazev: "Jogurt, müsli", cena: "14" },
  { jidlo: "Večeře", nazev: "Čočková polévka", cena: "21" },
] as const;

/** Papírová účtenka s ukázkou naceněného denního plánu (hero vizuál). */
function UctenkaUkazka() {
  return (
    <div
      className="relative self-center drop-shadow-xl lg:self-auto"
      aria-hidden="true"
    >
      <div className="om-uctenka w-60 px-4 pb-7 pt-4 text-[11px] leading-relaxed">
        <div className="text-center font-bold tracking-wide">OPTIMEAL</div>
        <div className="text-center text-[10px] opacity-70">
          jídelníček na dnes
        </div>
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        {UKAZKA_UCTENKY.map((r) => (
          <div key={r.jidlo} className="flex justify-between gap-2">
            <span className="truncate">
              {r.jidlo} · {r.nazev}
            </span>
            <span className="shrink-0 tabular-nums">{r.cena} Kč</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-[#c9c9bd]" />
        <div className="flex justify-between font-bold">
          <span>CELKEM</span>
          <span className="tabular-nums">86 Kč</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>VYUŽITÉ SLEVY</span>
          <span className="tabular-nums">−19 Kč</span>
        </div>
      </div>
      <span className="om-cenovka absolute -right-3 -top-3 rotate-6 text-xs">
        AKCE
      </span>
    </div>
  );
}
