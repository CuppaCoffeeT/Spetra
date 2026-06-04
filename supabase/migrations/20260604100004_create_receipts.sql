-- wallet prd phase 0: `receipts` table (supabase-only)
-- receipt images live in supabase storage (bucket 'receipts'); this row holds
-- metadata + ocr text. transaction_id is text to match transactions.id (text).

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  transaction_id text references public.transactions(id) on delete set null,
  storage_path text not null,
  merchant text,
  total numeric,
  currency text,
  receipt_date timestamptz,
  raw_text text,
  created_at timestamptz default now()
);

create index if not exists receipts_user_id_idx on public.receipts (user_id);
create index if not exists receipts_transaction_id_idx on public.receipts (transaction_id);

alter table public.receipts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipts'
      and policyname = 'Users manage own receipts'
  ) then
    create policy "Users manage own receipts" on public.receipts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
