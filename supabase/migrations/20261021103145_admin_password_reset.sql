alter table engefex_private.user_creation_audit add column action text not null default 'create' check(action in ('create','reset_password'));
create function public.engefex_admin_password_guard(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform engefex_private.assert_user_admin(p_workspace,p_actor,p_session);
 if p_user=p_actor or not exists(select 1 from public.engefex_members m join public.engefex_access a using(workspace_id,user_id) where m.workspace_id=p_workspace and m.user_id=p_user and not a.is_admin) then raise exception 'Conta não autorizada para redefinição' using errcode='42501';end if;
 perform public.engefex_admin_user_guard(p_workspace,p_actor,p_session,p_request);
 update engefex_private.user_creation_audit set action='reset_password',user_id=p_user where request_id=p_request;
end $$;
create function public.engefex_admin_password_complete(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform engefex_private.assert_user_admin(p_workspace,p_actor,p_session);
 perform 1 from engefex_private.user_creation_audit where request_id=p_request and workspace_id=p_workspace and actor_id=p_actor and user_id=p_user and action='reset_password' and completed_at is null and created_at>now()-interval '5 minutes' for update;
 if not found then raise exception 'Solicitação inválida' using errcode='42501';end if;
 if not exists(select 1 from public.engefex_access where workspace_id=p_workspace and user_id=p_user and not is_admin) then raise exception 'Conta protegida' using errcode='42501';end if;
 update engefex_private.user_creation_audit set completed_at=now() where request_id=p_request;
end $$;
revoke all on function public.engefex_admin_password_guard(uuid,uuid,uuid,uuid,uuid),public.engefex_admin_password_complete(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.engefex_admin_password_guard(uuid,uuid,uuid,uuid,uuid),public.engefex_admin_password_complete(uuid,uuid,uuid,uuid,uuid) to service_role;
