create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  local_session_id text not null,
  bride_name text,
  feedback_reaction text,
  feedback_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_feedback_reaction_check check (
    feedback_reaction is null or feedback_reaction in ('up', 'down', 'comment')
  ),
  constraint session_feedback_unique_session unique (studio_id, local_session_id)
);

create index if not exists session_feedback_studio_id_idx on public.session_feedback(studio_id);
create index if not exists session_feedback_submitted_by_idx on public.session_feedback(submitted_by);

create or replace function public.set_session_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_feedback_set_updated_at on public.session_feedback;
create trigger session_feedback_set_updated_at
  before update on public.session_feedback
  for each row execute procedure public.set_session_feedback_updated_at();

alter table public.session_feedback enable row level security;

create policy "Studio owners can view session feedback"
  on public.session_feedback
  for select
  using (
    exists (
      select 1
      from public.studios
      where studios.id = session_feedback.studio_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can create session feedback"
  on public.session_feedback
  for insert
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = session_feedback.studio_id
        and studios.owner_id = auth.uid()
    )
  );

create policy "Studio owners can update session feedback"
  on public.session_feedback
  for update
  using (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = session_feedback.studio_id
        and studios.owner_id = auth.uid()
    )
  )
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.studios
      where studios.id = session_feedback.studio_id
        and studios.owner_id = auth.uid()
    )
  );
