-- Storage uploads should not be blocked by studio row checks.
-- Inventory visibility is controlled by public.dresses/public.rings image rows,
-- while this bucket stores the binary files those rows point to.

drop policy if exists "Studio owners can upload inventory images" on storage.objects;
drop policy if exists "Authenticated users can upload inventory images" on storage.objects;
create policy "Authenticated users can upload inventory images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'inventory-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Studio owners can update inventory images" on storage.objects;
drop policy if exists "Authenticated users can update inventory images" on storage.objects;
create policy "Authenticated users can update inventory images"
  on storage.objects
  for update
  using (
    bucket_id = 'inventory-images'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'inventory-images'
    and auth.role() = 'authenticated'
  );
