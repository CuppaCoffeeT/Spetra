-- revamp (live tracking): extend `transactions` for server-side live ingestion.
-- - merchant: normalized merchant name (Shortcut payload / parsed from email)
-- - card_label: which card/pass paid (from the Shortcut payload)
-- - needs_review: low-confidence categorization -> surfaced in the review queue
-- - source_meta: raw ingest payload + dedupe bookkeeping (jsonb)
-- Also enables Realtime on transactions so the web app can show live inserts.

alter table public.transactions
  add column if not exists merchant text;

alter table public.transactions
  add column if not exists card_label text;

alter table public.transactions
  add column if not exists needs_review boolean not null default false;

alter table public.transactions
  add column if not exists source_meta jsonb;

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

-- Realtime for live "transaction just landed" updates in the web app.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end $$;
