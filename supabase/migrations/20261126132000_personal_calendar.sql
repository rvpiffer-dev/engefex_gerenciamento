create table public.engefex_personal_calendar (
  workspace_id uuid not null,
  user_id uuid not null default auth.uid(),
  event_id text not null,
  event jsonb not null check (jsonb_typeof(event) = 'object' and event ? 'id' and event ->> 'id' = event_id),
  revision uuid not null default gen_random_uuid(),
  primary key (workspace_id, user_id, event_id)
);

alter table public.engefex_personal_calendar enable row level security;
create policy personal_calendar_owner on public.engefex_personal_calendar
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.engefex_members m
      where m.workspace_id = engefex_personal_calendar.workspace_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.engefex_members m
      where m.workspace_id = engefex_personal_calendar.workspace_id
        and m.user_id = (select auth.uid())
    )
  );

revoke all on public.engefex_personal_calendar from public, anon, authenticated;
grant select, delete on public.engefex_personal_calendar to authenticated;
grant insert (workspace_id, event_id, event), update (event, revision)
  on public.engefex_personal_calendar to authenticated;
