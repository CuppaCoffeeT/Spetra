-- wallet prd phase 0: baseline `transactions` table
-- baseline capture for reproducibility only. uses if not exists so it never
-- clobbers an existing prod transactions table. transactions are dual-path
-- (sqlite on native + supabase); this is the canonical supabase shape.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount numeric not null,
  currency text not null default 'SGD',
  direction text not null check (direction in ('in', 'out')),
  description text not null,
  category text,
  transaction_date timestamptz not null,
  source text not null default 'email',
  source_email text,
  dedupe_hash text unique,
  created_at timestamptz default now(),
  synced_at timestamptz
);

alter table public.transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'Users manage own transactions'
  ) then
    create policy "Users manage own transactions" on public.transactions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
