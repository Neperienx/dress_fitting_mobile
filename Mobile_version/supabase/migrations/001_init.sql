-- Core profile table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  role text not null default 'studio_owner',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Studios table for bridal shops
create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

alter table public.studios enable row level security;

create policy "Owners can view their studios"
  on public.studios
  for select
  using (auth.uid() = owner_id);

create policy "Owners can create studios"
  on public.studios
  for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their studios"
  on public.studios
  for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their studios"
  on public.studios
  for delete
  using (auth.uid() = owner_id);

-- optional helper: auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
