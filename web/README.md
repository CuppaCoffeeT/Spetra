# Spend Tracker — Web Viewer

A standalone **Vite + React + Tailwind** read-only viewer for the Spend Tracker data.
It talks to the **same Supabase project** as the native Expo app (shared backend, RLS-scoped
per user) — it does not share code with the React Native app, so the Expo app is untouched.

## Run

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Sign in with the **same email/password** you use in the app — you'll see the same data.

## Build

```bash
npm run build    # tsc --noEmit + vite build -> dist/
npm run preview
```

## What it shows (read-only)

- **Dashboard** — month spent/income/net, this month's budgets, top categories, recent transactions
- **Transactions** — full list with month filter
- **Budgets** — per-category caps vs spend, with a month switcher

## Notes

- Supabase URL + anon key are inlined in `src/lib/supabase.ts` (the anon key is public; RLS
  protects the data). Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars.
- The "quiet ledger" palette mirrors `src/theme/tokens.ts` from the native app (light + dark).
- This folder has its own `node_modules`; Metro is configured to ignore `web/` (see `metro.config.js`).
