import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";

/** Registrace e-mailem a heslem (Supabase Auth). */
export function Registrace() {
  const { registrovat } = useAuth();
  const naviguj = useNavigate();
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [hesloZnovu, setHesloZnovu] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odesilam, setOdesilam] = useState(false);

  async function odeslat(e: FormEvent) {
    e.preventDefault();
    setChyba(null);

    if (heslo !== hesloZnovu) {
      setChyba("Hesla se neshodují.");
      return;
    }

    setOdesilam(true);
    const vysledek = await registrovat(email.trim(), heslo);
    setOdesilam(false);

    if (vysledek.chyba) {
      setChyba(vysledek.chyba);
      return;
    }
    toast.success("Účet vytvořen. Zkontrolujte e-mail (možná čeká potvrzovací odkaz).");
    naviguj("/");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-extrabold tracking-tight">Vytvořit účet</h1>
      <p className="mt-1 text-sm text-muted">Začněte jíst lépe a šetřit – za minutku jste v tom.</p>

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
          <Label htmlFor="heslo">Heslo</Label>
          <Input
            id="heslo"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            placeholder="alespoň 6 znaků"
          />
        </div>
        <div>
          <Label htmlFor="heslo2">Heslo znovu</Label>
          <Input
            id="heslo2"
            type="password"
            autoComplete="new-password"
            required
            value={hesloZnovu}
            onChange={(e) => setHesloZnovu(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {chyba && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{chyba}</p>
        )}

        <Button type="submit" className="w-full" disabled={odesilam}>
          {odesilam ? "Vytvářím účet…" : "Vytvořit účet"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Už účet máte?{" "}
        <Link to="/prihlaseni" className="font-semibold text-primary hover:underline">
          Přihlaste se
        </Link>
      </p>
    </div>
  );
}
