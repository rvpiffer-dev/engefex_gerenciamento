-- Exportação administrativa de recuperação, somente leitura.
-- Este pacote NÃO substitui pg_dump/pg_restore: não exporta senhas, sessões ou toda a configuração do Auth.
create or replace function public.engefex_admin_recovery_export(
 p_workspace uuid, p_section text, p_offset integer default 0, p_limit integer default 50
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
 v_tables constant text[] := ARRAY['public.engefex_workspaces','public.engefex_usuarios','public.engefex_members','public.engefex_access','public.engefex_state','public.engefex_nextar_inventory','engefex_private.access_audit','engefex_private.user_creation_audit','engefex_private.rh_reset_backups','engefex_private.hr_vacation_import_backups','engefex_private.release_safety_snapshots']::text[];
 v_schema text;
 v_table text;
 v_rows jsonb;
begin
 if auth.uid() is null or not exists (
   select 1 from public.engefex_access a
   where a.workspace_id=p_workspace and a.user_id=auth.uid() and a.is_admin is true
 ) then
   raise exception 'Somente o administrador pode exportar a recuperação.' using errcode='42501';
 end if;
 if p_section='authorize' then return '{"authorized":true}'::jsonb; end if;
 if p_section='manifest' then
   return jsonb_build_object(
     'format','engefex-recovery-v1',
     'workspace',p_workspace,
     'revision',(select revision from public.engefex_state where workspace_id=p_workspace),
     'capturedAt',clock_timestamp(),
     'tables',to_jsonb(v_tables),
     'files',coalesce((select jsonb_agg(jsonb_build_object('path',name,'size',coalesce(metadata->>'size','0')) order by name) from storage.objects where bucket_id='engefex-files' and name like p_workspace::text||'/%'),'[]'::jsonb),
     'limitations',jsonb_build_array('Nao e um pg_dump','Sem hashes de senhas ou sessoes do Auth','GitHub ZIP nao inclui historico git','Dados exportados em multiplas leituras')
   );
 end if;
 if p_offset<0 or p_limit<1 or p_limit>50 then
   raise exception 'Paginação inválida' using errcode='22023';
 end if;
 if p_section='auth_users' then
   return coalesce((
     select jsonb_agg(to_jsonb(t)) from (
       select u.id,u.email,u.created_at,u.email_confirmed_at,u.raw_app_meta_data,u.raw_user_meta_data
       from auth.users u
       where exists(select 1 from public.engefex_members m where m.workspace_id=p_workspace and m.user_id=u.id)
       order by u.id limit p_limit offset p_offset
     ) t
   ),'[]'::jsonb);
 end if;
 if not p_section=any(v_tables) then
   raise exception 'Seção desconhecida' using errcode='22023';
 end if;
 v_schema:=split_part(p_section,'.',1);
 v_table:=split_part(p_section,'.',2);
 execute format(
   'select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from (select * from %I.%I order by 1 limit $1 offset $2) t',
   v_schema,v_table
 ) into v_rows using p_limit,p_offset;
 return v_rows;
end;
$function$;
revoke all on function public.engefex_admin_recovery_export(uuid,text,integer,integer) from public,anon;
grant execute on function public.engefex_admin_recovery_export(uuid,text,integer,integer) to authenticated;
