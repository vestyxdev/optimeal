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
npm test           # Vitest (čistá logika + komponentní testy přes jsdom)
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

Skript postupně pustí **všechny migrace** z `supabase/migrations/` (0001–0008)
a oba seedy (`seed.sql` potraviny + `seed_recepty.sql` recepty). Seedy jsou
idempotentní – skript lze spustit opakovaně.

**Důležité pořadí:** migrace běží před seedy – naplňují-li migrace data,
spustí se nad prázdnými tabulkami. Proto naplnění `alergeny`/`diety`
žije na konci `seed.sql` (až po `INSERT`ech potravin), ne v migraci 0006.

Migrace:

| Soubor | Obsah |
|---|---|
| `0001_init.sql` | schéma (profiles, goals, foods, ceny, plány, seznamy, recepty) + RLS + view `aktualni_ceny` |
| `0002_recepty.sql` | tabulky recipes + recipe_ingredients, globální recepty |
| `0003_…` | doplnění (viz soubor) |
| `0004_mealprep_cile_a_uzivatelske_potraviny.sql` | širší limity mealprep cílů, `foods.vytvoril` + RLS pro vlastní potraviny, RPC `delete_own_account()`, index cen |
| `0005_katalog_potravin_view.sql` | `aktualni_ceny` doplní `vytvoril`/`zdroj_potraviny` |
| `0006_alergeny_a_diety.sql` | sloupce `foods.alergeny`/`diety` (jen schéma – data plní `seed.sql`) |
| `0007_katalog_anon_a_rpc_grants.sql` | SELECT na `foods` i pro anonyma (join v receptech), ostražitější granty RPC |
| `0008_atomicke_zapisy.sql` | RPC `uloz_recept`/`uprav_recept`/`uloz_nakupni_seznam`/`uloz_cile` – vícekrokové zápisy atomicky v transakci (SECURITY INVOKER, RLS platí) |

## Funkce

- **Přehled** – dashboard: denní cíl + makro koláč, poslední plán s úsporou,
  aktivní nákupní seznamy, porovnání s týdenním rozpočtem.
- **Jídelníček** – denní/týdenní plán generovaný podle cílů (TDEE/Mifflin–Katch),
  respektuje `pocet_jidel_denne` z profilu; uložení plánu, vytvoření nákupního
  seznamu jedním klikem, tisk.
- **Recepty** – katalog globálních receptů (zobrazení všem) + vlastní recepty
  přihlášených uživatelů (vytvořit/upravit/smazat, validace, RLS).
- **Potraviny** – katalog (100+ potravin v seedu) s aktuálními cenami
  ze view `aktualni_ceny`, fulltext + filtr kategorií, miniatury produktů,
  páskem podílu B/S/T. Vlastní potraviny: přidat/upravit/smazat
  (RLS), dohledání nutric a obrázku v OpenFoodFacts podle názvu
  (výběr z více kandidátů) nebo čárového kódu – ručně i kamerou
  (`BarcodeDetector`, kde prohlížeč umí). EAN se ukládá na potraviny,
  takže opakované skenování matchuje lokálně.
- **Mealprep** – výběr receptů a porcí → součty, živé ceny a nákupní seznam;
  uložení jako plán typu `mealprep`.
- **Nákup** – uložené seznamy (z plánu i ruční), odškrtávání položek,
  dokončení/smazání.
- **Můj účet** – tělesné údaje → automatický výpočet denních cílů,
  počet jídel denně, týdenní rozpočet, smazání účtu (GDPR).
- **Auth** – registrace, přihlášení, obnovení hesla + nové heslo,
  chráněné routy (`VyzadujePrihlaseni`), odhlášení.

## Nasazení (SPA)

- **Produkce:** https://optimeal-woad.vercel.app (Vercel projekt `vertyx1/optimeal`,
  napojený na GitHub – každý push do `main` se automaticky nasadí).
- **Vercel:** `vercel.json` rewrite `/ → /index.html` (v repu).
- **Netlify:** `public/_redirects` SPA fallback (v repu).
- Env proměnné `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` nastavte v panelu
  hostingu – ne v repozitáři.
- **Databáze:** Supabase projekt `gduquvqofcohbjzzsicb` (region eu-west-2);
  migrace `supabase/migrations/0001`–`0009` + `seed.sql` aplikovány
  (103 potravin, RLS, RPC `uloz_*`). Změny schématu:
  `node scripts/spust_migrace.mjs "<db-heslo>"`.

## Scraper cen (ingest)

Ceny se doplňují z **Open Prices** (openfoodfacts.org) – veřejné API
s uživateli nahrávanými doklady cen, filtrované na ČR.

- **Kód:** `scraper/` (`open_prices.py` stahování, `normalizace.py` přepočty
  na Kč/100 g, `db.py` zápis přes PostgREST, `main.py` orchestrace).
- **Běh:** GitHub Actions workflow `Ingest cen` (`.github/workflows/ceny.yml`),
  denně ~5:23 CET + ruční `workflow_dispatch`.
- **Secrets v repozitáři:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (service-role klíč žije jen v Actions, nikdy ne v kódu ani frontendu).
- **Odolnost:** stránky API se zkouší 3× s exponenciálním backoffem; vadná
  stránka se přeskočí, ne shodí celý běh. Duplicity řeší DB unique constraint
  (potravina + obchod + datum) – opakovaný běh je bezpečný.
- **Lokálně:** `pip install -r scraper/requirements.txt && python -m scraper`
  (vyžaduje `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` v prostředí).

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
