-- Canonical remote storage for inventory photos.
-- Object paths are written by the app as:
--   {store_type}/{studio_id}/{item_id}/{timestamp}-{sort_order}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-images',
  'inventory-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Inventory images are publicly readable" on storage.objects;
create policy "Inventory images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'inventory-images');

drop policy if exists "Studio owners can upload inventory images" on storage.objects;
create policy "Authenticated users can upload inventory images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'inventory-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Studio owners can update inventory images" on storage.objects;
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

drop policy if exists "Studio owners can delete inventory images" on storage.objects;
create policy "Studio owners can delete inventory images"
  on storage.objects
  for delete
  using (
    bucket_id = 'inventory-images'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.studios
      where studios.id::text = (storage.foldername(name))[2]
        and studios.owner_id = auth.uid()
        and studios.type = (storage.foldername(name))[1]
    )
  );
