import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTitulek } from "@/lib/titulky";

/**
 * Nastavení nového hesla – cíl odkazu z obnovovacího e-mailu.
 * Supabase po kliknutí na odkaz vytvoří recovery session a pošle
 * událost PASSWORD_RECOVERY (nebo přijde #access_token v URL).
 */
export function NoveHeslo() {
  useTitulek("Nové heslo");
  const { ulozitNoveHeslo, uzivatel, nacitaSe } = useAuth();
  const naviguj = useNavigate();
  const [heslo, setHeslo] = useState("");
  const [hesloZnovu, setHesloZnovu] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odesilam, setOdesilam] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // recovery session vznikne z tokenu v URL → posloucháme událost
    const { data: odber } = supabase.auth.onAuthStateChange((udalost, session) => {
      if (udalost === "PASSWORD_RECOVERY" || (session && udalost === "SIGNED_IN")) {
        setRecovery(true);
      }
    });
    // přímý vstup s již aktivní session (link otevřený ve stejném prohlížeči)
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecovery(true);
    });
    return () => odber.subscription.unsubscribe();
  }, []);

  const pripraveno = recovery || (!nacitaSe && uzivatel !== null);

  async function odeslat(e: FormEvent) {
    e.preventDefault();
    setChyba(null);
    if (heslo !== hesloZnovu) {
      setChyba("Hesla se neshodují.");
      return;
    }
    setOdesilam(true);
    const vysledek = await ulozitNoveHeslo(heslo);
    setOdesilam(false);
    if (vysledek.chyba) {
      setChyba(vysledek.chyba);
      return;
    }
    toast.success("Heslo bylo změněno. Jste přihlášeni.");
    naviguj("/ucet");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-extrabold tracking-tight">Nové heslo</h1>

      {nacitaSe ? (
        <p className="mt-6 text-sm text-muted">Ověřuji odkaz…</p>
      ) : pripraveno ? (
        <>
          <p className="mt-1 text-sm text-muted">Zvolte si nové heslo (alespoň 6 znaků).</p>
          <form onSubmit={odeslat} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="heslo">Nové heslo</Label>
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
              <Label htmlFor="heslo2">Nové heslo znovu</Label>
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
              {odesilam ? "Ukládám…" : "Nastavit nové heslo"}
            </Button>
          </form>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            Odkaz je neplatný nebo už vypršel. Požádejte o nový.
          </p>
          <p className="text-sm text-muted">
            <Link to="/obnoveni-hesla" className="font-semibold text-primary hover:underline">
              Poslat nový odkaz
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
