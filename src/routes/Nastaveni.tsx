import { MonitorSmartphone, Moon, Sun } from "lucide-react";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useMotiv } from "@/lib/motiv";

/**
 * Nastavení – motiv (světlý / tmavý / podle systému) a stav
 * propojení se Supabase. Návod na propojení řeší SetupGate.
 */

const MOTIVY = [
  { hodnota: "light", nazev: "Světlý", ikona: Sun },
  { hodnota: "dark", nazev: "Tmavý", ikona: Moon },
  { hodnota: "system", nazev: "Podle systému", ikona: MonitorSmartphone },
] as const;

export function Nastaveni() {
  const { motiv, nastavMotiv } = useMotiv();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Nastavení</h1>

      {/* stav propojení */}
      <Card>
        <CardNadpis>Propojení s Supabase (databáze + přihlášení)</CardNadpis>
        <div className="flex items-center gap-2 text-sm">
          <Badge tono="ok">Připojeno</Badge>
          <span className="text-muted">Aplikace komunikuje se Supabase projektem.</span>
        </div>
      </Card>

      {/* motiv */}
      <Card>
        <CardNadpis>Vzhled</CardNadpis>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Motiv vzhledu">
          {MOTIVY.map((m) => {
            const aktivni = motiv === m.hodnota;
            return (
              <button
                key={m.hodnota}
                type="button"
                role="radio"
                aria-checked={aktivni}
                onClick={() => nastavMotiv(m.hodnota)}
                className={
                  aktivni
                    ? "flex flex-col items-center gap-2 rounded-card border-2 border-primary bg-primary-soft px-3 py-4 text-sm font-semibold text-primary"
                    : "flex flex-col items-center gap-2 rounded-card border-2 border-border px-3 py-4 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-fg"
                }
              >
                <m.ikona className="size-5" />
                {m.nazev}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          „Podle systému" přepíná automaticky s nastavením zařízení. Rychlý
          přepínač světlý/tmavý je i v levém menu (na mobilu v nabídce „Více").
        </p>
      </Card>
    </div>
  );
}
