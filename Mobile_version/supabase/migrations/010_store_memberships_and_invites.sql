-- Add store roles and one-time invite codes.
-- Owners can manage inventory and invite users. Members can view inventory and run sessions.

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_members_role_check check (role in ('owner', 'member')),
  constraint store_members_store_user_unique unique (store_id, user_id)
);

create index if not exists store_members_store_id_idx on public.store_members(store_id);
create index if not exists store_members_user_id_idx on public.store_members(user_id);

create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.studios(id) on delete cascade,
  code text not null unique,
  role text not null default 'member',
  created_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  constraint store_invites_role_check check (role in ('member'))
);

create index if not exists store_invites_store_id_idx on public.store_invites(store_id);
create index if not exists store_invites_code_idx on public.store_invites(code);

alter table public.store_members enable row level security;
alter table public.store_invites enable row level security;

create or replace function public.is_store_member(p_store_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = p_store_id
      and user_id = p_user_id
  );
$$;

create or replace function public.is_store_owner(p_store_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = p_store_id
      and user_id = p_user_id
      and role = 'owner'
  );
$$;

grant execute on function public.is_store_member(uuid, uuid) to authenticated;
grant execute on function public.is_store_owner(uuid, uuid) to authenticated;

create or replace function public.sync_studio_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.store_members (store_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (store_id, user_id)
    do update set role = 'owner', updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists studios_sync_owner_membership on public.studios;
create trigger studios_sync_owner_membership
after insert or update of owner_id on public.studios
for each row
execute function public.sync_studio_owner_membership();

insert into public.store_members (store_id, user_id, role)
select id, owner_id, 'owner'
from public.studios
where owner_id is not null
on conflict (store_id, user_id)
do update set role = 'owner', updated_at = now();

create or replace function public.promote_sole_store_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_store_id uuid;
begin
  if tg_op = 'DELETE' then
    target_store_id := old.store_id;
  else
    target_store_id := new.store_id;
  end if;

  update public.store_members
  set role = 'owner', updated_at = now()
  where store_id = target_store_id
    and (
      select count(*)
      from public.store_members
      where store_id = target_store_id
    ) = 1;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists store_members_promote_sole_member on public.store_members;
create trigger store_members_promote_sole_member
after insert or delete on public.store_members
for each row
execute function public.promote_sole_store_member();

create or replace function public.generate_store_invite(p_store_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  attempt_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create an invite.';
  end if;

  if not public.is_store_owner(p_store_id, auth.uid()) then
    raise exception 'Only store owners can create invite codes.';
  end if;

  loop
    attempt_count := attempt_count + 1;
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.store_invites (store_id, code, role, created_by)
      values (p_store_id, generated_code, 'member', auth.uid());

      return generated_code;
    exception
      when unique_violation then
        if attempt_count >= 5 then
          raise exception 'Could not generate a unique invite code.';
        end if;
    end;
  end loop;
end;
$$;

grant execute on function public.generate_store_invite(uuid) to authenticated;

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
declare
  invite_record public.store_invites%rowtype;
  assigned_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
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

  assigned_role := case
    when not exists (
      select 1
      from public.store_members
      where store_id = invite_record.store_id
    ) then 'owner'
    else invite_record.role
  end;

  insert into public.store_members (store_id, user_id, role)
  values (invite_record.store_id, auth.uid(), assigned_role)
  on conflict (store_id, user_id)
  do update set
    role = case
      when public.store_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    updated_at = now();

  update public.store_invites
  set claimed_by = auth.uid(),
      claimed_at = now()
  where id = invite_record.id;

  return query
  select studios.id, studios.name, studios.city, studios.type, assigned_role
  from public.studios
  where studios.id = invite_record.store_id;
end;
$$;

grant execute on function public.accept_store_invite(text) to authenticated;

drop policy if exists "Owners can view their studios" on public.studios;
drop policy if exists "Owners can create studios" on public.studios;
drop policy if exists "Owners can update their studios" on public.studios;
drop policy if exists "Owners can delete their studios" on public.studios;

create policy "Store members can view studios"
  on public.studios
  for select
  using (public.is_store_member(id, auth.uid()) or owner_id = auth.uid());

create policy "Signed-in users can create owned studios"
  on public.studios
  for insert
  with check (auth.uid() = owner_id);

create policy "Store owners can update studios"
  on public.studios
  for update
  using (public.is_store_owner(id, auth.uid()) or owner_id = auth.uid())
  with check (public.is_store_owner(id, auth.uid()) or owner_id = auth.uid());

create policy "Store owners can delete studios"
  on public.studios
  for delete
  using (public.is_store_owner(id, auth.uid()) or owner_id = auth.uid());

drop policy if exists "Store members can view memberships" on public.store_members;
create policy "Store members can view memberships"
  on public.store_members
  for select
  using (public.is_store_member(store_id, auth.uid()));

drop policy if exists "Store owners can view invites" on public.store_invites;
create policy "Store owners can view invites"
  on public.store_invites
  for select
  using (public.is_store_owner(store_id, auth.uid()));

drop policy if exists "Studio owners can view dresses" on public.dresses;
drop policy if exists "Studio owners can create dresses" on public.dresses;
drop policy if exists "Studio owners can update dresses" on public.dresses;
drop policy if exists "Studio owners can delete dresses" on public.dresses;

create policy "Store members can view dresses"
  on public.dresses
  for select
  using (
    public.is_store_member(studio_id, auth.uid())
    and exists (
      select 1 from public.studios
      where studios.id = dresses.studio_id
        and studios.type = 'wedding_dresses'
    )
  );

create policy "Store owners can create dresses"
  on public.dresses
  for insert
  with check (
    coalesce(created_by, auth.uid()) = auth.uid()
    and public.is_store_owner(studio_id, auth.uid())
    and exists (
      select 1 from public.studios
      where studios.id = dresses.studio_id
        and studios.type = 'wedding_dresses'
    )
  );

create policy "Store owners can update dresses"
  on public.dresses
  for update
  using (public.is_store_owner(studio_id, auth.uid()));

create policy "Store owners can delete dresses"
  on public.dresses
  for delete
  using (public.is_store_owner(studio_id, auth.uid()));

drop policy if exists "Studio owners can view dress images" on public.dress_images;
drop policy if exists "Studio owners can create dress images" on public.dress_images;
drop policy if exists "Studio owners can update dress images" on public.dress_images;
drop policy if exists "Studio owners can delete dress images" on public.dress_images;

create policy "Store members can view dress images"
  on public.dress_images
  for select
  using (
    exists (
      select 1
      from public.dresses
      where dresses.id = dress_images.dress_id
        and public.is_store_member(dresses.studio_id, auth.uid())
    )
  );

create policy "Store owners can create dress images"
  on public.dress_images
  for insert
  with check (
    exists (
      select 1
      from public.dresses
      where dresses.id = dress_images.dress_id
        and public.is_store_owner(dresses.studio_id, auth.uid())
    )
  );

create policy "Store owners can update dress images"
  on public.dress_images
  for update
  using (
    exists (
      select 1
      from public.dresses
      where dresses.id = dress_images.dress_id
        and public.is_store_owner(dresses.studio_id, auth.uid())
    )
  );

create policy "Store owners can delete dress images"
  on public.dress_images
  for delete
  using (
    exists (
      select 1
      from public.dresses
      where dresses.id = dress_images.dress_id
        and public.is_store_owner(dresses.studio_id, auth.uid())
    )
  );

drop policy if exists "Studio owners can view rings" on public.rings;
drop policy if exists "Studio owners can create rings" on public.rings;
drop policy if exists "Studio owners can update rings" on public.rings;
drop policy if exists "Studio owners can delete rings" on public.rings;

create policy "Store members can view rings"
  on public.rings
  for select
  using (
    public.is_store_member(studio_id, auth.uid())
    and exists (
      select 1 from public.studios
      where studios.id = rings.studio_id
        and studios.type = 'engagement_rings'
    )
  );

create policy "Store owners can create rings"
  on public.rings
  for insert
  with check (
    coalesce(created_by, auth.uid()) = auth.uid()
    and public.is_store_owner(studio_id, auth.uid())
    and exists (
      select 1 from public.studios
      where studios.id = rings.studio_id
        and studios.type = 'engagement_rings'
    )
  );

create policy "Store owners can update rings"
  on public.rings
  for update
  using (public.is_store_owner(studio_id, auth.uid()));

create policy "Store owners can delete rings"
  on public.rings
  for delete
  using (public.is_store_owner(studio_id, auth.uid()));

drop policy if exists "Studio owners can view ring images" on public.ring_images;
drop policy if exists "Studio owners can create ring images" on public.ring_images;
drop policy if exists "Studio owners can update ring images" on public.ring_images;
drop policy if exists "Studio owners can delete ring images" on public.ring_images;

create policy "Store members can view ring images"
  on public.ring_images
  for select
  using (
    exists (
      select 1
      from public.rings
      where rings.id = ring_images.ring_id
        and public.is_store_member(rings.studio_id, auth.uid())
    )
  );

create policy "Store owners can create ring images"
  on public.ring_images
  for insert
  with check (
    exists (
      select 1
      from public.rings
      where rings.id = ring_images.ring_id
        and public.is_store_owner(rings.studio_id, auth.uid())
    )
  );

create policy "Store owners can update ring images"
  on public.ring_images
  for update
  using (
    exists (
      select 1
      from public.rings
      where rings.id = ring_images.ring_id
        and public.is_store_owner(rings.studio_id, auth.uid())
    )
  );

create policy "Store owners can delete ring images"
  on public.ring_images
  for delete
  using (
    exists (
      select 1
      from public.rings
      where rings.id = ring_images.ring_id
        and public.is_store_owner(rings.studio_id, auth.uid())
    )
  );

drop policy if exists "Studio owners can view session feedback" on public.session_feedback;
drop policy if exists "Studio owners can create session feedback" on public.session_feedback;
drop policy if exists "Studio owners can update session feedback" on public.session_feedback;

create policy "Store members can view session feedback"
  on public.session_feedback
  for select
  using (public.is_store_member(studio_id, auth.uid()));

create policy "Store members can create session feedback"
  on public.session_feedback
  for insert
  with check (
    submitted_by = auth.uid()
    and public.is_store_member(studio_id, auth.uid())
  );

create policy "Store members can update their session feedback"
  on public.session_feedback
  for update
  using (
    submitted_by = auth.uid()
    and public.is_store_member(studio_id, auth.uid())
  )
  with check (
    submitted_by = auth.uid()
    and public.is_store_member(studio_id, auth.uid())
  );
