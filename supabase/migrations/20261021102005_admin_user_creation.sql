-- Cadastro pelo administrador. RPCs auxiliares acessíveis somente à Edge Function.
create table engefex_private.user_creation_audit (
 request_id uuid primary key,
 workspace_id uuid not null references public.engefex_workspaces(id),
 actor_id uuid not null,
 user_id uuid,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index user_creation_actor_time on engefex_private.user_creation_audit(actor_id,created_at desc);
alter table engefex_private.user_creation_audit enable row level security;
revoke all on engefex_private.user_creation_audit from public,anon,authenticated;

create function engefex_private.assert_user_admin(w uuid,a uuid,s uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not engefex_private.is_admin(w,a) or not exists(select 1 from auth.sessions where id=s and user_id=a and (not_after is null or not_after>now())) then raise exception 'Administrador com sessão ativa obrigatório' using errcode='42501';end if;
end $$;
revoke all on function engefex_private.assert_user_admin(uuid,uuid,uuid) from public,anon,authenticated;

create function public.engefex_admin_user_guard(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform engefex_private.assert_user_admin(p_workspace,p_actor,p_session);
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 if (select count(*) from engefex_private.user_creation_audit where actor_id=p_actor and created_at>now()-interval '1 minute')>=5 or (select count(*) from engefex_private.user_creation_audit where actor_id=p_actor and created_at>now()-interval '1 day')>=50 then raise exception 'Limite de cadastros';end if;
 insert into engefex_private.user_creation_audit(request_id,workspace_id,actor_id) values(p_request,p_workspace,p_actor);
end $$;

create function public.engefex_admin_register_user(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid,p_user uuid,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt engefex_private.user_creation_audit%rowtype; target auth.users%rowtype;
begin
 perform engefex_private.assert_user_admin(p_workspace,p_actor,p_session);
 select * into attempt from engefex_private.user_creation_audit where request_id=p_request and workspace_id=p_workspace and actor_id=p_actor and completed_at is null and created_at>now()-interval '5 minutes' for update;
 if not found then raise exception 'Solicitação de cadastro inválida' using errcode='42501';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'Nome inválido';end if;
 select * into target from auth.users where id=p_user and email_confirmed_at is not null and created_at>=attempt.created_at-interval '5 seconds';
 if not found or exists(select 1 from public.engefex_members where user_id=p_user) then raise exception 'Somente uma nova conta pode ser vinculada';end if;
 insert into public.engefex_usuarios(id,nome,email,perfil,ativo) values(p_user,trim(p_name),target.email,'funcionario',true) on conflict(id) do update set nome=excluded.nome,email=excluded.email,ativo=true,atualizado_em=now();
 insert into public.engefex_members(workspace_id,user_id) values(p_workspace,p_user);
 -- O gatilho existente cria a matriz sem acesso. Nunca promover uma conta a administrador.
 if not exists(select 1 from public.engefex_access where workspace_id=p_workspace and user_id=p_user and is_admin=false and permissions='{"modules":{},"views":{}}'::jsonb) then raise exception 'Permissão inicial inesperada';end if;
 update engefex_private.user_creation_audit set user_id=p_user,completed_at=now() where request_id=p_request;
 return jsonb_build_object('id',p_user,'email',target.email);
end $$;
revoke all on function public.engefex_admin_user_guard(uuid,uuid,uuid,uuid),public.engefex_admin_register_user(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.engefex_admin_user_guard(uuid,uuid,uuid,uuid),public.engefex_admin_register_user(uuid,uuid,uuid,uuid,uuid,text) to service_role;
