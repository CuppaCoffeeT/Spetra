-- wallet prd phase 0: extend `transactions` table (supabase side of dual path)
-- additive columns linking a transaction to its receipt + edit/confidence meta.
-- receipt_id fk added here (after receipts exists) so dependency order holds.

alter table public.transactions
  add column if not exists receipt_id uuid references public.receipts(id) on delete set null;

alter table public.transactions
  add column if not exists notes text;

alter table public.transactions
  add column if not exists category_confidence numeric;

alter table public.transactions
  add column if not exists edited boolean not null default false;
