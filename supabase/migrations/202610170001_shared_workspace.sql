-- Executar no SQL Editor de um projeto Supabase novo.
-- A interface local permanece independente até a conexão ser configurada.
begin;
create table public.engefex_workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 created_at timestamptz not null default now()
);
create table public.engefex_members (
 workspace_id uuid not null references public.engefex_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key (workspace_id,user_id)
);
create index engefex_members_user_idx on public.engefex_members(user_id);
create table public.engefex_state (
 workspace_id uuid primary key references public.engefex_workspaces(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 payload jsonb,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint engefex_payload_object check (payload is null or jsonb_typeof(payload) = 'object')
);
alter table public.engefex_workspaces enable row level security;
alter table public.engefex_members enable row level security;
alter table public.engefex_state enable row level security;
-- Usuários não podem conceder acesso a si próprios ou a terceiros.
revoke all on public.engefex_workspaces,public.engefex_members,public.engefex_state from anon,authenticated;
grant select on public.engefex_workspaces,public.engefex_members,public.engefex_state to authenticated;
create policy engefex_own_membership on public.engefex_members for select to authenticated
 using (user_id = (select auth.uid()));
create policy engefex_workspace_read on public.engefex_workspaces for select to authenticated
 using (exists (select 1 from public.engefex_members m where m.workspace_id = id and m.user_id = (select auth.uid())));
create policy engefex_state_read on public.engefex_state for select to authenticated
 using (exists (select 1 from public.engefex_members m where m.workspace_id = engefex_state.workspace_id and m.user_id = (select auth.uid())));
-- Uma transação compare-and-swap: revisão antiga não pode sobrescrever a atual.
create function public.engefex_save_state(p_workspace uuid,p_revision bigint,p_payload jsonb)
 returns table(revision bigint,updated_at timestamptz)
 language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.engefex_members m where m.workspace_id=p_workspace and m.user_id=auth.uid()
 ) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_revision is null or p_revision < 0 or p_payload is null or jsonb_typeof(p_payload) <> 'object'
 or p_payload->>'version' is distinct from '1' or p_payload->>'dataModel' is distinct from '2'
 or jsonb_typeof(p_payload->'projects') is distinct from 'array'
 then raise exception 'Base de dados inválida' using errcode='22023'; end if;
 if octet_length(p_payload::text)>20000000 then
  raise exception 'Base excede 20 MB. Anexos devem ficar no Storage.' using errcode='22023';
 end if;
 return query update public.engefex_state s
 set payload=p_payload,revision=s.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()
 where s.workspace_id=p_workspace and s.revision=p_revision
 returning s.revision,s.updated_at;
 if not found then raise exception 'A base mudou. Recarregue antes de salvar.' using errcode='40001'; end if;
end;
$$;
revoke all on function public.engefex_save_state(uuid,bigint,jsonb) from public,anon;
grant execute on function public.engefex_save_state(uuid,bigint,jsonb) to authenticated;
-- Bucket privado: nenhum anexo pode ser lido sem autenticação e vínculo.
insert into storage.buckets(id,name,public,file_size_limit)
 values ('engefex-files','engefex-files',false,20000000);
-- Caminho de cada arquivo: <workspace UUID>/<file ID>.
create policy engefex_files_read on storage.objects for select to authenticated
 using (bucket_id='engefex-files' and exists (select 1 from public.engefex_members m
 where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid())));
create policy engefex_files_insert on storage.objects for insert to authenticated
 with check (bucket_id='engefex-files' and exists (select 1 from public.engefex_members m
 where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid())));
-- Arquivos imutáveis: alteração de foto gera novo ID. Evita substituição silenciosa.
-- Remoção física por administrador após conferir referências; excluir um registro
-- no app não apaga anexos ainda usados por outro registro.
commit;
