# OptiMeal – Technical Audit & Assessment

Date: 2026-11-14 · Codebase: `main` @ `e147d56` (phases 1–6a)

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
