-- Engefex: leitura leve e retrocompatível do estado.
-- Não altera nem apaga o histórico completo armazenado em engefex_state.
-- Clientes antigos continuam usando engefex_read_state; exportações e auditorias permanecem completas.
create or replace function public.engefex_read_state_compact(p_workspace uuid)
returns table(revision bigint, updated_at timestamptz, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.engefex_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  ) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  return query
  select s.revision, s.updated_at,
    case
      when engefex_private.full_read(p_workspace, auth.uid())
      then jsonb_set(
        s.payload,
        '{history}',
        jsonb_path_query_array(s.payload, '$.history[0 to 49]'),
        false
      )
      else engefex_private.project_state(p_workspace, auth.uid(), s.payload)
    end
  from public.engefex_state s
  where s.workspace_id = p_workspace;
end;
$$;

revoke all on function public.engefex_read_state_compact(uuid) from public, anon;
grant execute on function public.engefex_read_state_compact(uuid) to authenticated;
