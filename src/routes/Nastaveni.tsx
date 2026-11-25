import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, MonitorSmartphone, Moon, Store, Sun, Trash2, Weight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/lib/auth";
import { exportujMujData, stahniJson } from "@/lib/data/export";
import { nactiAktivniCile, nactiProfil, ulozProfil } from "@/lib/data/profil";
import { nactiObchody } from "@/lib/data/potraviny";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import { useMotiv } from "@/lib/motiv";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Nastavení – vzhled, zabezpečení účtu (změna hesla), export dat
 * (GDPR), lokální data zařízení a odkazy. Sekce vázané na účet se
 * ukážou jen přihlášeným; vzhled a lokální data fungují vždy.
 */

const MOTIVY = [
  { hodnota: "light", nazev: "Světlý", ikona: Sun },
  { hodnota: "dark", nazev: "Tmavý", ikona: Moon },
  { hodnota: "system", nazev: "Podle systému", ikona: MonitorSmartphone },
] as const;

const LS_NEDAVNE = "om-vyber-nedavne";

export function Nastaveni() {
  const { motiv, nastavMotiv } = useMotiv();
  const { uzivatel } = useAuth();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Nastavení</h1>

      {uzivatel && <SekceZabezpeceni />}
      {uzivatel && <SekceCile />}
      {uzivatel && <SekceObchody />}
      {uzivatel && <SekceJednotka />}
      {uzivatel && <SekceData />}

      {/* vzhled */}
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

      <SekceLokalniData />

      {/* stav propojení */}
      <Card>
        <CardNadpis>Propojení s Supabase (databáze + přihlášení)</CardNadpis>
        <div className="flex items-center gap-2 text-sm">
          <Badge tono="ok">Připojeno</Badge>
          <span className="text-muted">Aplikace komunikuje se Supabase projektem.</span>
        </div>
      </Card>

      {/* odkazy */}
      <Card>
        <CardNadpis>O aplikaci</CardNadpis>
        <nav className="flex flex-col gap-2 text-sm">
          {uzivatel && (
            <Link to="/ucet" className="font-medium text-primary hover:underline">
              Můj účet – profil, cíle, dieta a alergie →
            </Link>
          )}
          <Link to="/soukromi" className="text-muted hover:text-fg hover:underline">
            Zásady ochrany osobních údajů
          </Link>
          <Link to="/podminky" className="text-muted hover:text-fg hover:underline">
            Podmínky použití
          </Link>
        </nav>
      </Card>
    </div>
  );
}

