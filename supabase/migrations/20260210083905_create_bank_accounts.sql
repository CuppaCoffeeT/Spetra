-- wallet prd phase 0: baseline `bank_accounts` table (pre-existing in prod)
-- captured into the tracked migration set for reproducibility. idempotent.

create table if not exists public.bank_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  bank_name text not null,
  account_type text not null check (account_type in ('card', 'account')),
  last_four_digits text not null,
  label text,
  source_email text,
  created_at timestamptz default now(),
  unique (user_id, bank_name, last_four_digits)
);

alter table public.bank_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bank_accounts'
      and policyname = 'Users manage own accounts'
  ) then
    create policy "Users manage own accounts" on public.bank_accounts
      for all
      using (auth.uid() = user_id);
  end if;
end $$;
