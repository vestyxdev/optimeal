import { Suspense, lazy } from "react";
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
import { Skeleton } from "@/components/ui/Nacitani";

// těžké routy se načítají lazy – hlavní bundle zůstane malý
const Ucet = lazy(() => import("@/routes/Ucet").then((m) => ({ default: m.Ucet })));
const Nastaveni = lazy(() => import("@/routes/Nastaveni").then((m) => ({ default: m.Nastaveni })));
const Jidelnicek = lazy(() => import("@/routes/Jidelnicek").then((m) => ({ default: m.Jidelnicek })));
const PlanyDetail = lazy(() => import("@/routes/PlanyDetail").then((m) => ({ default: m.PlanyDetail })));
const Recepty = lazy(() => import("@/routes/Recepty").then((m) => ({ default: m.Recepty })));
const Potraviny = lazy(() => import("@/routes/Potraviny").then((m) => ({ default: m.Potraviny })));
const ReceptDetail = lazy(() => import("@/routes/ReceptDetail").then((m) => ({ default: m.ReceptDetail })));
const ReceptEditace = lazy(() => import("@/routes/ReceptEditace").then((m) => ({ default: m.ReceptEditace })));
const Mealprep = lazy(() => import("@/routes/Mealprep").then((m) => ({ default: m.Mealprep })));
const Nakup = lazy(() => import("@/routes/Nakup").then((m) => ({ default: m.Nakup })));

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
          </Route>

          {/* neznámá cesta → 404 */}
          <Route path="*" element={<Nenalezeno />} />
        </Routes>
        </Suspense>
      </AuthPoskytovatel>
    </MotivPoskytovatel>
  );
}
