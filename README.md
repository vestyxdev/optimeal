# OptiMeal

**Jezte lépe. Šetřete peníze. Plánujte chytře.**

OptiMeal je webová aplikace pro chytré plánování jídelníčku. Z tělesných
údajů a cíle uživatele spočítá denní nutriční cíle (TDEE, Mifflin–St Jeor),
sestaví jídelníček z reálného katalogu potravin **s ohledem na aktuální
slevy v českých supermarketech** a vytvoří nákupní seznam optimalizovaný
podle ceny. Podporuje diety (vegetariánská, veganská, bezlepková),
alergie (EU-14 alergenů) a vlastní recepty.

Živá ukázka: **https://optimeal-woad.vercel.app**

## Stack

- **Frontend:** React 19 + Vite 8 + TypeScript (strict, `exactOptionalPropertyTypes`)
- **UI:** Tailwind CSS 4 (vlastní design-tokeny, světlý/tmavý motiv), lucide-react, sonner
- **Backend/data:** Supabase – PostgreSQL 15 + Row Level Security + GoTrue Auth + PostgREST
- **State/form:** TanStack Query 5, React Router 7, React Hook Form + Zod
- **Vizualizace:** Recharts (lazy chunk – mimo hlavní bundle)
- **Testy:** Vitest + Testing Library (133 testů)
- **Data pipeline:** Python 3.12 scraper (Open Prices API) v GitHub Actions
- **Hosting:** Vercel (auto-deploy z `main`)

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

Skript postupně pustí **všechny migrace** z `supabase/migrations/` (0001–0009)
a oba seedy (`seed.sql` potraviny + `seed_recepty.sql` recepty). Seedy jsou
idempotentní – skript lze spustit opakovaně; aplikované soubory se sledují
v tabulce `public.om_migrace`.

**Důležité pořadí:** migrace běží před seedy – naplňují-li migrace data,
spustí se nad prázdnými tabulkami. Proto naplnění `alergeny`/`diety`
žije na konci `seed.sql` (až po `INSERT`ech potravin), ne v migraci 0006.

### Přehled schématu

| Tabulka | Účel |
|---|---|
| `profiles` | tělesné údaje, cíl těla, dieta, alergie, rozpočet, počet jídel |
| `nutrition_goals` | denní cíle (kcal + B/S/T); max 1 aktivní (partial unique index) |
| `foods` | globální katalog: makra/100 g, cena/100 g, EAN, alergeny, diety, obrázek |
| `retailers` + `price_observations` | obchody a neměnná historie cenových pozorování |
| `aktualni_ceny` (view) | poslední cena na potravinu – sleva, pokud platí |
| `meal_plans` | uložené plány (`den`/`tyden`/`mealprep`), obsah jako JSONB |
| `shopping_lists` + `shopping_list_items` | nákupní seznamy; položka odkazuje na `foods` nebo je ruční |
| `recipes` + `recipe_ingredients` | globální i uživatelské recepty (gramáž na porci) |
| `om_migrace` | tracking aplikovaných migrací |

Bezpečnost řeší výhradně **RLS politiky** – uživatel čte/píše jen vlastní
záznamy; katalog a globální recepty jsou čitelné i anonymně.

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
| `0009_obrazky_a_ean_v_katalogu.sql` | `foods.obrazek`/`ean` + sloupce do `aktualni_ceny` |
| `0010_chybejici_indexy.sql` | doplňující indexy podle audit |
| `0011_ean_unikatni_index.sql` | unikátní index `foods.ean` |
| `0012_baleni_g.sql` | `foods.baleni_g` – gramáž balení (cena za balení vs. za kg) |
| `0013_sleva_detaily.sql` | `price_observations.puvodni_cena`, view počítá `sleva_procenta` |
| `0014_zakladni_potraviny.sql` | +36 kurátorovaných základních potravin (bez OFF) + opravy nutric/kategorií |
| `0015_dalsi_zaklady.sql` | další základy (játra, tilápie, káva, víno…) dle nespárovaných nabídek |
| `0016_verejne_akce.sql` | RPC `top_akce(int)` – veřejný top-N slev pro landing (úzká projekce, max 24) |
| `0017_preklad_tunaku.sql` | překlad anglických názvů tuňákových produktů (zachován token „(tuna)" pro letákový matcher) |
| `0018_deduplikace.sql` | sloučení duplicitního řeckého jogurtu (remap FK), překlad 3 azbukových názvů |
| `0019_ceske_nazvy.sql` | překlad ~95 cizojazyčných názvů z OFF importů (nápoje, jogurty, omáčky, pomazánky; kvalifikátory kvůli UNIQUE `nazev`) |
| `0020_kategorie.sql` | oprava kategorií starých importů: pečivo z `ovoce_zelenina` → `peckoviny_obily` (150 → 586 položek), suroviny/omáčky/nápoje → `ostatni`; překlep `Chlèb` → `Chléb` |
| `0021_cyrilice_a_obecne_nazvy.sql` | překlad 17 cyrilických + řeckého názvu, obecné názvy doplněné podle EAN (`Chocolate` → `Kinder Chocolate`, `Vanilla` → `Coca-Cola Vanilla`, `12%` → `Zlatý Bažant 12%`), oprava HTML entit, kategorie opravených řádků |

## Funkce

- **Přehled** – dashboard: denní cíl + makro koláč, poslední plán s úsporou,
  aktivní nákupní seznamy, porovnání s týdenním rozpočtem, živá lišta
  „Aktuální akce" (top slevy s expirací „do út 18. 11."). Nepřihlášeným
  ukazuje landing stejné živé akce přes veřejné RPC `top_akce`.
