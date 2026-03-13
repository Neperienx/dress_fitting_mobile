-- Ensure dresses created from the app inherit the signed-in user and pass RLS checks.
alter table public.dresses
  alter column created_by set default auth.uid();

drop policy if exists "Studio owners can create dresses" on public.dresses;

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
    )
  );
