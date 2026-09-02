# Spend Tracker — Web App (primary client)

A **Vite + React + Tailwind** app on the same Supabase project as the native Expo app
(shared backend, RLS-scoped per user). As of the live-tracking revamp this is the
**primary, full read-write client** — see `docs/REVAMP_LIVE_TRACKING.md` for the architecture.

## Run

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Sign in with the same email/password as the app.

## Build

```bash
npm run build    # tsc --noEmit + vite build -> dist/
npm run preview
```

## What it does

- **Dashboard** — month spent/income/net, budgets, top categories, recent + **live** transactions
  (Realtime: a card tap pops in within seconds), needs-review counter
- **Transactions** — search/month/category/review filters, expandable **line items**,
  full edit (all fields + itemization), delete; re-categorizing teaches the categorizer
- **Add** — manual entry with line items, category auto-suggest (rules → keywords → AI),
  **receipt scan** (photo → merchant/date/total/items via Claude vision)
- **Budgets** — per-category monthly caps, set/clear inline
- **Categories** — CRUD + colours, plus the learned-rules list ("Forget" to unlearn)
- **Settings** — auto-tracking keys, webhook URL, iOS Shortcut setup guide, email worker pointer

## Live ingestion (backend pieces)

- Supabase Edge Functions: `ingest` (Shortcut + email webhook), `categorize`, `parse-receipt`
  (`supabase/functions/`). Deploy: `supabase functions deploy ingest categorize parse-receipt`.
- Function secret for AI tiers: `supabase secrets set ANTHROPIC_API_KEY=...` (optional — without
  it, rules + keyword categorization still work and receipt scan degrades to manual entry).
- Email bridge: `integrations/cloudflare-email-worker/` (see its README).

## Notes

- Supabase URL + anon key are inlined in `src/lib/supabase.ts` (public; RLS protects data).
  Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- The "quiet ledger" palette mirrors `src/theme/tokens.ts` from the native app (light + dark).
- This folder has its own `node_modules`; Metro ignores `web/` (see `metro.config.js`).
