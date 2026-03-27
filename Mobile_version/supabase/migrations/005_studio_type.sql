alter table public.studios
  add column if not exists type text not null default 'wedding_dresses';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'studios_type_check'
      and conrelid = 'public.studios'::regclass
  ) then
    alter table public.studios
      add constraint studios_type_check
      check (type in ('wedding_dresses', 'engagement_rings'));
  end if;
end $$;
