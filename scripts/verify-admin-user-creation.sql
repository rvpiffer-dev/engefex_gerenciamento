begin;
do $verify$
declare w uuid:=gen_random_uuid();a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();request uuid:=gen_random_uuid();reset_request uuid:=gen_random_uuid();denied boolean; i integer;
begin
 if has_function_privilege('anon','public.engefex_admin_user_guard(uuid,uuid,uuid,uuid)','execute') or has_function_privilege('authenticated','public.engefex_admin_register_user(uuid,uuid,uuid,uuid,uuid,text)','execute') then raise exception 'Privileged RPC exposed';end if;
 insert into auth.users(id,email,email_confirmed_at,created_at) values(a,'admin-create-verify@example.invalid',now(),now()),(u,'new-create-verify@example.invalid',now(),now());
 insert into auth.sessions(id,user_id,created_at,not_after) values(s,a,now(),now()+interval '1 hour');
 insert into public.engefex_workspaces(id,name) values(w,'User creation verification rollback');
 insert into public.engefex_members(workspace_id,user_id) values(w,a);
 update public.engefex_access set is_admin=true where workspace_id=w and user_id=a;
 denied:=false;begin perform public.engefex_admin_user_guard(w,u,s,gen_random_uuid());exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Non-admin bypass';end if;
 denied:=false;begin perform public.engefex_admin_user_guard(w,a,gen_random_uuid(),gen_random_uuid());exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Session bypass';end if;
 perform public.engefex_admin_user_guard(w,a,s,request);
 perform public.engefex_admin_register_user(w,a,s,request,u,'Novo usuário');
 if not exists(select 1 from public.engefex_members where workspace_id=w and user_id=u) then raise exception 'Membership absent';end if;
 if to_regclass('public.engefex_usuarios') is not null then
 if not exists(select 1 from public.engefex_usuarios where id=u and ativo and nome='Novo usuário') then raise exception 'Profile missing';end if;end if;
 if not exists(select 1 from public.engefex_access where workspace_id=w and user_id=u and not is_admin and permissions='{"modules":{},"views":{}}'::jsonb) then raise exception 'Default access not closed';end if;
 if not exists(select 1 from engefex_private.user_creation_audit where request_id=request and completed_at is not null and user_id=u) then raise exception 'Audit missing';end if;
 denied:=false;begin perform public.engefex_admin_password_guard(w,a,s,gen_random_uuid(),a);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Admin password bypass';end if;
 perform public.engefex_admin_password_guard(w,a,s,reset_request,u);
 perform public.engefex_admin_password_complete(w,a,s,reset_request,u);
 if not exists(select 1 from engefex_private.user_creation_audit where request_id=reset_request and action='reset_password' and user_id=u and completed_at is not null) then raise exception 'Reset audit missing';end if;
 for i in 1..3 loop perform public.engefex_admin_user_guard(w,a,s,gen_random_uuid());end loop;
 denied:=false;begin perform public.engefex_admin_user_guard(w,a,s,gen_random_uuid());exception when raise_exception then denied:=true;end;if not denied then raise exception 'Rate limit bypass';end if;
 update auth.sessions set not_after=now()-interval '1 minute' where id=s;
 denied:=false;begin perform engefex_private.assert_user_admin(w,a,s);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked session bypass';end if;
end $verify$;
rollback;
select 'Cadastro validado: admin, sessão, vínculo, perfil, acesso inicial, auditoria e limite; sem dados de teste persistidos.' as result;
