begin;
DO $test$
declare w uuid:=gen_random_uuid();a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();s jsonb;visible jsonb;n jsonb;rev bigint;r jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'acl-admin@example.invalid',now()),(u,'acl-user@example.invalid',now());
 insert into public.engefex_workspaces(id,name) values(w,'ACL verification rollback');
 insert into public.engefex_members(workspace_id,user_id) values(w,a),(w,u);
 insert into public.engefex_access(workspace_id,user_id,is_admin,permissions) values(w,a,true,'{"modules":{},"views":{}}'),(w,u,false,'{"modules":{"works":"edit","factory":"edit"},"views":{"diary":"edit","agenda":"none","activities":"none","timeline":"none","budget":"none","supplies":"none","measurements":"none","checklist":"none","issues":"none","responsibles":"none","documents":"none","teams":"none","fabrication":"none","factory-overview":"none","factory-data":"none","factory-quantities":"none","factory-preparation":"none","factory-progress":"view","factory-quality":"none"}}') on conflict(workspace_id,user_id) do update set is_admin=excluded.is_admin,permissions=excluded.permissions;
 s:='{"version":1,"dataModel":2,"projects":[{"id":"p","name":"Public name","code":"OB001","value":987654,"contract":"PRIVATE"}],"stages":[],"activities":[],"tasks":[],"calendarEvents":[],"budgetStages":[],"budgetItems":[],"quotes":[],"materials":[],"stockMoves":[],"purchases":[{"id":"SECRET-INVOICE","supplier":"Secret Supplier"}],"suppliers":[],"laborContracts":[],"measurements":[],"receipts":[],"receivableEntries":[],"fixedExpenses":[],"costs":[],"measurementForecastLinks":[],"issues":[],"responsibles":[],"checklists":[],"diary":[],"teams":[],"documents":[{"id":"d","name":"Secret Document","attachments":[{"id":"SECRET-FILE"}]}],"facts":[],"notifications":[],"factoryOrders":[],"history":[]}'::jsonb;
 insert into public.engefex_state(workspace_id,payload) values(w,s);
 perform set_config('request.jwt.claim.sub',u::text,true);
 if engefex_private.level(w,u,'diary')<>2 or engefex_private.level(w,u,'factory-progress')<>1 or engefex_private.full_read(w,u) then raise exception 'Level failed';end if;
 visible:=engefex_private.project_state(w,u,s);
 if visible::text like '%PRIVATE%' or visible::text like '%Secret%' or visible::text like '%987654%' then raise exception 'Projection leaked';end if;
 if engefex_private.file_access(w::text,'SECRET-FILE',false) then raise exception 'File leak';end if;
 denied:=false;begin perform public.engefex_list_access(w);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'List access bypass';end if;
 n:=jsonb_set(visible,'{diary}','[{"id":"day","project":"p","description":"Allowed"}]');
 select revision into rev from public.engefex_save_state(w,0,n);if rev<>1 then raise exception 'Allowed write failed';end if;
 select payload into s from public.engefex_state where workspace_id=w;
 if s->'projects'->0->>'contract'<>'PRIVATE' or jsonb_array_length(s->'purchases')<>1 or jsonb_array_length(s->'diary')<>1 then raise exception 'Hidden data overwritten';end if;
 visible:=engefex_private.project_state(w,u,s);
 n:=jsonb_set(visible,'{purchases}','[{"id":"attack"}]');denied:=false;begin perform public.engefex_save_state(w,1,n);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Hidden collection write bypass';end if;
 n:=jsonb_set(visible,'{diary,0,attachments}','[{"id":"SECRET-FILE"}]');denied:=false;begin perform public.engefex_save_state(w,1,n);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Attachment relinking bypass';end if;
 update public.engefex_access set permissions='{"modules":{"works":"view"},"views":{}}' where workspace_id=w and user_id=u;
 visible:=engefex_private.project_state(w,u,s);n:=jsonb_set(visible,'{diary,0,description}','"Forbidden"');denied:=false;begin perform public.engefex_save_state(w,1,n);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Read-only bypass';end if;

 update public.engefex_access set permissions='{"modules":{"factory":"edit"},"views":{"factory-data":"none","factory-quantities":"none","factory-preparation":"none","factory-quality":"none","factory-overview":"none","fabrication":"none"}}' where workspace_id=w and user_id=u;
 s:=jsonb_set(s,'{factoryOrders}','[{"id":"order","project":"p","owner":"Equipe","parts":[{"id":"part","name":"Pilar","planned":6}],"workflow":{"version":1,"profile":{"structureType":"PRIVATE","scope":"PRIVATE","drawing":"PRIVATE","steel":"PRIVATE","coating":"none","notes":"PRIVATE"},"routes":{"part":["cut","assembly"]},"ready":[{"id":"prep","status":"ok"}],"quality":[{"id":"quality","status":"ok","owner":"Inspetor","note":"Observação"}],"events":[{"id":"cut-event","part":"part","stage":"cut","quantity":6,"date":"2026-10-20","owner":"Operador","note":"Nota de produção"}],"closedAt":"","closedBy":"","qualityTemplateVersion":2}}]');
 update public.engefex_state set payload=s where workspace_id=w;
 visible:=engefex_private.project_state(w,u,s);if visible::text like '%PRIVATE%' then raise exception 'Factory profile leaked';end if;
 n:=jsonb_set(visible,'{factoryOrders,0,workflow,events}',(visible->'factoryOrders'->0->'workflow'->'events')||'{"id":"assembly-event","part":"part","stage":"assembly","quantity":6,"date":"2026-10-20","owner":"Operador"}'::jsonb);
 n:=jsonb_set(n,'{factoryOrders,0,updatedAt}','"2026-10-20T16:00:00Z"');
 select revision into rev from public.engefex_save_state(w,1,n);
 select payload into s from public.engefex_state where workspace_id=w;
 if s->'factoryOrders'->0->'workflow'->'profile'->>'notes'<>'PRIVATE' or s->'factoryOrders'->0->'workflow'->'quality'->0->>'status'<>'pending' then raise exception 'Factory merge/reset failed';end if;
 update public.engefex_access set permissions='{"modules":{"factory":"view"},"views":{"factory-progress":"none"}}' where workspace_id=w and user_id=u;
 visible:=engefex_private.project_state(w,u,s);if visible::text like '%Nota de produção%' then raise exception 'Factory event notes leaked';end if;
 n:=jsonb_set(visible,'{factoryOrders,0,workflow,events,0,quantity}','1');denied:=false;begin perform public.engefex_save_state(w,rev,n);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Production edit bypass';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if jsonb_array_length(public.engefex_list_access(w))<>2 then raise exception 'Admin listing failed';end if;

 denied:=false;begin perform public.engefex_set_access(w,a,1,'{"modules":{},"views":{}}');exception when others then denied:=true;end;if not denied then raise exception 'Admin lockout';end if;
 perform public.engefex_set_access(w,u,1,'{"modules":{"works":"view"},"views":{"diary":"edit"}}');
 if engefex_private.level(w,u,'diary')<>1 then raise exception 'Parent cap bypass';end if;
 denied:=false;begin perform public.engefex_set_access(w,u,1,'{"modules":{},"views":{}}');exception when serialization_failure then denied:=true;end;if not denied then raise exception 'Stale ACL overwrite';end if;
end $test$;
rollback;
select 'ACL security checks passed; all fixtures rolled back' as result;
