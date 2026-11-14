import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  nactiAktivniCile,
  nactiProfil,
  ulozCile,
  ulozProfil,
  type Profil,
} from "@/lib/data/profil";
import { platnaMakra, spocitejCile, type Cile as CileVyziva } from "@/lib/vyziva/cile";

/**
 * Můj účet – tělesné údaje, z nichž se počítají denní cíle (TDEE),
 * a aktivní sada cílů pro generátor jídelníčku.
 */

const AKTIVITA_NAZVY: Record<string, string> = {
  sedava: "Sedavá (práce vsedě)",
  mirna: "Mírná (pohyb 1–3× týdně)",
  aktivni: "Aktivní (pohyb 3–5× týdně)",
  velmi: "Velmi aktivní (trénink denně)",
};

const CIL_TELA_NAZVY: Record<string, string> = {
  zhubnout: "Zhubnout",
  udrzet: "Udržet váhu",
  zhodnotit: "Zvýšit váhu",
};

function naCislo(h: string, vychozi: number): number {
  const n = Number(h.replace(",", "."));
  return Number.isFinite(n) ? n : vychozi;
}

/** Náhled cíle vypočteného z aktuálních vstupů. */
function nahledCilu(p: Profil): CileVyziva | null {
  if (
    p.vahaKg == null ||
    p.vyskaCm == null ||
    p.vekRoku == null ||
    p.pohlavi == null ||
    p.aktivita == null ||
    p.cilTela == null
  ) {
    return null;
  }
  return spocitejCile({
    vahaKg: p.vahaKg,
    vyskaCm: p.vyskaCm,
    vekRoku: p.vekRoku,
    pohlavi: p.pohlavi,
    aktivita: p.aktivita,
    cilTela: p.cilTela,
    teloTukProcento: p.teloTukProcento,
  });
}

