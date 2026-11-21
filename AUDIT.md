# OptiMeal – Technical Audit & Assessment

> **Historický snapshot** – audit stavu před implementačními fázemi. Body v sekcích
> 3–4 (chybějící funkce, kritické bugy) jsou od auditního commitu postupně
> implementovány a opraveny; aktuální stav viz README a git log. Ponecháno jako
> podklad, ne jako přehled aktuálního stavu.

Date: 2026-11-14 · Codebase: `main` @ `e147d56` (phases 1–6a)


## Prezentace a demo data (obhajoba)

- **seed_demo.mjs**: 4 persony (kulturista 3500 kcal / hubnutí 1750 kcal / veganka+ořechy / táta s rybí alergií) s profilem, cíli, 2–3 plány datované do minulosti a nákupními seznamy. Plány generuje skutečný generátor nad produkčním katalogem; uživatele zakládá přímo v auth.users (bcrypt přes pgcrypto) – signUp obchází kvůli SMTP rate-limitu. Idempotentní.
- **over_demo.mjs**: E2E sanity check na produkci – přihlášení přes GoTrue, katalog, generace, uložení plánu, RPC nákupní seznam, zpětné čtení přes RLS, úklid. 10/10 kroků pro ověřené persony (i veganskou s filtry).
- Přihlašovací údaje k demo účtům jsou v README (sekce Demo účty).
## 1. Current architecture

**Frontend (SPA, no app server)**
- React 19 + Vite 8 + TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- Tailwind CSS v4 via `@tailwindcss/vite`; custom design-token system in `src/index.css` (light/dark via `.dark` class, no-flash inline script in `index.html`)
- React Router 7 (client-side routes), TanStack Query 5 (server state), sonner toasts, lucide icons
- Data layer: `src/lib/data/*` (Supabase queries) — clean separation from pure logic in `src/lib/{generator,mealprep,vyziva}`

**Backend**
- Supabase only: Postgres + Auth + Row Level Security. No custom API server or Edge Functions; all DB access goes through PostgREST from the browser, authorized entirely by RLS.
- `aktualni_ceny` view resolves the latest valid price observation per food (sale-aware), security-definer semantics.
- Migrations in `supabase/migrations/0001–0003`, seeds `seed.sql` (22 foods, 6 retailers, prices, demo sales) and `seed_recepty.sql` (9 recipes).
- Admin scripts: `scripts/spust_migrace.mjs` (pg via pooler), `scripts/supabase_api.mjs` (Management API). Target project ref hardcoded default `anzyjytdpvcmznmnmppe`.

**Verified**: `npm install` clean (0 vulns), `npm test` 31/31 pass, `npm run build` (tsc + vite) passes. No `.env` locally → app shows SetupGate.

## 2. Existing functionality

| Area | State |
|---|---|
| Setup gate | Working — exact instructions when env vars missing |
| Auth | Email/password login, registration, logout; session persistence; Czech error mapping |
| Profile (`/ucet`) | Body stats → TDEE goals (Mifflin-St Jeor; Katch-McArdle when body-fat % given); exact calorie↔macro balance; saves profile + active goal |
| Jídelníček | Day/week generator; discount-aware scoring; deterministic rotation; save plan (JSONB); saved-plan list + detail; print |
| Recepty | Recipe catalog + detail; nutrition & price computed live from `aktualni_ceny` |
| Mealprep | Per-recipe portions → consolidated shopping list, totals, savings; save as plan or list |
| Nákup | List/detail of saved lists, check-off, manual items, delete, done flag, print |
| Theme | light/dark/system, persisted |
| Tests | 31 unit tests (goals, generator, mealprep) — all pure logic |

## 3. Missing functionality

