import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";

/**
 * Právní stránky – Zásady ochrany osobních údajů a Podmínky použití.
 * Veřejné routy (dostupné i nepřihlášeným), minimalistické české znění.
 */

function Odsek({ nadpis, children }: { nadpis: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-base font-bold">{nadpis}</h2>
      <div className="space-y-2 text-sm text-muted">{children}</div>
    </section>
  );
}

export function Soukromi() {
  return (
    <Card className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Zásady ochrany osobních údajů</h1>
      <p className="text-sm text-muted">Poslední aktualizace: listopad 2026</p>

      <Odsek nadpis="Jaká data zpracováváme">
        <p>
          <strong className="text-fg">Účet:</strong> e-mailová adresa pro přihlášení (Spravuje
          Supabase Auth). <strong className="text-fg">Profil:</strong> dobrovolně zadané údaje
          (váha, výška, věk, pohlaví, aktivita, cíl těla, dieta, alergie) pro výpočet výživových
          cílů. <strong className="text-fg">Data aplikace:</strong> jídelníčky, deník, nákupní
          seznamy, vlastní recepty a potraviny – vše viditelné pouze vám (RLS).
        </p>
      </Odsek>
      <Odsek nadpis="K čemu data používáme">
        <p>
          Výhradně k provozu služby – výpočet cílů, plánování jídelníčků a nákupních seznamů.
          Data neprodáváme, nesdílíme s inzerenty ani nepoužíváme k reklamě.
        </p>
      </Odsek>
      <Odsek nadpis="Veřejná data">
        <p>
          Katalog potravin a pozorované ceny jsou sdílené všem návštěvníkům – pocházejí z veřejných
          zdrojů obchodů (letáky, e-shopy) a neobsahují osobní údaje. Vlastní potraviny, které
          přidáte do sdíleného katalogu, mohou vidět i ostatní uživatelé.
        </p>
      </Odsek>
      <Odsek nadpis="Vaše práva">
        <p>
          Svá data můžete kdykoliv upravit nebo smazat v sekci Můj účet (včetně úplného smazání
          účtu – odstraní profil, cíle, plány, seznamy a vlastní obsah). Podle GDPR máte právo na
          přístup, opravu, výmaz, přenositelnost a podání stížnosti u ÚOOÚ.
        </p>
      </Odsek>
      <Odsek nadpis="Cookies a úložiště">
        <p>
          Používáme jen nezbytné technické úložiště (session pro přihlášení, volba motivu, nedávno
          použité potraviny). Žádné analytické ani marketingové cookies.
        </p>
      </Odsek>
      <p className="text-sm">
        <Link to="/" className="font-medium text-primary hover:underline">← Zpět na OptiMeal</Link>
      </p>
    </Card>
  );
}

export function Podminky() {
  return (
    <Card className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Podmínky použití</h1>
      <p className="text-sm text-muted">Poslední aktualizace: listopad 2026</p>

      <Odsek nadpis="Služba">
        <p>
          OptiMeal pomáhá plánovat jídelníček, mealprep a nákup s aktuálními slevami z českých
          obchodů. Služba je informativní – nenahrazuje radu lékaře ani výživového poradce.
        </p>
      </Odsek>
      <Odsek nadpis="Ceny a slevy">
        <p>
          Ceny a slevy agregujeme z veřejných zdrojů obchodů (letáky, e-shopy, Kupi.cz,
          OpenFoodFacts) a aktualizujeme je průběžně. Zobrazovaná sleva se ukazuje jen tehdy,
          když zdroj přímo zveřejňuje původní cenu nebo oficiální procento slevy – odhadované
          referenční ceny nepoužíváme. Skutečná cena ve vaší konkrétní prodejně se může lišit;
          před nákupem si vždy ověřte cenovku na regálu.
        </p>
      </Odsek>
      <Odsek nadpis="Nutriční údaje">
        <p>
          Výživové hodnoty pocházejí z otevřených databází a údajů výrobců. Hodí se pro
          orientační sledování příjmu, ne pro lékařské účely.
        </p>
      </Odsek>
      <Odsek nadpis="Váš obsah">
        <p>
          Recepty a potraviny, které vytvoříte, zůstávají vaše. Přidáním potraviny do sdíleného
          katalogu souhlasíte s jejím zobrazením i ostatním uživatelům.
        </p>
      </Odsek>
      <Odsek nadpis="Odpovědnost">
        <p>
          Službu poskytujeme „tak jak je", bez záruky dostupnosti ani přesnosti agregovaných dat.
          Za škodu vzniklou spoléháním na zobrazené ceny či nutriční hodnoty neodpovídáme.
        </p>
      </Odsek>
      <p className="text-sm">
        <Link to="/" className="font-medium text-primary hover:underline">← Zpět na OptiMeal</Link>
      </p>
    </Card>
  );
}