- **Jídelníček** – denní/týdenní plán generovaný podle cílů (TDEE/Mifflin–Katch),
  respektuje `pocet_jidel_denne` z profilu; uložení plánu, vytvoření nákupního
  seznamu jedním klikem, tisk.
- **Recepty** – katalog globálních receptů (zobrazení všem) + vlastní recepty
  přihlášených uživatelů (vytvořit/upravit/smazat, validace, RLS).
- **Potraviny** – katalog (tisíce potravin: seed + kurátorované základy
  + ověřené importy) s aktuálními cenami ze view `aktualni_ceny`,
  fulltext + filtr kategorií + přepínač „Ve slevě" (počet, řazení dle
  % slevy, deep-link `?slevy=1`), miniatury produktů, pásek podílu B/S/T,
  přeškrtnuté původní ceny, expirace akce „do út 18. 11." u slev,
  cena za balení vs. za kg podle `baleni_g`. Vlastní potraviny:
  přidat/upravit/smazat (RLS) včetně gramáže balení, dohledání nutric
  a obrázku v OpenFoodFacts podle názvu (výběr z více kandidátů) nebo
  čárového kódu – ručně i kamerou (`BarcodeDetector`, kde prohlížeč umí).
  EAN se ukládá na potraviny, takže opakované skenování matchuje lokálně.
- **Mealprep** – výběr receptů a porcí → součty, živé ceny a nákupní seznam;
  uložení jako plán typu `mealprep`.
- **Nákup** – uložené seznamy (z plánu i ruční), odškrtávání položek,
  dokončení/smazání, účtová patička „Celkem ≈ N Kč" (jen neodkoupené
  položky se známou cenou; hlásí počet ve slevě i bez ceny).
- **Můj účet** – tělesné údaje → automatický výpočet denních cílů,
  počet jídel denně, týdenní rozpočet, smazání účtu (GDPR).
- **Auth** – registrace, přihlášení, obnovení hesla + nové heslo,
  chráněné routy (`VyzadujePrihlaseni`), odhlášení.

## Jak funguje generátor (sleva → jídelníček)

Čisté funkce v `src/lib/generator/generator.ts`:

1. **Cíle na jídla** – denní cíle se rozdělí podle fixních podílů
   (Snídaně 25 %, Oběd 35 %, Svačina 15 %, Večeře 25 %; pro jiný
   `pocet_jidel_denne` se podíly přepočítají).
2. **Kategorie potravin** – každá potravina spadne podle dominujícího
   makra (kcal z B/S/T) do `bilkovinova` / `sacharidova` / `tukova`.
3. **Skóre výhodnosti** = gramy dominujícího makra za 1 Kč
   (`hodnota / aktualniCena`). Potravina ve slevě dostane bonus **1,25×** –
   generátor tak automaticky upřednostňuje akční zboží, ale jen pokud je
   smysluplně výhodné (ne za každou cenu).
4. **Sestavení jídla** – kotva = bílkovinová potravina (gramáž dle cíle
   bílkovin), pak doplněk sacharidů (preferují se nízkoproteinové zdroje,
   aby se „nepřeflakovaly" bílkoviny) a na závěr tuky, vždy v kalorickém
   stropu jídla a s limitem ostatních maker.
5. **Různorodost** – použité potraviny se v rámci dne neopakují;
   rotace probíhá jen mezi cenově srovnatelnými kandidáty
   (denní plán 85 %, týdenní 60 % skóre nejlepšího). Offset podle
   dne v týdnu → **deterministický**, ale každý den jiný plán.
6. **Filtr profilu** – před výběrem se katalog profiltruje na diety
   (potravina musí vyhovovat všem) a alergeny (nesmí obsahovat žádný).
7. **Výměna jídla** (`vymenJidlo`) – náhrada nesmí použít potraviny
   jiných jídel ani původního jídla → garantovaně jiná kombinace
   při zachování cílů i filtru; jinak vrací `null`.

## Demo účty (prezentace)

Produkce obsahuje 4 nasazené persony s realistickou historií
(skript `scripts/seed_demo.mjs` – plány generuje skutečný algoritmus):

| Účet | Heslo | Persona |
|---|---|---|
| `kaja@demo.optimeal.cz` | `OptiMeal2025!` | kulturista, 3500 kcal, 5 jídel/den |
| `petra@demo.optimeal.cz` | `OptiMeal2025!` | hubnutí, 1750 kcal, 4 jídla |
| `verca@demo.optimeal.cz` | `OptiMeal2025!` | **veganka + alergie na ořechy** (demo filtrů), vlastní recept |
| `tonda@demo.optimeal.cz` | `OptiMeal2025!` | 3 jídla/den, alergie na ryby, 2 nákupní seznamy |

Každý účet má profil s tělesnými údaji, aktivní nutriční cíle,
2–3 uložené plány (denní i týdenní, datované do minulosti) a nákupní
seznamy s částečně odškrtnutými položkami.

## Nasazení (SPA)

- **Produkce:** https://optimeal-woad.vercel.app (Vercel projekt `vertyx1/optimeal`,
  napojený na GitHub – každý push do `main` se automaticky nasadí).
