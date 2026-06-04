-- wallet prd phase 6: `rules` table (supabase-only)
-- all platforms read/write supabase directly; no sqlite mirror.
-- learned merchant-key -> category mappings; pattern is a lowercase merchant key,
-- category is a category NAME. higher priority wins; unique per (user, pattern).

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  pattern text not null,
  category text not null,
  priority int not null default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, pattern)
);

create index if not exists rules_user_id_idx on public.rules (user_id);

alter table public.rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rules'
      and policyname = 'Users manage own rules'
  ) then
    create policy "Users manage own rules" on public.rules
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