- **Password reset** (no `resetPasswordForEmail` / `updateUser` flow)
- **Route guards** — protected pages render for anonymous users and fail inconsistently
- **Recipe CRUD UI** — `ulozRecept`/`smazRecept` + RLS policies exist, no UI to create/delete own recipes
- **Shopping-list save from Jídelníček** — generated day/week plan shows a shopping list but only a *plan* can be saved; `Nákup` copy incorrectly claims otherwise
- **Dashboard** — `/` (`Prehled`) is static marketing text, no live data
- **Food catalog page / custom foods** — users cannot see or extend the food catalog
- **Price ingestion** — README promises a scraper via GitHub Actions; no such code exists. Seeded "sales" expire 14 days after seeding.
- **Profile fields unused by generator**: `pocet_jidel_denne`, `dieta`, `alergie`, `tydenny_rozpocet_kc` (budget collected but never compared)
- **Account deletion** (no DELETE policy on `profiles`, no UI)
- **Unused deps**: `recharts`, `zod`, `react-hook-form`, `@hookform/resolvers` installed but never imported
- **Deployment**: no SPA-fallback config (vercel/netlify), `.env.vzor` referenced in `.gitignore` but absent
- Mobile bottom nav: Recepty/Mealprep/Nákup unreachable on mobile

## 4. Critical bugs

1. **Weekly shopping list contains only the last day.** In `vygenerujTydenniPlan`, merged-meal keys are `${den}-…` where `den` is a `DenVysledek` **object** → every key is `"[object Object]-Snídaně"`, so each day's meal overwrites the previous one. Only day 7's foods reach `plan.nakup`.
2. **Mealprep plans often cannot be saved.** `meal_plans` CHECK constraints assume daily targets (`cil_kalorie 800–5000`, `bilkoviny 20–400`, …); mealprep *totals* (e.g. 8 portions ≈ 8 000 kcal) violate them → insert error. Needs a migration relaxing constraints for `typ='mealprep'`.
3. **Shopping-list checkbox never updates.** `mutaceKoupeno` in `Nakup.tsx` has no invalidation/optimistic update; `checked` is bound to stale query data → UI reverts after click.
4. **Wildcard route renders `Prehled` without `Layout`** (no nav/shell on unknown URLs).
5. **Mobile dead ends** — bottom nav lists only 3 of 6 sections; Recepty, Mealprep, Nákup unreachable on phones.

## 5. Security assessment

**Good**: only anon key in client (SetupGate even warns against service key); RLS enabled on every table with least-privilege policies; user data scoped by `auth.uid()`; no secrets in repo; React escaping prevents XSS; unique/partial indexes enforce invariants.

**Issues**
- `spust_migrace.mjs` uses `ssl: { rejectUnauthorized: false }` — TLS verification disabled (MITM-able admin channel). Fix: remove flag / supply CA.
- `recipes`/`recipe_ingredients` SELECT policies and `aktualni_ceny` view expose catalog to anonymous users — acceptable if catalog is meant public; documented, not a leak of user data.
- `profiles` has no DELETE policy → GDPR account deletion impossible.
- `foods` has no user-insert path → blocks legitimate user foods; any future insert policy must restrict `zdroj`/`vytvoril` columns.
- No rate limiting/abuse controls on user writes beyond DB constraints (acceptable at this scale; note for roadmap).

## 6. Database assessment

Well designed: normalized catalog, append-only `price_observations` history, sale resolution in one view, profile auto-creation trigger, single-active-goal trigger + partial unique index, FK cascades, numeric checks.

