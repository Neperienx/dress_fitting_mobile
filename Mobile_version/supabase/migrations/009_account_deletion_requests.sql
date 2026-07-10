-- Account deletion is requested from the app and completed by an admin/service-role workflow.
-- Business data must survive accidental user deletion, so stores and inventory are detached
-- from auth.users instead of being cascade-deleted.

alter table public.studios
  alter column owner_id drop not null;

alter table public.studios
  drop constraint if exists studios_owner_id_fkey;

alter table public.studios
  add constraint studios_owner_id_fkey
  foreign key (owner_id)
  references auth.users(id)
  on delete set null;

alter table public.dresses
  alter column created_by drop not null;

alter table public.dresses
  drop constraint if exists dresses_created_by_fkey;

alter table public.dresses
  add constraint dresses_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null;

alter table public.rings
  alter column created_by drop not null;

alter table public.rings
  drop constraint if exists rings_created_by_fkey;

alter table public.rings
  add constraint rings_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null;

alter table public.session_feedback
  alter column submitted_by drop not null;

alter table public.session_feedback
  drop constraint if exists session_feedback_submitted_by_fkey;

alter table public.session_feedback
  add constraint session_feedback_submitted_by_fkey
  foreign key (submitted_by)
  references auth.users(id)
  on delete set null;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  reason text,
  preserve_store_data boolean not null default true,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint account_deletion_requests_status_check
    check (status in ('requested', 'processing', 'completed', 'cancelled'))
);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests(user_id);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can view their own account deletion requests" on public.account_deletion_requests;
create policy "Users can view their own account deletion requests"
  on public.account_deletion_requests
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can request account deletion" on public.account_deletion_requests;
create policy "Users can request account deletion"
  on public.account_deletion_requests
  for insert
  with check (
    user_id = auth.uid()
    and preserve_store_data = true
    and status = 'requested'
  );
