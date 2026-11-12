import { Route, Routes } from "react-router-dom";
import { MotivPoskytovatel } from "@/lib/motiv";
import { AuthPoskytovatel } from "@/lib/auth";
import { Layout } from "@/components/layout/Layout";
import { Prehled } from "@/routes/Prehled";
import { Prihlaseni } from "@/routes/Prihlaseni";
import { Registrace } from "@/routes/Registrace";
import { Ucet } from "@/routes/Ucet";
import { Nastaveni } from "@/routes/Nastaveni";

export default function App() {
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
