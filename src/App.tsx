import { Navigate, Route, Routes } from "react-router-dom";
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
import { Ucet } from "@/routes/Ucet";
import { Nastaveni } from "@/routes/Nastaveni";
import { Jidelnicek } from "@/routes/Jidelnicek";
import { PlanyDetail } from "@/routes/PlanyDetail";
import { Recepty } from "@/routes/Recepty";
import { ReceptDetail } from "@/routes/ReceptDetail";
import { ReceptEditace } from "@/routes/ReceptEditace";
import { Mealprep } from "@/routes/Mealprep";
import { Nakup } from "@/routes/Nakup";

export default function App() {
  // bez klíčů k Supabase produkt nespustí demo verzi – zobrazí přesný návod
  if (!supabaseNastaveno) {
    return <SetupGate />;
  }

  return (
    <MotivPoskytovatel>
      <AuthPoskytovatel>
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

          {/* neznámá cesta → přehled */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthPoskytovatel>
    </MotivPoskytovatel>
  );
}
