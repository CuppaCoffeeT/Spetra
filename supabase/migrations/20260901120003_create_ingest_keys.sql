-- revamp (live tracking): `ingest_keys` — per-user webhook secrets.
-- The iOS Shortcut and the Cloudflare Email Worker authenticate to the
-- `ingest` edge function with `x-ingest-key`. The function runs with the
-- service role and resolves key -> user_id (RLS is for end-user clients,
-- which may only manage their own keys).

create table if not exists public.ingest_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  key text not null unique,
  label text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists ingest_keys_user_idx on public.ingest_keys (user_id);

alter table public.ingest_keys enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingest_keys'
      and policyname = 'Users manage own ingest keys'
  ) then
    create policy "Users manage own ingest keys" on public.ingest_keys
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
