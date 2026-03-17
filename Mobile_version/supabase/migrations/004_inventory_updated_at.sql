-- Track row updates so mobile clients can perform delta syncs.

alter table public.dresses
  add column if not exists updated_at timestamptz not null default now();

alter table public.dress_images
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dresses_set_updated_at on public.dresses;
create trigger dresses_set_updated_at
before update on public.dresses
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists dress_images_set_updated_at on public.dress_images;
create trigger dress_images_set_updated_at
before update on public.dress_images
for each row
execute function public.set_updated_at_timestamp();