- **Vercel:** `vercel.json` rewrite `/ → /index.html`, security hlavičky
  (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`)
  a immutable cache na `/assets` (v repu).
- **Netlify:** `public/_redirects` SPA fallback (v repu).
- Env proměnné `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` nastavte v panelu
  hostingu – ne v repozitáři.
- **Databáze:** Supabase projekt `gduquvqofcohbjzzsicb` (region eu-west-2);
  migrace `supabase/migrations/0001`–`0009` + seedy aplikovány
  (103 potravin – všechny s EAN, 96 s obrázkem – RLS, RPC `uloz_*`).
  Změny schématu: `node scripts/spust_migrace.mjs "<db-heslo>"`
  (idempotentní, sleduje `public.om_migrace`). Obohacení katalogu:
  `dopln_obrazky.mjs`, `dopln_obrazky_ean.mjs`, `dopln_ean.mjs`.

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

### PriceScraper (slevy z letáků)

Druhý ingest stahuje aktuální **slevové nabídky všech 7 řetězců** (Kaufland,
Lidl, Albert, Billa, Tesco, Penny, Globus) z agregátoru **kupi.cz** a zapisuje
je do `price_observations` (`zdroj = scraper:<řetězec>`).

- **Kód:** `scraper/ceniky.py` (orchestrace), `scraper/retailers/kupi.py`
  (jeden společný parser – `.discount_row` je sourozenec `.product--wrap`,
  kotví se přes `find_previous`), `scraper/retailers/base.py` (session,
  UA rotace, backoff, `PAUZA` 2 s + jitter), `scraper/db.py` (párování
  EAN → přesný název → token-subset → **kmenový token-subset** –
  `cesky_stem` v `normalizace.py` srovnává skloňované tvary,
  „Citrony" ≈ „Citrón" → word-boundary → difflib; čtení potravin
  **stránkuje**, PostgREST jinak vrátí jen 1 000 řádků).
- **Běh:** `.github/workflows/pricescraper.yml` – **matrix, jeden job na
  řetězec** (`fail-fast: false`, `max-parallel: 2`), cron 01:00 a 05:00 UTC
  + ruční dispatch. Každý job má vlastní runner → vlastní egress IP.
- **Stale purge:** `purge_scrapera` maže stará pozorování jen zdrojů, které v
  daném běhu skutečně **stáhly alespoň jednu parsovatelnou stránku**
  (`fetched` = nalezen `.product--wrap`, ne pouhý HTTP 200). 403 ani
  nečitelná odpověď tedy nikdy nesmaže platná data.
- **Dedup:** před insertem se batch zredukuje na nejlevnější nabídku na
  (potravina, řetězec) – unique index `food_id + retailer_id +
  pozorovano_at` by jinak kolidoval.
- **Známé omezení:** kupi.cz občas vrací 403 na GitHub datacentrové IP
  (reputace egress adres, ne podpis requestu – z rezidenční IP odpovídá 200).
  Matrix + dvě cron okna znamenají, že typicky projde 5–7 řetězců na běh;
  `--failed` rerun dostane čerstvé IP. Strukturální fix by vyžadoval
  rezidenční proxy nebo first-party API řetězců.
- **Pozor na Accept-Encoding:** `requests` nedekóduje `br` (brotli) bez
  balíčku `brotli` – hlavička proto říká jen `gzip, deflate`. Přidání `br`
  způsobí nečitelné tělo → 0 nabídek (a bez fetched-gatingu i ztrátu dat).
- **Analýza párování:** `scripts/_harvest_kupi.mjs` (stáhne reálné názvy
  nabídek), `scripts/_analyza_shod.mjs` (replay matcheru proti DB),
  `scripts/import_nesparovanych.mjs` (obohacení katalogu z OpenFoodFacts s
  non-food filtrem a denylistem `ZAKAZANE` – slabé shody dřív importovaly
  nesouvisející produkty, proto je kontrola token-overlapu povinná).

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
