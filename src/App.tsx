import { Route, Routes } from "react-router-dom";
import { supabaseNastaveno } from "@/lib/supabase";
import { MotivPoskytovatel } from "@/lib/motiv";
import { AuthPoskytovatel } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { SetupGate } from "@/components/layout/SetupGate";
import { Prehled } from "@/routes/Prehled";
import { Prihlaseni } from "@/routes/Prihlaseni";
import { Registrace } from "@/routes/Registrace";
import { Ucet } from "@/routes/Ucet";
import { Nastaveni } from "@/routes/Nastaveni";
import { Jidelnicek } from "@/routes/Jidelnicek";
import { PlanyDetail } from "@/routes/PlanyDetail";
import { Recepty } from "@/routes/Recepty";
import { ReceptDetail } from "@/routes/ReceptDetail";

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

          {/* aplikace se shellem */}
          <Route element={<Layout />}>
            <Route path="/" element={<Prehled />} />
            <Route path="/jidelnicek" element={<Jidelnicek />} />
            <Route path="/recepty" element={<Recepty />} />
            <Route path="/recepty/:id" element={<ReceptDetail />} />
            <Route path="/plany/:id" element={<PlanyDetail />} />
            <Route path="/ucet" element={<Ucet />} />
            <Route path="/nastaveni" element={<Nastaveni />} />
          </Route>

          {/* neznámá cesta → přehled */}
          <Route path="*" element={<Prehled />} />
        </Routes>
      </AuthPoskytovatel>
    </MotivPoskytovatel>
  );
}
