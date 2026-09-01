-- revamp (live tracking): `transaction_items` — line items per transaction.
-- Every transaction (auto-ingested, manual, or receipt-scanned) can carry
-- itemized detail. The parent transaction's `amount` stays canonical; items
-- are detail rows. Supabase-only (web is the primary client for items).

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  name text not null,
  qty numeric not null default 1 check (qty > 0),
  unit_price numeric,
  amount numeric not null,
  category text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists transaction_items_txn_idx
  on public.transaction_items (transaction_id);
create index if not exists transaction_items_user_idx
  on public.transaction_items (user_id);

alter table public.transaction_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_items'
      and policyname = 'Users manage own transaction items'
  ) then
    create policy "Users manage own transaction items" on public.transaction_items
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
