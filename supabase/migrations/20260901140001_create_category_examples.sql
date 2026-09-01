-- revamp (local categorizer): pgvector + `category_examples` — the memory of
-- the embedding-based kNN categorizer tier. Each row is a labeled example
-- (seed phrase, user correction, or cached generative verdict) embedded with
-- gte-small (384 dims) by the edge functions. No vector index: at personal
-- scale (<10k rows) pgvector's exact scan is single-digit-ms with perfect
-- recall.

create extension if not exists vector with schema extensions;

create table if not exists public.category_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  category text not null,
  content text not null,
  source text not null default 'correction' check (source in ('seed', 'correction', 'llm')),
  embedding vector(384) not null,
  created_at timestamptz default now(),
  unique (user_id, content)
);

create index if not exists category_examples_user_idx on public.category_examples (user_id);

alter table public.category_examples enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'category_examples'
      and policyname = 'Users manage own category examples'
  ) then
    create policy "Users manage own category examples" on public.category_examples
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Nearest labeled examples for a query embedding (cosine). security invoker:
-- called by the service-role client (ingest) or a user-scoped client
-- (categorize fn — RLS restricts to own rows regardless of p_user_id).
create or replace function public.match_category_examples(
  p_user_id uuid,
  p_embedding vector(384),
  p_count int default 3
)
returns table (category text, content text, similarity double precision)
language sql
stable
as $$
  select
    ce.category,
    ce.content,
    1 - (ce.embedding <=> p_embedding) as similarity
  from public.category_examples ce
  where ce.user_id = p_user_id
  order by ce.embedding <=> p_embedding
  limit p_count;
$$;
