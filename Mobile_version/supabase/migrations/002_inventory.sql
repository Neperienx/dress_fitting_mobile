-- Dress inventory grouped by studio
create table if not exists public.dresses (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text,
  price numeric(10, 2),
  created_at timestamptz not null default now(),
  constraint dresses_price_non_negative check (price is null or price >= 0)
);

create index if not exists dresses_studio_id_idx on public.dresses(studio_id);

alter table public.dresses enable row level security;

create policy "Studio owners can view dresses"
  on public.dresses
  for select
  using (
    exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can create dresses"
  on public.dresses
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can update dresses"
  on public.dresses
  for update
  using (
    exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can delete dresses"
  on public.dresses
  for delete
  using (
    exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
    )
  );

-- One dress profile can hold multiple photos
create table if not exists public.dress_images (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid not null references public.dresses(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists dress_images_dress_id_idx on public.dress_images(dress_id);
create unique index if not exists dress_images_unique_sort_order_idx on public.dress_images(dress_id, sort_order);

alter table public.dress_images enable row level security;

create policy "Studio owners can view dress images"
  on public.dress_images
  for select
  using (
    exists (
      select 1
      from public.dresses
      join public.studios on studios.id = dresses.studio_id
      where dresses.id = dress_images.dress_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can create dress images"
  on public.dress_images
  for insert
  with check (
    exists (
      select 1
      from public.dresses
      join public.studios on studios.id = dresses.studio_id
      where dresses.id = dress_images.dress_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can update dress images"
  on public.dress_images
  for update
  using (
    exists (
      select 1
      from public.dresses
      join public.studios on studios.id = dresses.studio_id
      where dresses.id = dress_images.dress_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can delete dress images"
  on public.dress_images
  for delete
  using (
    exists (
      select 1
      from public.dresses
      join public.studios on studios.id = dresses.studio_id
      where dresses.id = dress_images.dress_id
        and studios.owner_id = auth.uid()
    )
  );