/** Změna hesla přímo v nastavení – updateUser na aktivní session. */
function SekceZabezpeceni() {
  const { uzivatel, ulozitNoveHeslo } = useAuth();
  const [heslo1, setHeslo1] = useState("");
  const [heslo2, setHeslo2] = useState("");
  const [uklada, setUklada] = useState(false);

  async function zmenitHeslo(e: React.FormEvent) {
    e.preventDefault();
    if (heslo1.length < 6) {
      toast.error("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    if (heslo1 !== heslo2) {
      toast.error("Hesla se neshodují.");
      return;
    }
    setUklada(true);
    try {
      const { chyba } = await ulozitNoveHeslo(heslo1);
      if (chyba) {
        toast.error(chyba);
        return;
      }
      toast.success("Heslo bylo změněno.");
      setHeslo1("");
      setHeslo2("");
    } finally {
      setUklada(false);
    }
  }

  return (
    <Card>
      <CardNadpis>Účet a zabezpečení</CardNadpis>
      <p className="text-sm text-muted">
        Přihlášen jako <span className="font-medium text-fg">{uzivatel?.email}</span>
      </p>
      <form onSubmit={(e) => void zmenitHeslo(e)} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="nast-heslo1">Nové heslo</Label>
          <Input
            id="nast-heslo1"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={heslo1}
            onChange={(e) => setHeslo1(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="nast-heslo2">Nové heslo znovu</Label>
          <Input
            id="nast-heslo2"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={heslo2}
            onChange={(e) => setHeslo2(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={uklada}>
          {uklada ? "Měním heslo…" : "Změnit heslo"}
        </Button>
      </form>
    </Card>
  );
}

/** Aktuální výživový plán + spuštění průvodce přepočtem. */
function SekceCile() {
  const dotazCile = useQuery({ queryKey: ["cile"], queryFn: nactiAktivniCile });
  const cile = dotazCile.data ?? null;

  return (
    <Card>
      <CardNadpis>Výživové cíle</CardNadpis>
      {dotazCile.isLoading ? (
        <p className="text-sm text-muted">Načítám cíle…</p>
      ) : cile ? (
        <p className="text-sm">
          <span className="text-lg font-extrabold tabular-nums">{formatujKcal(cile.kalorie)} kcal</span>
          <span className="text-muted">
            {" "}· B {formatujMakro(cile.bilkoviny)} g · S {formatujMakro(cile.sacharidy)} g · T {formatujMakro(cile.tuky)} g
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">Cíle zatím nemáte nastavené.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          to="/cile"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
        >
          {cile ? "Přepočítat cíle" : "Spustit průvodce cíli"}
        </Link>
        <Link to="/ucet" className="text-sm text-muted hover:text-fg hover:underline">
          Upravit ručně v Mém účtu →
        </Link>
      </div>
    </Card>
  );
}

/** Oblíbené obchody – priorita při párování slev a nákupních seznamů. */
function SekceObchody() {
  const klient = useQueryClient();
  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil });
  const dotazObchody = useQuery({ queryKey: ["obchody"], queryFn: nactiObchody });
  const vybrane = dotazProfil.data?.oblibeneObchody ?? [];

  const mutace = useMutation({
    mutationFn: (obchody: string[]) => ulozProfil({ oblibeneObchody: obchody }),
    onSuccess: () => {
      toast.success("Oblíbené obchody uloženy.");
      void klient.invalidateQueries({ queryKey: ["profil"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Uložení selhalo."),
  });

  const prepni = (nazev: string) => {
    const nove = vybrane.includes(nazev)
      ? vybrane.filter((o) => o !== nazev)
      : [...vybrane, nazev];
    mutace.mutate(nove);
  };

  return (
    <Card>
      <CardNadpis>
        <Store className="mr-1.5 inline size-4" aria-hidden />
        Oblíbené obchody
      </CardNadpis>
      <p className="text-sm text-muted">
        Řetězce, ve kterých nakupujete – dostanou přednost při párování slev
        a sestavování nákupního seznamu.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {dotazObchody.isLoading && <p className="text-sm text-muted">Načítám obchody…</p>}
        {(dotazObchody.data ?? []).map((nazev) => {
          const aktivni = vybrane.includes(nazev);
          return (
            <button
              key={nazev}
              type="button"
              onClick={() => prepni(nazev)}
              aria-pressed={aktivni}
              disabled={mutace.isPending}
              className={
                aktivni
                  ? "inline-flex h-10 items-center rounded-lg border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  : "inline-flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:border-primary/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
              }
            >
              {nazev}
            </button>
          );
        })}
      </div>
      {vybrane.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Vybrané: {vybrane.join(", ")}
        </p>
      )}
    </Card>
  );
}

/** Výchozí jednotka pro zápis do deníku – gramy/ml vs. celé balení. */
function SekceJednotka() {
  const klient = useQueryClient();
  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil });
  const hodnota = dotazProfil.data?.vychoziJednotka ?? "g";

  const mutace = useMutation({
    mutationFn: (j: "g" | "baleni") => ulozProfil({ vychoziJednotka: j }),
    onSuccess: () => {
      toast.success("Výchozí jednotka uložena.");
      void klient.invalidateQueries({ queryKey: ["profil"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Uložení selhalo."),
  });

  return (
    <Card>
      <CardNadpis>
        <Weight className="mr-1.5 inline size-4" aria-hidden />
        Deník – výchozí jednotka
      </CardNadpis>
      <p className="text-sm text-muted">
        Při zápisu potraviny s balením (např. plechovka 500 ml) se předvyplní
        zvolená jednotka – jde kdykoli přepnout přímo v deníku.
      </p>
      <div className="mt-3">
        <Select
          id="nast-jednotka"
          aria-label="Výchozí jednotka"
          value={hodnota}
          onChange={(e) => mutace.mutate(e.target.value as "g" | "baleni")}
          disabled={mutace.isPending || dotazProfil.isLoading}
          className="w-auto min-w-56"
        >
          <option value="g">Gramy / mililitry</option>
          <option value="baleni">Celé balení / kusy</option>
        </Select>
      </div>
    </Card>
  );
}

/** Export všech dat uživatele (GDPR přenositelnost) + odkaz na účet. */
function SekceData() {
  const [exportuje, setExportuje] = useState(false);

  async function stahnoutExport() {
    setExportuje(true);
    try {
      const data = await exportujMujData();
      stahniJson(data);
      toast.success("Data byla exportována do JSON souboru.");
    } catch (e) {
      toast.error(`Export selhal: ${(e as Error).message}`);
    } finally {
      setExportuje(false);
    }
  }

  return (
    <Card>
      <CardNadpis>Moje data</CardNadpis>
      <p className="text-sm text-muted">
        Stáhněte si všechna svá data – profil, výživové cíle, jídelní plány,
        deník, nákupní seznamy, vlastní recepty i potraviny, záznamy váhy –
        jako JSON (právo na přenositelnost dle GDPR).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button varianta="outline" onClick={() => void stahnoutExport()} disabled={exportuje}>
          <Download className="size-4" />
          {exportuje ? "Připravuji export…" : "Exportovat data"}
        </Button>
        <Link to="/ucet" className="text-sm text-muted hover:text-fg hover:underline">
          Profil, cíle a smazání účtu → Můj účet
        </Link>
      </div>
    </Card>
  );
}

/** Lokální data zařízení – nedávno použité potraviny ve výběru. */
function SekceLokalniData() {
  const [vymazano, setVymazano] = useState(false);

  function vymazatNedavne() {
    try {
      localStorage.removeItem(LS_NEDAVNE);
      setVymazano(true);
      toast.success("Nedávno použité potraviny byly vymazány.");
    } catch {
      toast.error("Lokální úložiště není dostupné.");
    }
  }

  return (
    <Card>
      <CardNadpis>Data v tomto zařízení</CardNadpis>
      <p className="text-sm text-muted">
        Nedávno použité potraviny a volba motivu se ukládají jen v prohlížeči
        tohoto zařízení – neodcházejí na server.
      </p>
      <div className="mt-3">
        <Button
          varianta="outline"
          onClick={vymazatNedavne}
          disabled={vymazano}
        >
          <Trash2 className="size-4" />
          {vymazano ? "Vymazáno" : "Vymazat nedávné potraviny"}
        </Button>
      </div>
    </Card>
  );
}
