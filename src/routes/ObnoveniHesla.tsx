import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { useTitulek } from "@/lib/titulky";
import { AuthShell } from "@/components/layout/AuthShell";

/** Obnovení hesla – odešle e-mail s odkazem na nastavení nového hesla. */
export function ObnoveniHesla() {
  useTitulek("Obnovení hesla");
  const { obnovitHeslo } = useAuth();
  const [email, setEmail] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odeslano, setOdeslano] = useState(false);
  const [odesilam, setOdesilam] = useState(false);

  async function odeslat(e: FormEvent) {
    e.preventDefault();
    setChyba(null);
    setOdesilam(true);
    const vysledek = await obnovitHeslo(email.trim());
    setOdesilam(false);
    if (vysledek.chyba) {
      setChyba(vysledek.chyba);
      return;
    }
    setOdeslano(true);
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Obnovení hesla</h1>
      <p className="mt-1 text-sm text-muted">
        Zadejte e-mail účtu – pošleme vám odkaz na nastavení nového hesla.
      </p>

      {odeslano ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            Odkaz jsme poslali na <strong>{email.trim()}</strong>. Zkontrolujte
            si doručenou poštu (i složku Spam).
          </p>
          <p className="text-sm text-muted">
            <Link to="/prihlaseni" className="font-semibold text-primary hover:underline">
              Zpět na přihlášení
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={odeslat} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan.novak@priklad.cz"
            />
          </div>

          {chyba && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{chyba}</p>
          )}

          <Button type="submit" className="w-full" disabled={odesilam}>
            {odesilam ? "Odesílám…" : "Poslat odkaz"}
          </Button>
        </form>
      )}

      {!odeslano && (
        <p className="mt-4 text-center text-sm text-muted">
          <Link to="/prihlaseni" className="font-semibold text-primary hover:underline">
            Zpět na přihlášení
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
