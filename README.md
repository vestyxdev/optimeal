# OptiMeal

**Jezte lépe. Šetřete peníze. Plánujte chytře.**

Osobní jídelníček podle vašich cílů, mealprep na více dní a nákupní
seznam s aktuálními slevami z českých obchodů – v jedné aplikaci.

## Stack

- **Frontend:** React 19 + Vite + TypeScript (strict) + Tailwind CSS v4
- **Backend/data:** Supabase (PostgreSQL + Auth + RLS)
- **State/form:** TanStack Query 5, React Router 7, React Hook Form + Zod
- **Vizualizace:** Recharts (lazy chunk)
- **Testy:** Vitest
- **Data ingestion:** Python scraper (letáky/ceny) běžící přes GitHub Actions

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (čistá logika: výživa, generátor, mealprep)
npm run build      # produkční build (tsc + vite)
```

### Konfigurace

Aplikace potřebuje soubor `.env` ve kořenu projektu (viz `.env.vzor`):

```
VITE_SUPABASE_URL=https://VASE-ID.supabase.co
VITE_SUPABASE_ANON_KEY=VASE-ANON-KLIC
```

Bez nich se spustí **setup gate** (přesný návod), ne demo verze.
Do frontendu patří **pouze anon klíč** – service-role klíč sem nikdy nepište.

### Databáze

Jedním příkazem přes pooler (heslo se předává argumentem, neukládá se):

```bash
node scripts/spust_migrace.mjs "<heslo-k-databazi>"
```

Skript postupně pustí **všechny migrace** z `supabase/migrations/` (0001–0005)
a oba seedy (`seed.sql` potraviny + `seed_recepty.sql` recepty). Seedy jsou
idempotentní – skript lze spustit opakovaně.

Migrace:

| Soubor | Obsah |
|---|---|
| `0001_init.sql` | schéma (profiles, goals, foods, ceny, plány, seznamy, recepty) + RLS + view `aktualni_ceny` |
| `0002_recepty.sql` | tabulky recipes + recipe_ingredients, globální recepty |
| `0003_…` | doplnění (viz soubor) |
| `0004_mealprep_cile_a_uzivatelske_potraviny.sql` | širší limity mealprep cílů, `foods.vytvoril` + RLS pro vlastní potraviny, RPC `delete_own_account()`, index cen |
| `0005_katalog_potravin_view.sql` | `aktualni_ceny` doplní `vytvoril`/`zdroj_potraviny` |

## Funkce

- **Přehled** – dashboard: denní cíl + makro koláč, poslední plán s úsporou,
  aktivní nákupní seznamy, porovnání s týdenním rozpočtem.
- **Jídelníček** – denní/týdenní plán generovaný podle cílů (TDEE/Mifflin–Katch),
  respektuje `pocet_jidel_denne` z profilu; uložení plánu, vytvoření nákupního
  seznamu jedním klikem, tisk.
- **Recepty** – katalog globálních receptů (zobrazení všem) + vlastní recepty
  přihlášených uživatelů (vytvořit/upravit/smazat, validace, RLS).
- **Potraviny** – katalog s aktuálními cenami ze view `aktualni_ceny`,
  fulltext filtrace, přidání vlastní potraviny + dohledání hodnot
  v OpenFoodFacts.
- **Mealprep** – výběr receptů a porcí → součty, živé ceny a nákupní seznam;
  uložení jako plán typu `mealprep`.
- **Nákup** – uložené seznamy (z plánu i ruční), odškrtávání položek,
  dokončení/smazání.
- **Můj účet** – tělesné údaje → automatický výpočet denních cílů,
  počet jídel denně, týdenní rozpočet, smazání účtu (GDPR).
- **Auth** – registrace, přihlášení, obnovení hesla + nové heslo,
  chráněné routy (`VyzadujePrihlaseni`), odhlášení.

## Nasazení (SPA)

- **Vercel:** `vercel.json` rewrite `/ → /index.html` (v repu).
- **Netlify:** `public/_redirects` SPA fallback (v repu).
- Env proměnné `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` nastavte v panelu
  hostingu – ne v repozitáři.

## Architektura

- `src/lib/vyziva/` – čistá výpočetní logika (TDEE, makra, panel shody).
- `src/lib/generator/` – plánovač jídel (skóre potravin + bonus slev).
- `src/lib/mealprep/` – konsolidace ingrediencí napříč recepty.
- `src/lib/data/` – přístup k Supabase (profil, cíle, plány, recepty,
  nákupní seznamy, katalog potravin).
- `src/routes/` – stránky; `src/components/` – shell + UI primitiva.
- Bezpečnost: RLS politiky jsou jediný autoritativní boundary –
  uživatelé vidí/píšou jen vlastní záznamy; globální recepty a katalog
  potravin jsou čitelné všem.

Detailní audit a roadmap: viz `AUDIT.md`.
