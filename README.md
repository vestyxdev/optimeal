# OptiMeal

**Jezte lépe. Šetřete peníze. Plánujte chytře.**

Osobní jídelníček podle vašich cílů, mealprep na více dní a nákupní
seznam s aktuálními slevami z českých obchodů – v jedné aplikaci.

## Stack

- **Frontend:** React 19 + Vite + TypeScript (strict) + Tailwind CSS v4
- **Backend/data:** Supabase (PostgreSQL + Auth + RLS)
- **Testy:** Vitest
- **Data ingestion:** Python scraper (letáky/ceny) běžící přes GitHub Actions

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (čistá logika: výživa, generátor)
npm run build      # produkční build (tsc + vite)
```

### Konfigurace

Aplikace potřebuje soubor `.env` ve kořenu projektu:

```
VITE_SUPABASE_URL=https://VASE-ID.supabase.co
VITE_SUPABASE_ANON_KEY=VASE-ANON-KLIC
```

Bez nich se spustí **setup gate** (přesný návod), ne demo verze.

### Databáze

Migrace se pustí v Supabase SQL editoru (nebo `supabase db push`):

1. `supabase/migrations/0001_init.sql` – schéma + RLS politiky
2. `supabase/seed.sql` – výchozí katalog potravin a referenční ceny
