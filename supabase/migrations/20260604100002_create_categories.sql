-- wallet prd phase 0: `categories` table (supabase-only)
-- all platforms read/write supabase directly; no sqlite mirror.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  color text,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);

create index if not exists categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Users manage own categories'
  ) then
    create policy "Users manage own categories" on public.categories
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
