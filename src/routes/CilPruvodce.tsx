import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth";
import { nactiProfil, ulozCile, ulozProfil } from "@/lib/data/profil";
import { formatujKcal, formatujMakro } from "@/lib/cena";
import { cn } from "@/lib/cn";
import type { Aktivita, Cile, CilTela, Pohlavi } from "@/lib/vyziva/cile";
import {
  aktivitaZTreninku,
  CILE_TELA,
  odhadTerminu,
  rozsahTempa,
  spocitejPlan,
  TRENINKY,
  cileZKcal,
  cileZGramu,
  type TreninkyTydne,
} from "@/lib/vyziva/plan";

/**
 * Průvodce cíli (Cal AI styl) – otázka za otázkou, živý výpočet
 * BMR/TDEE, tempo hubnutí či nabírání s termínem a souhrn
 * s ručně upravitelnými makry. Přihlášenému se uloží do Supabase
 * (profil + aktivní cíle), hostovi do localStorage – při prvním
 * přihlášení se přenese automaticky (migrace v AuthPoskytovatel).
 */

export const LS_CILE_HOST = "om-cile-host";

type Krok = "pohlavi" | "treninky" | "udaje" | "cil" | "tempo" | "souhrn";
const KROKY: Krok[] = ["pohlavi", "treninky", "udaje", "cil", "tempo", "souhrn"];

interface Stav {
  pohlavi: Pohlavi | null;
  treninky: TreninkyTydne | null;
  vek: string;
  vyska: string;
  vaha: string;
  cilTela: CilTela | null;
  cilovaVaha: string;
  tempo: number;
}

const VYCHOZI: Stav = {
  pohlavi: null,
  treninky: null,
  vek: "30",
  vyska: "175",
  vaha: "80",
  cilTela: null,
  cilovaVaha: "70",
  tempo: 0.5,
};

