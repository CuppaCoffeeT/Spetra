-- wallet prd phase 0: `receipts` storage bucket + owner-scoped object policies
-- private bucket for receipt images. policies on storage.objects restrict every
-- crud action to the object owner (auth.uid() = owner) for bucket 'receipts'.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users read own receipt objects'
  ) then
    create policy "Users read own receipt objects" on storage.objects
      for select
      using (bucket_id = 'receipts' and auth.uid() = owner);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users insert own receipt objects'
  ) then
    create policy "Users insert own receipt objects" on storage.objects
      for insert
      with check (bucket_id = 'receipts' and auth.uid() = owner);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users update own receipt objects'
  ) then
    create policy "Users update own receipt objects" on storage.objects
      for update
      using (bucket_id = 'receipts' and auth.uid() = owner)
      with check (bucket_id = 'receipts' and auth.uid() = owner);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users delete own receipt objects'
  ) then
    create policy "Users delete own receipt objects" on storage.objects
      for delete
      using (bucket_id = 'receipts' and auth.uid() = owner);
  end if;
end $$;
