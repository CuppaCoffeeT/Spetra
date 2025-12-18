# Wallet Tracker

Personal Spend Tracker built with Expo Router + React Native, local SQLite storage, and optional Supabase sync/auth scaffolding.

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI (installed via `npm i -g expo-cli` or use `npx`)
- Supabase project (optional but required for auth/sync). Grab the **Project URL** and **anon public key** from Supabase → `Settings → API`.

## 1. Install dependencies

```bash
cd wallet-tracker
npm install
```

## 2. Configure Supabase credentials (optional for auth)

Update `app.json`:

```json
"extra": {
  "supabaseUrl": "https://YOUR_PROJECT_REF.supabase.co",
  "supabaseAnonKey": "YOUR_ANON_PUBLIC_KEY"
}
```

Restart Metro when these change (`Ctrl+C`, then `npx expo start -c`).

If you prefer environment variables, rename `app.json` to `app.config.ts` and read from `process.env.EXPO_PUBLIC_SUPABASE_URL`, etc.

## 3. (Optional) Set up Supabase database

Run the SQL below in Supabase SQL editor to create tables + enable Row Level Security:

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  name text not null,
  type text not null,
  currency_default text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  amount_native numeric not null,
  currency_native text not null,
  amount_base numeric,
  currency_base text,
  fx_rate numeric,
  direction text not null check (direction in ('in', 'out')),
  description_raw text,
  description_clean text,
  category text,
  category_confidence numeric,
  account_id bigint references public.accounts(id) on delete set null,
  txn_datetime timestamptz not null,
  ingested_at timestamptz not null default now(),
  source text not null check (source in ('sms','email','push','manual')),
  source_meta jsonb,
  dedupe_hash text,
  parser_version text,
  is_transfer boolean default false,
  is_refund boolean default false,
  edited boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.rules (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  pattern text not null,
  category text not null,
  priority int not null default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on public.transactions (user_id, updated_at);
create index on public.transactions (user_id, txn_datetime);
create index on public.accounts (user_id, updated_at);
create index on public.categories (user_id, updated_at);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.rules enable row level security;

create policy "own_accounts" on public.accounts
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_categories" on public.categories
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_transactions" on public.transactions
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_rules" on public.rules
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## 4. Start or reopen the app

- **Fresh start (clears cache):**

  ```bash
  npx expo start -c
  ```

- **Reopen after the first run (cache already warm):**

  ```bash
  npx expo start
  ```

- Press `w` for web, `i` for iOS simulator, or `a` for Android emulator.
- First launch shows the login page; sign up or sign in with email/password.
- After auth, the drawer navigation (Overview, Transactions, Manual Input, Settings) becomes available.

## 5. Features snapshot

- **Manual Input** screen
  - Amount, direction, description, category (dropdown or custom “Others”), date/time (web inputs or native pickers), account selection, notes.
  - New categories persist for future use.
- **Settings**
  - Manage accounts, mock Gmail connect, sign out.
- **Local Storage**
  - SQLite via `expo-sqlite` (seed data on first run).
- **Auth**
  - Supabase email/password login, sign up, sign out.

## 6. Useful scripts

- Lint/typecheck: `npx tsc --noEmit`
- Reset seed data (dev): clear site data (web) or reinstall Expo Go / delete app DB (native).

## 7. Next ideas

- Implement Supabase sync (push/pull) or replace local reads with Supabase queries.
- Add password reset / magic link auth flows.
- Build cloud Gmail ingestion service.
- Export/import data, encryption, shared accounts, budgeting.
