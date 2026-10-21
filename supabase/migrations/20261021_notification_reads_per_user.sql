-- Leitura individual de notificações por usuário e área de trabalho.
-- Não altera o conteúdo nem a revisão do estado principal do gerenciador.
create table if not exists public.engefex_notification_reads (
  workspace_id uuid not null,
  user_id uuid not null,
  notification_id text not null check (char_length(notification_id) between 1 and 300),
  read_at timestamptz not null default now(),
  primary key (workspace_id, user_id, notification_id)
);
alter table public.engefex_notification_reads enable row level security;
create policy "engefex_notification_reads_self_select"
  on public.engefex_notification_reads for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.engefex_members m
      where m.workspace_id = engefex_notification_reads.workspace_id
        and m.user_id = (select auth.uid())
    )
  );
create policy "engefex_notification_reads_self_insert"
  on public.engefex_notification_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.engefex_members m
      where m.workspace_id = engefex_notification_reads.workspace_id
        and m.user_id = (select auth.uid())
    )
  );
revoke all on public.engefex_notification_reads from anon, public;
grant select, insert on public.engefex_notification_reads to authenticated;
