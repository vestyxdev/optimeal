import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { supabaseNastaveno } from "@/lib/supabase";
import { MotivPoskytovatel } from "@/lib/motiv";
import { AuthPoskytovatel } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { SetupGate } from "@/components/layout/SetupGate";
import { Prehled } from "@/routes/Prehled";
import { Prihlaseni } from "@/routes/Prihlaseni";
import { Registrace } from "@/routes/Registrace";
import { ObnoveniHesla } from "@/routes/ObnoveniHesla";
import { NoveHeslo } from "@/routes/NoveHeslo";
import { VyzadujePrihlaseni } from "@/components/layout/VyzadujePrihlaseni";
import { Nenalezeno } from "@/routes/Nenalezeno";
import { Podminky, Soukromi } from "@/routes/Pravni";
import { Skeleton } from "@/components/ui/Nacitani";
import { lazyRoute } from "@/lib/lazyRoute";

// těžké routy se načítají lazy – hlavní bundle zůstane malý;
// lazyRoute po nezdařeném importu (zastaralý chunk po deployi)
// jednou automaticky reloadne místo error screenu
const Ucet = lazyRoute(() => import("@/routes/Ucet"), "Ucet");
const Nastaveni = lazyRoute(() => import("@/routes/Nastaveni"), "Nastaveni");
const Jidelnicek = lazyRoute(() => import("@/routes/Jidelnicek"), "Jidelnicek");
const PlanyDetail = lazyRoute(() => import("@/routes/PlanyDetail"), "PlanyDetail");
const Recepty = lazyRoute(() => import("@/routes/Recepty"), "Recepty");
const Potraviny = lazyRoute(() => import("@/routes/Potraviny"), "Potraviny");
const ReceptDetail = lazyRoute(() => import("@/routes/ReceptDetail"), "ReceptDetail");
const ReceptEditace = lazyRoute(() => import("@/routes/ReceptEditace"), "ReceptEditace");
const Mealprep = lazyRoute(() => import("@/routes/Mealprep"), "Mealprep");
const Nakup = lazyRoute(() => import("@/routes/Nakup"), "Nakup");
const Denik = lazyRoute(() => import("@/routes/Denik"), "Denik");

export default function App() {
  // bez klíčů k Supabase produkt nespustí demo verzi – zobrazí přesný návod
  if (!supabaseNastaveno) {
    return <SetupGate />;
  }

  return (
    <MotivPoskytovatel>
      <AuthPoskytovatel>
        <Suspense
          fallback={
            <div className="om-kontejner w-full space-y-3 py-6" aria-label="Načítám stránku">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          }
        >
        <Routes>
          {/* samostatné stránky bez shellu */}
          <Route path="/prihlaseni" element={<Prihlaseni />} />
          <Route path="/registrace" element={<Registrace />} />
          <Route path="/obnoveni-hesla" element={<ObnoveniHesla />} />
          <Route path="/nove-heslo" element={<NoveHeslo />} />

          {/* aplikace se shellem */}
          <Route element={<Layout />}>
            <Route path="/" element={<Prehled />} />
            <Route
              path="/jidelnicek"
              element={
                <VyzadujePrihlaseni>
                  <Jidelnicek />
                </VyzadujePrihlaseni>
              }
            />
            <Route path="/recepty" element={<Recepty />} />
            <Route path="/potraviny" element={<Potraviny />} />
            <Route
              path="/recepty/novy"
              element={
                <VyzadujePrihlaseni>
                  <ReceptEditace />
                </VyzadujePrihlaseni>
              }
            />
            <Route
              path="/recepty/:id/upravit"
              element={
                <VyzadujePrihlaseni>
                  <ReceptEditace />
                </VyzadujePrihlaseni>
              }
            />
            <Route path="/recepty/:id" element={<ReceptDetail />} />
            <Route
              path="/mealprep"
              element={
                <VyzadujePrihlaseni>
                  <Mealprep />
                </VyzadujePrihlaseni>
              }
            />
            <Route
              path="/denik"
              element={
                <VyzadujePrihlaseni>
                  <Denik />
                </VyzadujePrihlaseni>
              }
            />
            <Route
              path="/nakup"
              element={
                <VyzadujePrihlaseni>
                  <Nakup />
                </VyzadujePrihlaseni>
              }
            />
            <Route
              path="/plany/:id"
              element={
                <VyzadujePrihlaseni>
                  <PlanyDetail />
                </VyzadujePrihlaseni>
              }
            />
            <Route path="/ucet" element={<Ucet />} />
            <Route path="/nastaveni" element={<Nastaveni />} />
            <Route path="/soukromi" element={<Soukromi />} />
            <Route path="/podminky" element={<Podminky />} />
          </Route>

          {/* neznámá cesta → 404 */}
          <Route path="*" element={<Nenalezeno />} />
        </Routes>
        </Suspense>
      </AuthPoskytovatel>
    </MotivPoskytovatel>
  );
}
