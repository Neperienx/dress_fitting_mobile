-- Enforce hard inventory split by studio type and add dedicated ring inventory tables.

drop policy if exists "Studio owners can view dresses" on public.dresses;
drop policy if exists "Studio owners can create dresses" on public.dresses;
drop policy if exists "Studio owners can update dresses" on public.dresses;
drop policy if exists "Studio owners can delete dresses" on public.dresses;

create policy "Studio owners can view dresses"
  on public.dresses
  for select
  using (
    exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'wedding_dresses'
    )
  );

create policy "Studio owners can create dresses"
  on public.dresses
  for insert
  with check (
    coalesce(created_by, auth.uid()) = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = dresses.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'wedding_dresses'
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
        and studios.type = 'wedding_dresses'
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
        and studios.type = 'wedding_dresses'
    )
  );

drop policy if exists "Studio owners can view dress images" on public.dress_images;
drop policy if exists "Studio owners can create dress images" on public.dress_images;
drop policy if exists "Studio owners can update dress images" on public.dress_images;
drop policy if exists "Studio owners can delete dress images" on public.dress_images;

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
        and studios.type = 'wedding_dresses'
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
        and studios.type = 'wedding_dresses'
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
        and studios.type = 'wedding_dresses'
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
        and studios.type = 'wedding_dresses'
    )
  );

create table if not exists public.rings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text,
  price numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rings_price_non_negative check (price is null or price >= 0)
);

alter table public.rings
  alter column created_by set default auth.uid();

create index if not exists rings_studio_id_idx on public.rings(studio_id);

alter table public.rings enable row level security;

create policy "Studio owners can view rings"
  on public.rings
  for select
  using (
    exists (
      select 1
      from public.studios
      where studios.id = rings.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can create rings"
  on public.rings
  for insert
  with check (
    coalesce(created_by, auth.uid()) = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = rings.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can update rings"
  on public.rings
  for update
  using (
    exists (
      select 1
      from public.studios
      where studios.id = rings.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can delete rings"
  on public.rings
  for delete
  using (
    exists (
      select 1
      from public.studios
      where studios.id = rings.studio_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create table if not exists public.ring_images (
  id uuid primary key default gen_random_uuid(),
  ring_id uuid not null references public.rings(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ring_images_ring_id_idx on public.ring_images(ring_id);
create unique index if not exists ring_images_unique_sort_order_idx on public.ring_images(ring_id, sort_order);

alter table public.ring_images enable row level security;

create policy "Studio owners can view ring images"
  on public.ring_images
  for select
  using (
    exists (
      select 1
      from public.rings
      join public.studios on studios.id = rings.studio_id
      where rings.id = ring_images.ring_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can create ring images"
  on public.ring_images
  for insert
  with check (
    exists (
      select 1
      from public.rings
      join public.studios on studios.id = rings.studio_id
      where rings.id = ring_images.ring_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can update ring images"
  on public.ring_images
  for update
  using (
    exists (
      select 1
      from public.rings
      join public.studios on studios.id = rings.studio_id
      where rings.id = ring_images.ring_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

create policy "Studio owners can delete ring images"
  on public.ring_images
  for delete
  using (
    exists (
      select 1
      from public.rings
      join public.studios on studios.id = rings.studio_id
      where rings.id = ring_images.ring_id
        and studios.owner_id = auth.uid()
        and studios.type = 'engagement_rings'
    )
  );

drop trigger if exists rings_set_updated_at on public.rings;
create trigger rings_set_updated_at
before update on public.rings
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists ring_images_set_updated_at on public.ring_images;
create trigger ring_images_set_updated_at
before update on public.ring_images
for each row
execute function public.set_updated_at_timestamp();
