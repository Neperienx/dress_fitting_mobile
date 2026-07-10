-- Fix ambiguous status reference in request_store_join when the function
-- return column and table column share the same name.

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
