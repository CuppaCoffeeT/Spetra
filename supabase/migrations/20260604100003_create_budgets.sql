-- wallet prd phase 0: `budgets` table (supabase-only)
-- all platforms read/write supabase directly; no sqlite mirror.
-- one budget per (user, category, month); month stored as 'YYYY-MM'.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  category_id uuid references public.categories(id) on delete cascade,
  month text not null,
  limit_amount numeric not null check (limit_amount >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, category_id, month)
);

create index if not exists budgets_user_id_month_idx on public.budgets (user_id, month);

alter table public.budgets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budgets'
      and policyname = 'Users manage own budgets'
  ) then
    create policy "Users manage own budgets" on public.budgets
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
