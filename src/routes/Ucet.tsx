import { Badge } from "@/components/ui/Badge";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

/** Můj účet – stav přihlášení, e-mail, odhlášení. Profil a cíle přijdou ve fázi 2. */
export function Ucet() {
  const { uzivatel, nacitaSe, odhlasit } = useAuth();
  const naviguj = useNavigate();

  if (nacitaSe) {
    return <p className="text-sm text-muted">Načítám účet…</p>;
  }

  if (!uzivatel) {
    return (
      <Card className="text-center">
        <CardNadpis>Nejste přihlášeni</CardNadpis>
        <p className="mb-4 text-sm text-muted">
          Přihlaste se, aby se váš plán, recepty i nákupní seznamy ukládaly pod váš účet.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => naviguj("/prihlaseni")}>Přihlásit se</Button>
          <Button varianta="outline" onClick={() => naviguj("/registrace")}>
            Vytvořit účet
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Můj účet</h1>

      <Card>
        <CardNadpis>Přihlášení</CardNadpis>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium">{uzivatel.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Stav</dt>
            <dd>
              <Badge tono="ok">Přihlášen</Badge>
            </dd>
          </div>
        </dl>
        <Button
          varianta="outline"
          className="mt-4"
          onClick={() => void odhlasit()}
        >
          Odhlásit se
        </Button>
      </Card>

      <Card className="text-sm text-muted">
        Profil (vaha, výška, cíl, rozpočet) a výživové cíle přijdou v další fázi –
        jejich výpočetní jádro už běží (viz testy TDEE).
      </Card>
    </div>
  );
}