export function Ucet() {
  const { uzivatel, nacitaSe, odhlasit } = useAuth();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();

  const dotazProfil = useQuery({ queryKey: ["profil"], queryFn: nactiProfil, enabled: uzivatel !== null });
  const dotazCile = useQuery({ queryKey: ["cile"], queryFn: nactiAktivniCile, enabled: uzivatel !== null });

  // lokální kopie profilu pro formulář
  const [form, setForm] = useState<Profil | null>(null);
  useEffect(() => {
    if (dotazProfil.data && form === null) setForm(dotazProfil.data);
  }, [dotazProfil.data, form]);

  const mutaceUlozit = useMutation({
    mutationFn: async (p: Profil) => {
      await ulozProfil({
        jmeno: p.jmeno ?? "",
        vahaKg: p.vahaKg ?? undefined,
        vyskaCm: p.vyskaCm ?? undefined,
        vekRoku: p.vekRoku ?? undefined,
        pohlavi: p.pohlavi ?? undefined,
        aktivita: p.aktivita ?? undefined,
        cilTela: p.cilTela ?? undefined,
        teloTukProcento: p.teloTukProcento ?? null,
        tydennyRozpocetKc: p.tydennyRozpocetKc ?? null,
        pocetJidelDenne: p.pocetJidelDenne,
      });
      // cíle z profilu: vždy přepočet + aktivace
      const c = nahledCilu(p);
      if (c && platnaMakra(c)) {
        await ulozCile(c, "auto");
      }
    },
    onSuccess: () => {
      toast.success("Profil a cíle uloženy.");
      void klientQ.invalidateQueries({ queryKey: ["profil"] });
      void klientQ.invalidateQueries({ queryKey: ["cile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  if (dotazProfil.isLoading || (form === null && !dotazProfil.isError)) {
    return <p className="text-sm text-muted">Načítám profil…</p>;
  }

  if (!form) {
    return (
      <Card className="bg-danger-soft text-sm text-danger">
        {(dotazProfil.error as Error | undefined)?.message ?? "Profil se nepodařilo načíst."}
      </Card>
    );
  }

  const nahled = nahledCilu(form);
  const aktivni = dotazCile.data ?? null;

  function uprav(zmeny: Partial<Profil>) {
    setForm((f) => (f ? { ...f, ...zmeny } : f));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Můj účet</h1>
        <p className="mt-1 text-sm text-muted">
          Ztělesných údajů spočítáme denní cíl (kalorie + makra), který používá
          generátor jídelníčku.
        </p>
      </div>

      {/* účet */}
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
        <Button varianta="outline" className="mt-4" onClick={() => void odhlasit()}>
          Odhlásit se
        </Button>
      </Card>

      {/* tělesné údaje */}
      <Card>
        <CardNadpis>Tělesné údaje</CardNadpis>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="jmeno">Jméno</Label>
            <Input
              id="jmeno"
              value={form.jmeno ?? ""}
              onChange={(e) => uprav({ jmeno: e.target.value })}
              placeholder="Volitelné"
            />
          </div>
          <div>
            <Label htmlFor="vaha">Váha (kg)</Label>
            <Input
              id="vaha" type="number" inputMode="decimal" step="0.1"
              value={form.vahaKg ?? ""}
              onChange={(e) => uprav({ vahaKg: e.target.value === "" ? null : naCislo(e.target.value, 0) })}
            />
          </div>
          <div>
            <Label htmlFor="vyska">Výška (cm)</Label>
            <Input
              id="vyska" type="number" inputMode="numeric"
              value={form.vyskaCm ?? ""}
              onChange={(e) => uprav({ vyskaCm: e.target.value === "" ? null : naCislo(e.target.value, 0) })}
            />
          </div>
          <div>
            <Label htmlFor="vek">Věk</Label>
            <Input
              id="vek" type="number" inputMode="numeric"
              value={form.vekRoku ?? ""}
              onChange={(e) => uprav({ vekRoku: e.target.value === "" ? null : naCislo(e.target.value, 0) })}
            />
          </div>
          <div>
            <Label htmlFor="pohlavi">Pohlaví</Label>
            <select
              id="pohlavi"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:outline-2 focus:outline-primary"
              value={form.pohlavi ?? ""}
              onChange={(e) => uprav({ pohlavi: (e.target.value || null) as Profil["pohlavi"] })}
            >
              <option value="">— vyberte —</option>
              <option value="m">Muž</option>
              <option value="z">Žena</option>
            </select>
          </div>
          <div>
            <Label htmlFor="teloTuk">Tělesný tuk (%) – volitelné</Label>
            <Input
              id="teloTuk" type="number" inputMode="decimal" step="0.1"
              value={form.teloTukProcento ?? ""}
              onChange={(e) =>
                uprav({ teloTukProcento: e.target.value === "" ? null : naCislo(e.target.value, 0) })
              }
              placeholder="Přesnější výpočet"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="aktivita">Aktivita</Label>
            <select
              id="aktivita"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:outline-2 focus:outline-primary"
              value={form.aktivita ?? ""}
              onChange={(e) => uprav({ aktivita: (e.target.value || null) as Profil["aktivita"] })}
            >
              <option value="">— vyberte —</option>
              {Object.entries(AKTIVITA_NAZVY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cilTela">Cíl</Label>
            <select
              id="cilTela"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:outline-2 focus:outline-primary"
              value={form.cilTela ?? ""}
              onChange={(e) => uprav({ cilTela: (e.target.value || null) as Profil["cilTela"] })}
            >
              <option value="">— vyberte —</option>
              {Object.entries(CIL_TELA_NAZVY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="rozpocet">Týdenní rozpočet (Kč)</Label>
            <Input
              id="rozpocet" type="number" inputMode="numeric"
              value={form.tydennyRozpocetKc ?? ""}
              onChange={(e) =>
                uprav({ tydennyRozpocetKc: e.target.value === "" ? null : naCislo(e.target.value, 0) })
              }
              placeholder="Např. 1200"
            />
          </div>
          <div>
            <Label htmlFor="pocetJidel">Jídel denně</Label>
            <select
              id="pocetJidel"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:outline-2 focus:outline-primary"
              value={form.pocetJidelDenne}
              onChange={(e) => uprav({ pocetJidelDenne: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}× denně</option>
              ))}
            </select>
          </div>
        </div>

        {/* náhled vypočtu */}
        {nahled && (
          <div className="mt-4 rounded-card border border-border bg-surface-2 p-4 text-sm">
            <div className="font-semibold">Vypočtený denní cíl</div>
            <div className="mt-1 text-muted">
              {nahled.kalorie} kcal · B {nahled.bilkoviny} g · S {nahled.sacharidy} g · T {nahled.tuky} g
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Bilkoviny 30 % · sacharidy 40 % · tuky 30 % energie
              {form.teloTukProcento != null ? " (Katch-McArdle)" : " (Mifflin-St Jeor)"}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={() => mutaceUlozit.mutate(form)}
            disabled={mutaceUlozit.isPending || nahled === null}
          >
            {mutaceUlozit.isPending ? "Ukládám…" : "Uložit profil a cíle"}
          </Button>
        </div>
      </Card>

      {/* aktivní cíle */}
      {aktivni && (
        <Card>
          <CardNadpis>Aktivní cíle</CardNadpis>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-card bg-surface-2 p-3">
              <div className="text-xs text-muted">Kalorie</div>
              <div className="text-lg font-extrabold">{aktivni.kalorie} kcal</div>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <div className="text-xs text-muted">Bílkoviny</div>
              <div className="text-lg font-extrabold">{aktivni.bilkoviny} g</div>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <div className="text-xs text-muted">Sacharidy</div>
              <div className="text-lg font-extrabold">{aktivni.sacharidy} g</div>
            </div>
            <div className="rounded-card bg-surface-2 p-3">
              <div className="text-xs text-muted">Tuky</div>
              <div className="text-lg font-extrabold">{aktivni.tuky} g</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Tyto hodnoty se předvyplní v Jídelníčku. Přepočítají se při uložení
            profilu – nebo je můžete v Jídelníčku doladit ručně.
          </p>
        </Card>
      )}

      {/* nebezpečná zóna – smazání účtu (GDPR) */}
      <SekceSmazaniUctu />
    </div>
  );
}

/** Smazání účtu přes security-definer RPC – kaskáda uklidí všechna data. */
function SekceSmazaniUctu() {
  const { odhlasit } = useAuth();
  const naviguj = useNavigate();
  const [maze, setMaze] = useState(false);

  async function smazatUcet() {
    const klient = supabase;
    if (!klient) return;
    if (
      !window.confirm(
        "Opravdu chcete trvale smazat účet? Zmizí profil, cíle, plány, nákupní seznamy i vlastní recepty a potraviny. Akce je nevratná.",
      )
    ) {
      return;
    }
    setMaze(true);
    try {
      const { error } = await klient.rpc("delete_own_account");
      if (error) throw new Error(error.message);
      await odhlasit();
      toast.success("Účet byl trvale smazán.");
      naviguj("/", { replace: true });
    } catch (e) {
      toast.error(`Účet se nepodařilo smazat: ${(e as Error).message}`);
      setMaze(false);
    }
  }

  return (
    <Card className="border-danger/40">
      <CardNadpis>Nebezpečná zóna</CardNadpis>
      <p className="text-sm text-muted">
        Smazání účtu je trvalé – odstraní profil, cíle, plány, seznamy a vlastní
        recepty i potraviny.
      </p>
      <Button
        varianta="danger"
        className="mt-3"
        onClick={() => void smazatUcet()}
        disabled={maze}
      >
        {maze ? "Mažu účet…" : "Smazat účet"}
      </Button>
    </Card>
  );
}
