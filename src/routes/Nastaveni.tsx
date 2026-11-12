import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * Nastavení – motiv, jazyk (připraveno) a stav propojení se Supabase.
 * Návod na propojení řeší SetupGate – tady je jen stav a volby.
 */

export function Nastaveni() {
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
        <p className="text-sm text-muted">
          Přepínač motivu najdete v levém bočním menu (na mobilu v horní liště) –
          světlý, tmavý i automatický dle systému.
        </p>
      </Card>
    </div>
  );
}
