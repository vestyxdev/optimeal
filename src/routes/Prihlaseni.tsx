import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { useTitulek } from "@/lib/titulky";

/** Přihlášení e-mailem a heslem (Supabase Auth). */
export function Prihlaseni() {
  useTitulek("Přihlášení");
  const { prihlasit, uzivatel, nacitaSe } = useAuth();
  const naviguj = useNavigate();
  const lokalita = useLocation();
  const zpetNa =
    (lokalita.state as { zpetNa?: string } | null)?.zpetNa ?? "/";
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odesilam, setOdesilam] = useState(false);

  if (!nacitaSe && uzivatel) {
    return <Navigate to={zpetNa} replace />;
  }

  async function odeslat(e: FormEvent) {
    e.preventDefault();
    setChyba(null);
    setOdesilam(true);
    const vysledek = await prihlasit(email.trim(), heslo);
    setOdesilam(false);
    if (vysledek.chyba) {
      setChyba(vysledek.chyba);
      return;
    }
    toast.success("Přihlášení proběhlo úspěšně.");
    naviguj(zpetNa);
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-extrabold tracking-tight">Přihlášení</h1>
      <p className="mt-1 text-sm text-muted">Vítejte zpět – pokračujte ve svém plánu.</p>

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
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="heslo">Heslo</Label>
            <Link
              to="/obnoveni-hesla"
              className="mb-1.5 text-xs font-medium text-primary hover:underline"
            >
              Zapomenuté heslo?
            </Link>
          </div>
          <Input
            id="heslo"
            type="password"
            autoComplete="current-password"
            required
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {chyba && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{chyba}</p>
        )}

        <Button type="submit" className="w-full" disabled={odesilam}>
          {odesilam ? "Přihlašuji…" : "Přihlásit se"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Nemáte účet?{" "}
        <Link to="/registrace" className="font-semibold text-primary hover:underline">
          Zaregistrujte se
        </Link>
      </p>
    </div>
  );
}