function cislo(h: string): number {
  const n = Number(h.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function CilPruvodce() {
  const { uzivatel } = useAuth();
  const naviguj = useNavigate();
  const klientQ = useQueryClient();
  const [krok, setKrok] = useState(0);
  const [stav, setStav] = useState<Stav>(VYCHOZI);
  const [upravy, setUpravy] = useState<Cile | null>(null);

  // předvyplnění z profilu přihlášeného (jednorázově po načtení)
  const dotazProfil = useQuery({
    queryKey: ["profil"],
    queryFn: nactiProfil,
    enabled: uzivatel !== null,
  });
  const [predvyplneno, setPredvyplneno] = useState(false);
  const profil = dotazProfil.data;
  if (profil && !predvyplneno) {
    setPredvyplneno(true);
    setStav((s) => ({
      ...s,
      pohlavi: profil.pohlavi ?? s.pohlavi,
      treninky: aktivitaNaKartu(profil.aktivita) ?? s.treninky,
      vek: profil.vekRoku ? String(profil.vekRoku) : s.vek,
      vyska: profil.vyskaCm ? String(profil.vyskaCm) : s.vyska,
      vaha: profil.vahaKg ? String(profil.vahaKg) : s.vaha,
      cilTela: profil.cilTela ?? s.cilTela,
      cilovaVaha: profil.cilovaVahaKg ? String(profil.cilovaVahaKg) : s.cilovaVaha,
      tempo: profil.tempoKgTydne ?? s.tempo,
    }));
  }

  const cilTela = stav.cilTela;
  const krokyViditelne = useMemo(
    () => KROKY.filter((k) => k !== "tempo" || (cilTela !== null && cilTela !== "udrzet")),
    [cilTela],
  );
  const aktualniKrok = krokyViditelne[krok] ?? "souhrn";

  const cisla = useMemo(
    () => ({ vek: cislo(stav.vek), vyska: cislo(stav.vyska), vaha: cislo(stav.vaha), cilovaVaha: cislo(stav.cilovaVaha) }),
    [stav.vek, stav.vyska, stav.vaha, stav.cilovaVaha],
  );

  // průběžný plán – počítá se živě na kroku tempo i souhrn
  const plan = useMemo(() => {
    if (!stav.pohlavi || !stav.treninky || !cilTela) return null;
    if (!platnyVek(cisla.vek) || !platnaVyska(cisla.vyska) || !platnaVaha(cisla.vaha)) return null;
    return spocitejPlan({
      pohlavi: stav.pohlavi,
      treninky: stav.treninky,
      vekRoku: cisla.vek,
      vyskaCm: cisla.vyska,
      vahaKg: cisla.vaha,
      cilTela,
      ...(cilTela !== "udrzet" ? { cilovaVahaKg: cisla.cilovaVaha } : {}),
      tempoKgTydne: stav.tempo,
    });
  }, [stav.pohlavi, stav.treninky, stav.tempo, cilTela, cisla]);

  const cile = upravy ?? plan?.cile ?? null;

  const mutaceUlozit = useMutation({
    mutationFn: async (c: Cile) => {
      if (!uzivatel) {
        // host – cíle se přenesou při prvním přihlášení
        try {
          localStorage.setItem(LS_CILE_HOST, JSON.stringify({
            vstupy: {
              pohlavi: stav.pohlavi, aktivita: aktivitaZTreninku(stav.treninky!),
              cilTela, vahaKg: cisla.vaha, vyskaCm: cisla.vyska, vekRoku: cisla.vek,
              cilovaVahaKg: cilTela === "udrzet" ? null : cisla.cilovaVaha,
              tempoKgTydne: cilTela === "udrzet" ? null : stav.tempo,
            },
            cile: c,
          }));
        } catch {
          throw new Error("Lokální úložiště není dostupné – cíle se nepodařilo uložit.");
        }
        return;
      }
      await ulozProfil({
        pohlavi: stav.pohlavi,
        aktivita: aktivitaZTreninku(stav.treninky!),
        cilTela,
        vahaKg: cisla.vaha,
        vyskaCm: cisla.vyska,
        vekRoku: cisla.vek,
        cilovaVahaKg: cilTela === "udrzet" ? null : cisla.cilovaVaha,
        tempoKgTydne: cilTela === "udrzet" ? null : stav.tempo,
      });
      await ulozCile(c, upravy ? "manual" : "auto");
    },
    onSuccess: () => {
      void klientQ.invalidateQueries({ queryKey: ["cile"] });
      void klientQ.invalidateQueries({ queryKey: ["profil"] });
      toast.success(uzivatel ? "Plán uložen – jede se!" : "Plán uložen v zařízení – po přihlášení se přenese.");
      if (uzivatel) naviguj(-1);
      else naviguj("/");
    },
    onError: (e) => toast.error(`Plán se neuložil: ${(e as Error).message}`),
  });

  const muzeDalsi = validujKrok(aktualniKrok, stav, cisla);
  const posledniKrok = krok === krokyViditelne.length - 1;

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col">
      {/* tenký průběhový proužek */}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((krok + 1) / krokyViditelne.length) * 100)}
        aria-label="Postup průvodce"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${((krok + 1) / krokyViditelne.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 py-6">
        {aktualniKrok === "pohlavi" && (
          <KrokOtazka otazka="Jaké je tvé pohlaví?" podtitul="Ovlivňuje výpočet bazálního metabolismu.">
            <VyberKarty
              volby={[
                { klic: "m" as const, titul: "Muž", popis: "" },
                { klic: "z" as const, titul: "Žena", popis: "" },
              ]}
              vybrano={stav.pohlavi}
              naVyber={(k) => setStav({ ...stav, pohlavi: k })}
            />
          </KrokOtazka>
        )}

        {aktualniKrok === "treninky" && (
          <KrokOtazka otazka="Kolikrát týdně trénuješ?" podtitul="Určuje tvůj faktor aktivity (TDEE).">
            <VyberKarty
              volby={TRENINKY.map((t) => ({ klic: t.klic, titul: t.titul, popis: t.popis }))}
              vybrano={stav.treninky}
              naVyber={(k) => setStav({ ...stav, treninky: k })}
            />
          </KrokOtazka>
        )}

        {aktualniKrok === "udaje" && (
          <KrokOtazka otazka="Věk, výška a váha" podtitul="Z nich vypočítáme tvůj základní výdej energie.">
            <div className="grid grid-cols-3 gap-3">
              <Ciselnik id="cile-vek" popis="Věk" jednotka="let" hodnota={stav.vek}
                naZmenu={(v) => setStav({ ...stav, vek: v })} min={10} max={100} />
              <Ciselnik id="cile-vyska" popis="Výška" jednotka="cm" hodnota={stav.vyska}
                naZmenu={(v) => setStav({ ...stav, vyska: v })} min={120} max={230} />
              <Ciselnik id="cile-vaha" popis="Váha" jednotka="kg" hodnota={stav.vaha}
                naZmenu={(v) => setStav({ ...stav, vaha: v })} min={30} max={300} />
            </div>
            {plan && (
              <p className="text-sm text-muted">
                Odhad základního výdeje: <span className="font-semibold text-fg">{formatujKcal(plan.bmr)} kcal</span>,
                s aktivitou <span className="font-semibold text-fg">{formatujKcal(plan.tdee)} kcal</span> denně.
              </p>
            )}
          </KrokOtazka>
        )}

        {aktualniKrok === "cil" && (
          <KrokOtazka otazka="Jaký je tvůj cíl?" podtitul="Podle něj nastavíme kalorie a makra.">
            <VyberKarty
              volby={CILE_TELA.map((c) => ({ klic: c.klic, titul: c.titul, popis: c.popis }))}
              vybrano={stav.cilTela}
              naVyber={(k) => {
                const rozsah = rozsahTempa(k);
                setStav({
                  ...stav,
                  cilTela: k,
                  tempo: rozsah.vychozi || stav.tempo,
                  cilovaVaha:
                    k === "udrzet" ? stav.cilovaVaha
                    : Number.isFinite(cisla.cilovaVaha) && cisla.cilovaVaha !== cisla.vaha
                      ? stav.cilovaVaha
                      : String(cisla.vaha + (k === "zhubnout" ? -5 : 3)),
                });
              }}
            />
          </KrokOtazka>
        )}

        {aktualniKrok === "tempo" && cilTela && cilTela !== "udrzet" && (
          <KrokTempo stav={stav} cisla={cisla} cilTela={cilTela} plan={plan} setStav={setStav} />
        )}

        {aktualniKrok === "souhrn" && plan && cile && (
          <KrokSouhrn plan={plan} cile={cile} setUpravy={setUpravy} cilTela={cilTela!} />
        )}
      </div>

      {/* navigace */}
      <div className="flex items-center gap-3 pb-2">
        {krok > 0 && (
          <Button varianta="outline" onClick={() => setKrok(krok - 1)} aria-label="Zpět">
            <ArrowLeft className="size-4" /> Zpět
          </Button>
        )}
        <div className="flex-1" />
        {!posledniKrok ? (
          <Button onClick={() => muzeDalsi && setKrok(krok + 1)} disabled={!muzeDalsi}>
            Pokračovat <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={() => cile && mutaceUlozit.mutate(cile)}
            disabled={!cile || mutaceUlozit.isPending}
          >
            <Check className="size-4" />
            {mutaceUlozit.isPending ? "Ukládám…" : uzivatel ? "Uložit plán a začít" : "Uložit do zařízení"}
          </Button>
        )}
      </div>
    </div>
  );
}

function aktivitaNaKartu(a: Aktivita | null): TreninkyTydne | null {
  if (a === "sedava" || a === "mirna") return "0-2";
  if (a === "aktivni") return "3-5";
  if (a === "velmi") return "6+";
  return null;
}

const platnyVek = (n: number) => Number.isFinite(n) && n >= 10 && n <= 100;
const platnaVyska = (n: number) => Number.isFinite(n) && n >= 120 && n <= 230;
const platnaVaha = (n: number) => Number.isFinite(n) && n >= 30 && n <= 300;

function validujKrok(krok: Krok, s: Stav, c: { vek: number; vyska: number; vaha: number; cilovaVaha: number }): boolean {
  switch (krok) {
    case "pohlavi": return s.pohlavi !== null;
    case "treninky": return s.treninky !== null;
    case "udaje": return platnyVek(c.vek) && platnaVyska(c.vyska) && platnaVaha(c.vaha);
    case "cil": return s.cilTela !== null;
    case "tempo": {
      if (!s.cilTela || s.cilTela === "udrzet") return true;
      if (!platnaVaha(c.cilovaVaha)) return false;
      // cílová váha musí odpovídat směru cíle
      return s.cilTela === "zhubnout" ? c.cilovaVaha < c.vaha : c.cilovaVaha > c.vaha;
    }
    case "souhrn": return true;
  }
}

/** Obálka kroku – otázka + obsah. */
function KrokOtazka({ otazka, podtitul, children }: { otazka: string; podtitul?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{otazka}</h1>
        {podtitul && <p className="mt-1 text-sm text-muted">{podtitul}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Velké výběrové karty – jednotlivé volby kroku. */
function VyberKarty<K extends string>({
  volby, vybrano, naVyber,
}: {
  volby: { klic: K; titul: string; popis: string }[];
  vybrano: K | null;
  naVyber: (k: K) => void;
}) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {volby.map((v) => {
        const aktivni = vybrano === v.klic;
        return (
          <button
            key={v.klic}
            type="button"
            role="radio"
            aria-checked={aktivni}
            onClick={() => naVyber(v.klic)}
            className={cn(
              "flex min-h-[52px] items-center justify-between gap-3 rounded-card border-2 px-4 py-3 text-left transition-colors",
              aktivni
                ? "border-primary bg-primary-soft"
                : "border-border hover:border-primary/40 hover:bg-surface-2",
            )}
          >
            <span>
              <span className={cn("block font-bold", aktivni ? "text-primary" : "text-fg")}>{v.titul}</span>
              {v.popis && <span className="block text-sm text-muted">{v.popis}</span>}
            </span>
            {aktivni && <Check className="size-5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/** Číselný vstup s jednotkou – velký, dotykově přívětivý. */
function Ciselnik({ id, popis, jednotka, hodnota, naZmenu, min, max, krok = 1 }: {
  id: string; popis: string; jednotka: string; hodnota: string;
  naZmenu: (v: string) => void; min: number; max: number; krok?: number;
}) {
  return (
    <div>
      <Label htmlFor={id}>{popis}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={krok}
          value={hodnota}
          onChange={(e) => naZmenu(e.target.value)}
          className="h-12 pr-12 text-base font-semibold"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {jednotka}
        </span>
      </div>
    </div>
  );
}

/** Krok tempo – cílová váha + posuvník tempa s živým termínem. */
function KrokTempo({ stav, cisla, cilTela, plan, setStav }: {
  stav: Stav;
  cisla: { vaha: number; cilovaVaha: number };
  cilTela: CilTela;
  plan: ReturnType<typeof spocitejPlan> | null;
  setStav: (s: Stav) => void;
}) {
  const rozsah = rozsahTempa(cilTela);
  const smerChybi = platnaVaha(cisla.cilovaVaha) &&
    (cilTela === "zhubnout" ? cisla.cilovaVaha >= cisla.vaha : cisla.cilovaVaha <= cisla.vaha);
  const termin = plan?.terminCile ?? odhadTerminu(cisla.vaha, cisla.cilovaVaha, stav.tempo, cilTela);
  const tempoNazev =
    stav.tempo <= (cilTela === "zhubnout" ? 0.35 : 0.2) ? "Pomalé a udržitelné"
    : stav.tempo <= (cilTela === "zhubnout" ? 0.7 : 0.35) ? "Doporučené"
    : "Agresivní";

  return (
    <KrokOtazka
      otazka={cilTela === "zhubnout" ? "Kolik chceš zhubnout a jak rychle?" : "Kolik chceš nabrat a jak rychle?"}
      podtitul="Pomalé tempo drží svaly a lépe se dodržuje."
    >
      <div className="max-w-[12rem]">
        <Ciselnik
          id="cile-cilova-vaha"
          popis="Cílová váha"
          jednotka="kg"
          hodnota={stav.cilovaVaha}
          naZmenu={(v) => setStav({ ...stav, cilovaVaha: v })}
          min={30}
          max={300}
          krok={0.5}
        />
        {smerChybi && (
          <p className="mt-1.5 text-xs text-danger">
            {cilTela === "zhubnout"
              ? "Pro hubnutí musí být cílová váha nižší než aktuální."
              : "Pro nabírání musí být cílová váha vyšší než aktuální."}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="cile-tempo">Tempo</Label>
          <span className="text-sm font-semibold tabular-nums">
            {stav.tempo.toLocaleString("cs-CZ")} kg / týden
          </span>
        </div>
        <input
          id="cile-tempo"
          type="range"
          min={rozsah.min}
          max={rozsah.max}
          step={cilTela === "zhubnout" ? 0.1 : 0.05}
          value={stav.tempo}
          onChange={(e) => setStav({ ...stav, tempo: Number(e.target.value) })}
          className="mt-2 h-10 w-full accent-primary"
          aria-describedby="cile-tempo-nazev"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>Pomalé a udržitelné</span>
          <span id="cile-tempo-nazev" className="font-semibold text-fg">{tempoNazev}</span>
          <span>Agresivní</span>
        </div>
        {stav.tempo >= 0.8 && cilTela === "zhubnout" && (
          <p className="mt-2 text-xs text-danger">
            Agresivní deficit – hrozí úbytek svalů a jojo efekt. Zvaž pomalejší tempo.
          </p>
        )}
      </div>

      {platnaVaha(cisla.cilovaVaha) && !smerChybi && termin && (
        <p className="rounded-card bg-surface-2 px-4 py-3 text-sm">
          Cílové váhy <span className="font-bold">{formatujMakro(cisla.cilovaVaha)} kg</span>{" "}
          {cilTela === "zhubnout" ? "dosáhneš" : "nabereš"} kolem{" "}
          <span className="font-bold">
            {termin.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
          </span>
          .
        </p>
      )}
    </KrokOtazka>
  );
}

/** Souhrn – výsledný plán + ručně upravitelná čísla. */
function KrokSouhrn({ plan, cile, setUpravy, cilTela }: {
  plan: ReturnType<typeof spocitejPlan>;
  cile: Cile;
  setUpravy: (c: Cile) => void;
  cilTela: CilTela;
}) {
  const MAKRA: { klic: "bilkoviny" | "sacharidy" | "tuky"; nazev: string; barva: string }[] = [
    { klic: "bilkoviny", nazev: "Bílkoviny", barva: "bg-primary" },
    { klic: "sacharidy", nazev: "Sacharidy", barva: "bg-accent" },
    { klic: "tuky", nazev: "Tuky", barva: "bg-muted" },
  ];
  const maxG = Math.max(cile.bilkoviny, cile.sacharidy, cile.tuky, 1);

  return (
    <KrokOtazka otazka="Tvůj plán" podtitul="Klepnutím na číslo ho můžeš doladit – makra se přepočítají.">
      {/* velké kalorie */}
      <div className="rounded-card border-2 border-primary bg-primary-soft p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Denní cíl</div>
        <EditovatelneCislo
          hodnota={cile.kalorie}
          naZmenu={(n) => setUpravy(cileZKcal(n, cile))}
          velke
        />
        <div className="text-sm text-muted">kcal / den</div>
        {plan.pouzitaPodlaha && (
          <p className="mt-2 text-xs text-danger">
            Výpočet vycházel pod bezpečné minimum – nastavili jsme nejnižší zdravý příjem.
          </p>
        )}
      </div>

      {/* makra – editovatelné řádky s pruhem */}
      <div className="space-y-3">
        {MAKRA.map((m) => (
          <div key={m.klic} className="rounded-card border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{m.nazev}</span>
              <span className="flex items-baseline gap-1">
                <EditovatelneCislo
                  hodnota={cile[m.klic]}
                  naZmenu={(n) =>
                    setUpravy(cileZGramu(
                      m.klic === "bilkoviny" ? n : cile.bilkoviny,
                      m.klic === "sacharidy" ? n : cile.sacharidy,
                      m.klic === "tuky" ? n : cile.tuky,
                    ))
                  }
                />
                <span className="text-sm text-muted">g</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", m.barva)}
                style={{ width: `${(cile[m.klic] / maxG) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* stručný rozbor */}
      <div className="rounded-card bg-surface-2 px-4 py-3 text-sm text-muted">
        <p>
          Bazální metabolismus <span className="font-semibold text-fg">{formatujKcal(plan.bmr)} kcal</span>,
          s aktivitou <span className="font-semibold text-fg">{formatujKcal(plan.tdee)} kcal</span>
          {plan.korekceKcal !== 0 && (
            <>, {cilTela === "zhubnout" ? "deficit" : "přídavek"}{" "}
            <span className="font-semibold text-fg">{formatujKcal(Math.abs(plan.korekceKcal))} kcal</span></>
          )}
          .
        </p>
        {plan.terminCile && (
          <p className="mt-1">
            Odhad dosažení cíle:{" "}
            <span className="font-semibold text-fg">
              {plan.terminCile.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </p>
        )}
      </div>
    </KrokOtazka>
  );
}

/** Číslo, které se po klepnutí změní v editovatelné pole. */
function EditovatelneCislo({ hodnota, naZmenu, velke = false }: {
  hodnota: number;
  naZmenu: (n: number) => void;
  velke?: boolean;
}) {
  const [edituji, setEdituji] = useState(false);
  const [text, setText] = useState(String(hodnota));

  if (!edituji) {
    return (
      <button
        type="button"
        onClick={() => { setText(String(hodnota)); setEdituji(true); }}
        className={cn(
          "group inline-flex min-h-[44px] items-center gap-1.5 rounded-lg font-extrabold tabular-nums",
          velke ? "px-3 text-4xl" : "px-1.5 text-lg hover:bg-surface-2",
        )}
        aria-label={`Upravit hodnotu ${hodnota}`}
      >
        {formatujKcal(hodnota)}
        <Pencil className={cn("text-muted opacity-0 transition-opacity group-hover:opacity-100", velke ? "size-4" : "size-3")} />
      </button>
    );
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = cislo(text);
        if (Number.isFinite(n) && n > 0) naZmenu(Math.round(n));
        setEdituji(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEdituji(false);
      }}
      className={cn(
        "w-28 rounded-lg border-2 border-primary bg-surface px-2 py-1 text-center font-extrabold tabular-nums",
        velke ? "text-4xl" : "text-lg",
      )}
    />
  );
}