Gaps: `meal_plans` CHECKs sized for daily plans only (bug #2); `shopping_lists.plan_id` and `shopping_list_items.food_id` columns exist but are never written; `profiles.dieta/alergie/pocet_jidel_denne` never read; no index on `price_observations(retailer_id)`; no `updated_at` maintenance for `shopping_lists`; seed sales decay after 14 days.

## 7. Recommended improvements

- Type-safe generated DB types (`supabase gen types`) to replace hand-maintained row interfaces
- Transactions for multi-write ops (save list + items, recipe + ingredients) via RPC, or accept current two-step writes (partial-failure leaves header without items)
- SPA fallback config + CI (lint/build/test on push)
- Code-split recharts or drop unused deps
- Edge Function / cron for price ingestion (Supabase scheduler + pg_cron or GitHub Action)
- Real 404 page, error boundary, print stylesheet
- `pocet_jidel_denne` honored by generator; budget comparison in weekly view

## 8. Prioritized roadmap

**P0 – correctness (immediately)**
1. Fix weekly-plan shopping-list merge bug + regression test
2. Migration `0004`: relax `meal_plans` checks for `mealprep`; add `foods.vytvoril` + user insert/delete policies; add `profiles` DELETE policy
3. Fix koupeno checkbox invalidation; wildcard route → redirect; mobile nav completeness; Nákup copy

**P1 – auth & core flows**
4. Route guards with redirect-back; password reset (request + update pages); registration-confirmation handling
5. Save shopping list from generated day/week plans (write `food_id`, `plan_id`)
6. Recipe create/delete UI (react-hook-form + zod — deps already present)

**P2 – product features**
7. Real dashboard (goals, last plan, active lists, savings)
8. `pocet_jidel_denne` honored in generator + profile UI; weekly budget comparison
9. Food catalog page + custom foods (Open Food Facts lookup)

**P3 – platform**
10. Price ingestion pipeline (Edge Function + schedule or external scraper)
11. Account deletion; generated DB types; CI; deployment config


---

## 9. Implementation status (2026-11-14, faze 7-18)

All P0-P3 items above are now implemented and verified live against the production Supabase project.

**P0 done:** weekly-plan shopping merge fix (+regression test), migration 0004 (mealprep checks, foods.vytvoril, profiles DELETE, delete_own_account RPC), checkbox invalidation, wildcard redirect, Nákup copy.

**P1 done:** route guards with redirect-back, password reset flow (request + update), recipe CRUD UI (RHF+zod), shopping lists saved from generated plans with food_id/plan_id.

**P2 done:** real dashboard on Přehled (goals, macro chart, last plan, savings, active lists), pocet_jidel_denne honored by generator + profile UI, food catalog + custom foods with OFF lookup, weekly budget comparison.

**P3 done:** deploy configs (vercel.json, _redirects), print stylesheet, account deletion via RPC, GitHub Actions price ingestion (Open Prices API, daily cron + manual dispatch, verified run).

**Additional work beyond the audit:**
- Migration 0005-0007: catalog view ownership columns, alergeny/diety schema, anon catalog reads (recipe ingredient joins) + tighter RPC grants.
- Seed-ordering fix: migration 0006 UPDATEs moved into seed.sql tail (migrations run before seeds); live DB patched via PostgREST.
- Generator quality: anchor no longer repeats when protein category exhausted; gram amounts capped by fat/carb budgets only for macro-significant foods (>=3 g/100 g) — fatty anchors no longer blow the fat budget, and lean carb fillers aren't starved by a spent fat budget.
- UX/design-system pass: PotvrdDialog replaces window.confirm everywhere; Select/Skeleton primitives; lucide icons replace emoji; aria-labels, keyboard-accessible cards, table overflow wrappers; skeleton loaders on all data routes.
- Mobile nav: Více bottom-sheet exposes Potraviny/Mealprep/Účet/Nastavení + theme toggle + logout (previously unreachable on mobile).
- Performance: vendor code-splitting (react/supabase/query/router/forms) — index chunk 610 kB -> 112 kB; Recharts already lazy.
- Accessibility: focus-visible outline, prefers-reduced-motion honored globally; native <dialog> gives focus trap + Escape.
- Scraper resilience: Open Prices pages retried 3x with exponential backoff; a dead page is skipped instead of aborting the ingest; dedupe via unique (food_id, retailer_id, pozorovano_at) + ignore-duplicates.
- Tests: 42 -> 63 (macro-cap regressions, pure plan helpers usporaPlanu/cenaPlanu).
- Tests: 63 -> 80 (Dialog + route-guard component tests, spocitejRecept/alergenyReceptu recipe math).
- Data-layer integrity: compensating actions for every multi-step write (shopping list, recipe create/update, nutrition goals) — snapshot+restore on update, parent delete on child-insert failure. Note: true atomicity needs a Postgres RPC transaction.
- Bugs found in the deep review: spocitejRecept dominant category depended on price availability; OFF lookup treated kJ energy_100g as kcal (~4.2x overestimate); ulozCile could leave zero active goals. All fixed with tests.
- Atomicity: migration 0008 adds SECURITY INVOKER RPCs (uloz_recept/uprav_recept/uloz_nakupni_seznam/uloz_cile) running multi-step writes in one transaction. Frontend calls RPC first, falls back to compensated PostgREST on PGRST202 (verified live: test user recipe insert/ingredient/cascade-delete works under RLS).
- Mealprep: ingredients without a current price now stay on the shopping list (cenaZa100g null, UI dash) instead of silently disappearing. NakupniPolozka.cenaZa100g widened to nullable, matching the DB column.
- A11y: Vice sheet traps Tab focus inside, restores focus to the trigger on close, aria-haspopup. Jidelnicek save buttons lock after success (no duplicate plans/lists).
- Czech declension: shared sklonuj util — "2 porce / 3 recepty / zbývají 2 položky" fixed across Nakup, Mealprep, PlanyDetail, ReceptDetail, Potraviny.
- Validation hardening: numeric inputs no longer collapse blank→0 (Jidelnicek goals, Potraviny form, Ucet body stats); negatives rejected; TDEE inputs bounded to sane ranges (weight 20–400 kg etc.); profile save works without complete body data; ulozProfil can clear fields (null = delete).
- Auth integrity: React Query cache cleared on sign-out/account switch (cross-user data leak closed); role=alert on all auth form errors.
- Consistency: unpriced foods emit cenaZa100g null everywhere (generator + mealprep now agree — UI shows "—" not "0.00 Kč"); savings (usetreno) computed only when the actual price is known.
- Production polish: per-route document.title, robots.txt (private routes disallowed), site.webmanifest, theme-color, og meta, noscript, real 3-way theme selector in Nastaveni ("system" was unreachable in UI), skip-to-content link, SetupGate migration instructions corrected to all files.
- UX: optimistic shopping-list checkoffs (instant toggle, rollback on error); recipe filter pills get aria-pressed; Mealprep portion steppers announce the recipe name; mobile ingredient rows wrap to two lines; retry buttons on data-load error cards.
- Tests: 80 -> 105 (rpcChybi, sklonuj, titulek mapping, OFF parser kJ->kcal regression, sestavNakupniSeznam merge/savings math, Vice sheet focus behavior, scraper exchange-rate parsing).
- Barcode scanning: EAN/UPC lookup via OFF Product API (nactiOffPodleEan + normalizujEan validation), camera scanning through native BarcodeDetector (zero deps) with graceful manual fallback on Firefox/Safari; EAN persisted on foods.ean and local catalog checked before OFF (repeat scans are instant).
- Food catalog UX: OFF name search now offers a candidate picker (up to 8 results with kcal/B/S/T) instead of blindly applying the first; full CRUD on user foods (edit form reuses add form, prefills incl. stored EAN); macro energy-share bars and category icons in the table; product thumbnails from OFF.
- Migration 0009: foods.obrazek column + ean/obrazek in aktualni_ceny view; writes degrade gracefully pre-migration (PGRST retry without the column).
- Catalog data: seed-v2 adds 82 Czech staples (104 foods total) across all categories with baseline prices and full allergen/diet metadata.
- Tests: 105 -> 110 (EAN normalization, multi-candidate OFF parse, image parsing).


## Fáze 56–75 – katalog, čárové kódy, obrázky, výměna jídel

- **Čárové kódy**: normalizace EAN-8/12/13/14, OFF Product API v2, nativní BarcodeDetector (bez závislostí, fallback na ruční zadání), lokální lookup před OFF; ean persistován na foods a vystaven v aktualni_ceny (migrace 0009).
- **Katalog**: 22 → 101 seed potravin (alergeny/diety/ceny), kontrola integrity (žádné duplicity, neplatné kategorie ani anomálie kcal). Filtr hledá i v EAN (číselný dotaz = naskenovaný kód).
- **OFF vyhledávání**: výběr z až 8 kandidátů místo slepého prvního výsledku; parsujOffProduktyVice + kJ→kcal regrese pokrytá testy.
- **CRUD vlastních potravin**: editace přes existující RLS politiku (UI dosud chybělo), vč. uloženého EAN.
- **Obrázky**: foods.obrazek (migrace 0009), OFF thumbnaily v pickeru, katalogu, jídlech i nákupních seznamech; JSONB plány si je nesou dál. Graceful degradation před deployem 0009.
- **Scraper**: při shodě jménem doplní foods.ean z Open Prices → příští match EAN-first, katalog se sám obohacuje.
- **Výměna jídla**: vymenJidlo/vymenJidloVTydnu – náhrada nepoužívá potraviny ostatních jídel ani vyměňovaného (garance změny), respektuje cíle i dietní/alergenový filtr, přepočítá denní/týdenní součty i nákup.
- **Týdenní plán UI**: rozpis dnů – rozbalovací sekce se sdílenou MrizkaJidel (dříve jen holá tabulka součtů, jídla nešla vidět).
- **Responzivita/tisk**: mobilní karty katalogu místo scrollovací tabulky; miniatury se netisknou.


## Nasazení a provoz (produkce)

- **Vercel** produkce optimeal-woad.vercel.app, auto-deploy z main, SPA rewrite, env v panelu.
- **Security hlavičky**: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (camera=self kvůli BarcodeDetector), immutable cache na /assets.
- **Supabase**: projekt gduquvqofcohbjzzsicb (eu-west-2). Migrace 0001–0009 + seedy aplikovány (103 potravin, recepty, 21 slev).
- **spust_migrace.mjs** je nově idempotentní: tracking public.om_migrace, transakce per soubor, přeskočení již aplikovaných; toleruje objekty vytvořené mimo tracking.
- **0004** opraven na drop constraint if exists (znovuspustitelné).
- **dopln_obrazky.mjs**: backfill foods.obrazek z OpenFoodFacts (world → cz doména), slušný rate-limit.


## Fáze 76+ – solver, alergeny, metadata katalogu

- **7denní audit** (`over_jidelnicek.mjs --tyden`): matice 2200/1600/3000 kcal + vegetariánský + alergenové filtry – všech 7 dnů ±3 % kcal / ±5 % B,S,T. `--export/--katalog` = snapshot audit bez DB (CI).
- **Solver**: doskaluj gated na out-of-tolerance (konec whipsaw přes hranici), item-krok ≤2× rezidua; kcal-overshoot nově uberDoSpodku – floor-respecting trim tuky→sacharidy mířící na cíl (ne strop); kotva ≤70 % kcal talíře; MIN_B_KOTVA 4 g B/100 g; jerky profil 30–60 g; tuk-fillery bez přísad; veg-side ≤150 kcal/100 g.
- **Alergenová síť**: jen ~28 % katalogu mělo tagy → ALERGEN_Z_NAZVU (EU-14 jmenné regexy) + obsahujeAlergen (tag NEBO název) ve filtrujPotraviny – pokrývá generátor i výměny. Výjimky ALERGEN_VYRAZ_VYNECH («bez X» deklarace) a ALERGEN_FRAZE_VYNECH (rostlinná «másla», ryzlink vlašský, humus=půda).
- **dopln_tagy.mjs**: jmenný backfill alergenů/diet – aditivní, transakce, dry-run review; 3 616 řádek. Vegetariánský pool ~2 867 → ~5 766, repetice rodin zmizela. Vegansky jen jednoznačné celorostlinné názvy; bezlepkovy se jménem NEdoplnuje (nebezpečný false-positive).
- **dopln_tagy_off.mjs**: OFF-API backfill podle EAN (allergens+traces+analysis+labels → vč. en:gluten-free → bezlepkovy). Aditivní, 1 dotaz/s, checkpointy po 50 iteracích, síťové chyby se nezapisují do hotovo (retry příště), bail-out po 15 chybách za sebou. ingest_off.mjs nově čte i traces_tags («může obsahovat» = vyloučit).
- **Bezlepková dieta = vyloučení lepku**, ne pool ~70 certifikovaných GF položek: filtrujPotraviny mapuje dieta→alergen; celiakův týden 70 → 8 073 položek, ~300 → ~85 Kč/den, audit čistý.
- Testy: 354 → 355+ (MIN_B_KOTVA, kusovaGramaz spreads/blossom, seitan mix, junk, jerky, rodinový malus, phantom-kcal malus, veg cap, kotva cap, alergenová síť výjimky, bezlepková semantika).

- **Vegan fáze 77** – veganský týden měl 3 flagy: den 5 na +8,7 % kcal (Lunter Wok&Bowl: 220 kcal uvedeno, 88 z maker = 60 % fantom → ~317 kcal mimo solver) a kotvové rodiny 7×/6× za týden.
  - **Fantómové kcal = tvrdý zákaz**: `zakazane` ve všech poolů (kotva, příloha, tuk, zelenina, doplňky) nově zahrnuje `lisiSeKalorie` (deklarované kcal vs odhad z maker >35 % → vadná data). Dosud jen měkký malus 0,5 – pod tlakem rotace položka stejně vyhrála. ~188 položek katalogu (převážně vína/drinks/přípravky s evidentně rozbitými daty).
  - **Týdenní rodina = tvrdý cap 3×**: `vyberKandidata` vylučuje rodiny s ≥3 použitími z minulých dnů, dokud existuje alternativa. Mechanismus chyby: penalizovaná položka padla pod práh srovnatelnosti → prázdný pool → fallback vrátil plný seznam bez maluse → jediná «vhodná» položka (proteinové plátky jako snídaňová kotva) vyhrála znovu. Audit: proteinove platky 7→3, vegan jerky 6→3.
  - **Dietní veto z názvu**: `nazevVylucujeDietu` – crowdsourcované dietní tagy lžou (Cottage Cheese Pažitka = vegansky+vegetariansky, Pork ham meat = vegansky). Živočišný název přehlasuje tag, rostlinná deklarace/báze veto ruší (ovesné mléko, alternativa kefíru, tofu paštika, bezvaječné těstoviny, Not milk, Beyond, soya sausages…). Veganský pool 3732→3682, korektní.
  - **Jmenná síť mléka**: +cottage|cheese|quark|curd|halloumi|paneer; oprava falešné shody `s[ýy]r`→`s[ýy]r(?!up)` (rice/javorový sirup už není «sýr»).
  - **DB korekce tagů**: vegansky odebrán 15 řádkům (cottage, pork, tuňák, kuřecí, crackling, medové arašídy, mochi ice cream…), vegetariansky 7 řádkům (maso/ryba), alergen mleko doplněn 14 řádkům (cottage, sour cream, mochi zmrzlina). Runtime veto zůstává jako trvalá pojistka pro budoucí chybná OFF data.
  - **Import TS pro nativní Node**: `generator.ts` nově importuje `lisiSeKalorie` z `../vyziva/hodnota.ts` – audit skript běží pod nativním TS (Node 24), musí mít explicitní příponu (allowImportingTsExtensions už v tsconfig).
  - Audity čisté: vegansky (3682 pool), vegetariansky (5743), bezlepkovy (8014), standard – všech 7 dnů v toleranci, rodiny ≤3×.
- Testy: 362 (regrese: týdenní cap rodin, fantom-kotva, dietní veto, syrup-vs-sýr, filtr rostlinné mléko vs cottage).

## 2026-11-20 – kvalita dat + doladění dietního veta

- Nový skript scripts/kvalita_dat.mjs: report fantomových kalorií u jídel
  (173 řádek, generátor je z plánů vylučuje do opravy zdrojových dat),
  dietních tagů v rozporu s názvem a chybějících tagů mleko. --csv pro export.
- Dietní veto opraveno proti falešným shodám: kruton≠krůt, graham≠ham,
  Goldfish/Flying Goose/Hamé/Chleberia jsou značky, doplněno „kuře"
  (podst. jm., ne jen „kuřecí") a „mléčný" (příd. jm., ne jen „mlék-"),
  rostlinná báze snese 1 slovo mezery (bramborové barista mléko),
  „X příchuť"/„flavour" deklaruje ochucovadlo, ne surovinu.
- Alergenní jmenná síť: deklarované vegan/rostlinný ruší živočišné
  alergeny (mléko/vejce/ryby/korýši/vodnáče) – „Vegan cheese dip"
  už nevaruje mléko-alergiky; „bezmléčný" doplněn vedle „bez mléka".
- DB: 16× odebrán vegansky, 7× vegetariansky (chorizo/prosciutto/kuře/
  mléčné dezerty/fish-sůl), 17× doplněn alergen mleko (sýry, cheesecake,
  quark, curd) – ambiguální příchutě (Onion&Cheese, VegeCheese) ponechány.
- Verifikace: tsc čistý, 364/364 testů (+regresní blok vet falešných shod),
  audit matrix vegansky/vegetariansky/bezlepkovy/standard/mleko+lepek –
  všude „Bez problémů ✔", rodiny ≤3×, den 5 vegan 2201 kcal.


## Kolo – druhové rodiny kotev + katalog browse + OFF EAN (commity 49620ec, 1480ccd, b83ad17, 9c3c1e8, db7881b)

- **rodinaKotvy()**: druhová rodina zdroje bílkoviny (veprove/hovezi/drubez/ryba/vodnany/vejce/jehneci/susene_maso/tofu/tempeh/seitan/tvaroh/syr/jogurt). „Vepřová plec" a „Vepřová kýta" mají jiný dvouslovný klíč, ale stejnou rodinu → oběd+večeře už nejsou 2× vepřové v jednom dni (audit over_plan: dříve plec+kýta).
- Rodinné klíče sdílí `pouziteKlice`/`minuleDny` s klicPodobnosti: denní deduplikace (bezRodiny) i týdenní cap (rodina max 4×, dvouslovný klíč max 3×) fungují pro druhy i generické sušené maso (Sušené maso Original vs Prémiové sušené maso). Malus minuleKolikrat počítá max(klíč, rodina−1).
- Mléčné rodiny: tvaroh kotvil snídani ~6×/týden → vlastní rodiny tvaroh/syr/jogurt s capem 4 (tvaroh ~3×).
- **Solver 4→6 kol**: po seškrtání fantómových kcal chyběla kola na doplnění sacharidů (den 6: −5,2 % kcal, −6,2 % S) → konverguje.
- **Katalog browse**: jeNepotravinovy se nezobrazuje v procházení (kosmetika z drogistických feedů); při hledání se najde. Regex `plet` → `plet(?!ýn)` (pletýnka ≠ pleťový krém).
- **OFF dohledání u uživatelského EAN** (db7881b): nacita allergens/traces/analysis/labels → alergeny+diety se ukládají jen když OFF data má; prázdné pole nemaže existující tagy.
- **DB korekce**: vegansky odebrán 8 řádkům (wafer/nougat/pasta kari/chorizo/tuňáková/onion&cheese), mleko přidán 3 (onion&cheese, lemon cheesecake, VGTeam VegeCheese).
- Kvalita dat (scripts/kvalita_dat.mjs): dietní kontradikce 56→5 (zbylé nejednoznačné – veto řeší), chybějící mleko 21→0.
- Gitignore: dopln_tagy_off.log odtrackován.

Ověřeno: tsc clean · 368/368 testů (+2 regrese rodiny) · audit matice (standard/vegan/vegetarian/mleko+lepek/1600/3000) – všude „Bez problémů".

## Kolo: slevy všude + EAN skener na všech prohlížečích (21. 11. 2026)

- **Nákupní seznam – slevy** (4192b72): položky ve slevě ukazují přeškrtnutou původní cenu za celá balení, badge SLEVA −X %, "ušetříte X Kč" u položky i v součtu. puvodniCena se zobrazuje jen se zdrojovým ověřením (leták/eshop/kupi), > aktuální, ≤4×.
- **Porovnání obchodů – úspora** (0f05cf6): HladinaObchodu.usetreno – sčítá ověřené úspory; karta "Kde nakoupit nejlevněji" ukazuje "slevy −X Kč" u každého obchodu.
- **KartaNakupu render testy** (ee5bef6): banner úspory jen s ověřenou původní cenou; flag sleva bez ceny nevymyslí úsporu.
- **EAN skener – ZXing fallback** (03cbd67): nativní BarcodeDetector kde je; jinde se lazy dotáhne @zxing/browser (vlastní chunk 411 kB → jen pro Firefox/Safari, Chrome ho nestáhne). podporujeSkenovaniKodu() nyní testuje getUserMedia, takže tlačítko Skenovat se ukáže i na iPhonu.
- **Audit obrázků** (audit_obrazky.mjs): 71 ověřených proti OFF, 0 špatných, 3337 neověřitelných (URL bez OFF kódu) – kolize typu Brambory↔Chléb vyřešeny.
- **Obrazky přes EAN** (dopln_obrazky_ean.mjs): doběhl, 1/197 – OFF prostě obrázky nemá (zahraniční/obskurní produkty); fallback ikona Package.
- **DB úklid**: smazána 1 potravina s nazvem = raw EAN (artefakt ingestu před guardem nazev.length>=2).
- **Pokrytí**: obrazky 9 555/9 795 (97,5 %), alergeny 4 629, diety 5 759, EAN 6 448 – dopln_tagy_off dobíhá.

Ověřeno: tsc clean · 372/372 testů · build clean · git strom čistý.


## Kolo: cizojazyčné dietní veto (DE/FR/IT/NL/SK) + čištění tagů (21. 11. 2026)

- **DIETA_MLEKO_VEJCE_RE a DIETA_MASO_RYBY_RE rozšířeny o DE/FR/IT/NL/SK termíny** — produkty typu Thunfisch, Tuniak, Sahne, Maasdamer, Joghurt, Lait, Œufs, Boeuf, Poulet, Tonno dříve veto prošly přestože nesla crowdsourcovaný vegansky/vegetariansky tag.
- Rostlinné výjimky rozšířeny symetricky (Soja/Mandel Joghurt, Hafermilch, lait de soja/coco/amande, végétal, pflanzlich, sans lactose, laktosefrei) — cizojazyčné rostlinné produkty zůstávají pro veganské plány způsobilé.
- Ošetřené hrany: `milch(?!sauer)` — „milchsauer vergoren" je kvas, ne mléko; Œ ligatura mimo `\w` (oddělený \b nefunguje); `uovo` vs „nuovo"; `eier` vs příjmení (Bauermeier); Emmental s dvojitým m.
- **DB**: odstraněn chybný dietní tag z 36 řádků (německé sýry, tuňáci, krémy, Müllermilch). Kvalitativní report: dietní kontradikce 5 → 0, chybějící mleko 0.
- Regresní testy: 21 cizojazyčných názvů + falešně-pozitivní hrany (Hofmeier, nuovo, latte jako mléko).

Ověřeno: tsc clean · 373/373 testů · git strom čistý.
