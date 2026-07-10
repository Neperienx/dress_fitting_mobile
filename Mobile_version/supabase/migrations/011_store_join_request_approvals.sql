-- Convert invite codes into owner-approved join requests.

create table if not exists public.store_join_requests (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.store_invites(id) on delete cascade,
  store_id uuid not null references public.studios(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_label text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_join_requests_status_check check (status in ('pending', 'approved', 'declined'))
);

create index if not exists store_join_requests_store_id_idx on public.store_join_requests(store_id);
create index if not exists store_join_requests_requester_id_idx on public.store_join_requests(requester_id);
create index if not exists store_join_requests_pending_idx on public.store_join_requests(store_id, status);
create unique index if not exists store_join_requests_one_pending_per_invite_user_idx
  on public.store_join_requests(invite_id, requester_id)
  where status = 'pending';

alter table public.store_join_requests enable row level security;

drop policy if exists "Store join request participants can view requests" on public.store_join_requests;
create policy "Store join request participants can view requests"
  on public.store_join_requests
  for select
  using (
    requester_id = auth.uid()
    or public.is_store_owner(store_id, auth.uid())
  );

create or replace function public.set_store_join_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_join_requests_set_updated_at on public.store_join_requests;
create trigger store_join_requests_set_updated_at
before update on public.store_join_requests
for each row
execute function public.set_store_join_requests_updated_at();

create or replace function public.get_current_user_label()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'username', ''),
    nullif(auth.jwt() ->> 'email', ''),
    auth.uid()::text
  );
$$;

grant execute on function public.get_current_user_label() to authenticated;

create or replace function public.request_store_join(p_code text)
returns table (
  request_id uuid,
  store_id uuid,
  store_name text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.store_invites%rowtype;
  existing_request public.store_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request store access.';
  end if;

  select *
  into invite_record
  from public.store_invites
  where code = upper(trim(p_code))
    and claimed_at is null
    and expires_at > now()
  limit 1;

  if invite_record.id is null then
    raise exception 'Invite code is invalid, expired, or already used.';
  end if;

  if public.is_store_member(invite_record.store_id, auth.uid()) then
    raise exception 'You are already a member of this store.';
  end if;

  select *
  into existing_request
  from public.store_join_requests
  where invite_id = invite_record.id
    and requester_id = auth.uid()
    and store_join_requests.status = 'pending'
  limit 1;

  if existing_request.id is not null then
    return query
    select existing_request.id, studios.id, studios.name, existing_request.status
    from public.studios
    where studios.id = existing_request.store_id;
    return;
  end if;

  insert into public.store_join_requests (invite_id, store_id, requester_id, requester_label)
  values (invite_record.id, invite_record.store_id, auth.uid(), public.get_current_user_label())
  returning * into existing_request;

  return query
  select existing_request.id, studios.id, studios.name, existing_request.status
  from public.studios
  where studios.id = existing_request.store_id;
end;
$$;

grant execute on function public.request_store_join(text) to authenticated;

create or replace function public.accept_store_invite(p_code text)
returns table (
  store_id uuid,
  name text,
  city text,
  type text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Invite codes now require owner approval. Please request access with the latest app version.';
end;
$$;

grant execute on function public.accept_store_invite(text) to authenticated;

create or replace function public.list_pending_store_join_requests()
returns table (
  request_id uuid,
  store_id uuid,
  store_name text,
  requester_label text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select requests.id,
         requests.store_id,
         studios.name,
         requests.requester_label,
         requests.created_at
  from public.store_join_requests requests
  join public.studios on studios.id = requests.store_id
  where requests.status = 'pending'
    and public.is_store_owner(requests.store_id, auth.uid())
  order by requests.created_at asc;
$$;

grant execute on function public.list_pending_store_join_requests() to authenticated;

create or replace function public.approve_store_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.store_join_requests%rowtype;
  invite_record public.store_invites%rowtype;
  assigned_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to approve join requests.';
  end if;

  select *
  into request_record
  from public.store_join_requests
  where id = p_request_id
  limit 1;

  if request_record.id is null or request_record.status <> 'pending' then
    raise exception 'This join request is no longer pending.';
  end if;

  if not public.is_store_owner(request_record.store_id, auth.uid()) then
    raise exception 'Only store owners can approve join requests.';
  end if;

  select *
  into invite_record
  from public.store_invites
  where id = request_record.invite_id
    and claimed_at is null
    and expires_at > now()
  limit 1;

  if invite_record.id is null then
    raise exception 'The invite code for this request is expired or already used.';
  end if;

  assigned_role := case
    when not exists (
      select 1
      from public.store_members
      where store_id = request_record.store_id
    ) then 'owner'
    else invite_record.role
  end;

  insert into public.store_members (store_id, user_id, role)
  values (request_record.store_id, request_record.requester_id, assigned_role)
  on conflict (store_id, user_id)
  do update set
    role = case
      when public.store_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    updated_at = now();

  update public.store_join_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = request_record.id;

  update public.store_join_requests
  set status = 'declined',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where invite_id = request_record.invite_id
    and id <> request_record.id
    and status = 'pending';

  update public.store_invites
  set claimed_by = request_record.requester_id,
      claimed_at = now()
  where id = invite_record.id;
end;
$$;

grant execute on function public.approve_store_join_request(uuid) to authenticated;

create or replace function public.decline_store_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.store_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to decline join requests.';
  end if;

  select *
  into request_record
  from public.store_join_requests
  where id = p_request_id
  limit 1;

  if request_record.id is null or request_record.status <> 'pending' then
    raise exception 'This join request is no longer pending.';
  end if;

  if not public.is_store_owner(request_record.store_id, auth.uid()) then
    raise exception 'Only store owners can decline join requests.';
  end if;

  update public.store_join_requests
  set status = 'declined',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = request_record.id;
end;
$$;

grant execute on function public.decline_store_join_request(uuid) to authenticated;
