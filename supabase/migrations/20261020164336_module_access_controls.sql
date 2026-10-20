-- Permissões por módulo/tela. Dados continuam na mesma base; a leitura é projetada no servidor.
begin;
create schema if not exists engefex_private;
revoke all on schema engefex_private from public,anon,authenticated;
create table public.engefex_access (
 workspace_id uuid not null,user_id uuid not null,is_admin boolean not null default false,
 permissions jsonb not null default '{"modules":{},"views":{}}',revision bigint not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid,
 primary key(workspace_id,user_id),foreign key(workspace_id,user_id) references public.engefex_members(workspace_id,user_id) on delete cascade,
 check(jsonb_typeof(permissions)='object')
);
alter table public.engefex_access enable row level security;
revoke all on public.engefex_access from public,anon,authenticated;
create table engefex_private.access_audit(id uuid primary key default gen_random_uuid(),workspace_id uuid,user_id uuid,actor uuid,at timestamptz default now(),before_data jsonb,after_data jsonb);
alter table engefex_private.access_audit enable row level security;
revoke all on engefex_private.access_audit from public,anon,authenticated;
insert into public.engefex_access(workspace_id,user_id,is_admin,permissions)
 select m.workspace_id,m.user_id,lower(u.email)='admin@engefex.com' and u.email_confirmed_at is not null,
 '{"modules":{"core":"edit","works":"edit","finance":"edit","factory":"edit","nextar":"edit"},"views":{}}'::jsonb
 from public.engefex_members m join auth.users u on u.id=m.user_id on conflict do nothing;
create function engefex_private.catalog() returns jsonb language sql immutable set search_path='' as $$ select '[["core", "Principal", [["dashboard", "Visão geral"], ["projects", "Obras"], ["sharedcalendar", "Agenda compartilhada"]]], ["works", "Gerenciamento de obras", [["agenda", "Agenda do engenheiro"], ["activities", "Etapas e atividades"], ["timeline", "Cronograma"], ["budget", "Orçamento"], ["supplies", "Compras e notas / fornecedores / mão de obra"], ["measurements", "Medições e recebimentos"], ["checklist", "Checklist de execução"], ["issues", "Pendências e riscos"], ["responsibles", "Responsáveis"], ["diary", "Diário de obra"], ["documents", "Documentos e histórico"], ["teams", "Equipes e produtividade"]]], ["finance", "Financeiro", [["payables", "Contas a pagar"], ["receivables", "Contas a receber"], ["fixedexpenses", "Despesas gerais"]]], ["factory", "Fabricação", [["fabrication", "Fábrica por obra"], ["factory-overview", "Painel da fábrica"], ["factory-data", "Caracterização da obra"], ["factory-quantities", "Peças e quantidades"], ["factory-preparation", "Preparação da fabricação"], ["factory-progress", "Produção"], ["factory-quality", "Checklist de fabricação"]]]]'::jsonb $$;
create function engefex_private.module_for(v text) returns text language sql immutable set search_path='' as $$ select '{"dashboard": "core", "projects": "core", "sharedcalendar": "core", "agenda": "works", "activities": "works", "timeline": "works", "budget": "works", "supplies": "works", "measurements": "works", "checklist": "works", "issues": "works", "responsibles": "works", "diary": "works", "documents": "works", "teams": "works", "payables": "finance", "receivables": "finance", "fixedexpenses": "finance", "fabrication": "factory", "factory-overview": "factory", "factory-data": "factory", "factory-quantities": "factory", "factory-preparation": "factory", "factory-progress": "factory", "factory-quality": "factory", "nextarstock": "nextar"}'::jsonb->>v $$;
create function engefex_private.level(w uuid,u uuid,v text) returns integer language sql stable security definer set search_path='' as $$
 select case when a.is_admin then 2 else least(case a.permissions->'modules'->>engefex_private.module_for(v) when 'edit' then 2 when 'view' then 1 else 0 end,
 case coalesce(a.permissions->'views'->>v,a.permissions->'modules'->>engefex_private.module_for(v)) when 'edit' then 2 when 'view' then 1 else 0 end) end
 from public.engefex_access a join public.engefex_members m using(workspace_id,user_id) where a.workspace_id=w and a.user_id=u
$$;
create function engefex_private.any_level(w uuid,u uuid,vs text[],minimum integer) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(bool_or(coalesce(engefex_private.level(w,u,v),0)>=minimum),false) from unnest(vs) v $$;
create function engefex_private.is_admin(w uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select is_admin from public.engefex_access where workspace_id=w and user_id=u),false) and exists(select 1 from public.engefex_members where workspace_id=w and user_id=u) $$;
create function engefex_private.full_read(w uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce(bool_and(coalesce(engefex_private.level(w,u,v),0)>=1),false) from jsonb_object_keys('{"dashboard": "core", "projects": "core", "sharedcalendar": "core", "agenda": "works", "activities": "works", "timeline": "works", "budget": "works", "supplies": "works", "measurements": "works", "checklist": "works", "issues": "works", "responsibles": "works", "diary": "works", "documents": "works", "teams": "works", "payables": "finance", "receivables": "finance", "fixedexpenses": "finance", "fabrication": "factory", "factory-overview": "factory", "factory-data": "factory", "factory-quantities": "factory", "factory-preparation": "factory", "factory-progress": "factory", "factory-quality": "factory", "nextarstock": "nextar"}'::jsonb) v $$;
create function engefex_private.owners(p text[]) returns text[] language plpgsql immutable set search_path='' as $$
begin
 if p[1]='factoryOrders' then
  if array_length(p,1)<=2 then return array['factory-data'];end if;
  if p[3]='updatedAt' then return array['factory-data','factory-quantities','factory-preparation','factory-progress','factory-quality'];end if;
  if p[3] in ('parts') then
   if p[5] in ('prepared','fabricated','painted','released','shipped','received') then return array['factory-progress'];end if;
   return array['factory-quantities'];
  elsif p[3] in ('lots') then return array['factory-progress'];
  elsif p[3]='workflow' then
   if p[4]='profile' then return array['factory-data'];
   elsif p[4]='routes' then return array['factory-quantities'];
   elsif p[4]='ready' then return array['factory-preparation'];
   elsif p[4] in ('quality','qualityArchive','qualityTemplateVersion') then return array['factory-quality'];
   elsif p[4] in ('events','baselineResets','restartHistory') then return array['factory-progress'];
   elsif p[4] in ('closedAt','closedBy','reopenReason') then return array['factory-progress','factory-quality'];
   end if;
  end if;
  return array['factory-data'];
 end if;
 return case p[1]
 when 'projects' then array['projects'] when 'stages' then array['activities','timeline'] when 'activities' then array['activities','timeline']
 when 'tasks' then array['agenda'] when 'calendarEvents' then array['sharedcalendar']
 when 'budgetStages' then array['budget'] when 'budgetItems' then array['budget'] when 'quotes' then array['budget'] when 'materials' then array['budget'] when 'stockMoves' then array['budget']
 when 'purchases' then array['supplies'] when 'suppliers' then array['supplies'] when 'laborContracts' then array['supplies']
 when 'measurements' then array['measurements','receivables'] when 'receipts' then array['measurements','receivables'] when 'receivableEntries' then array['receivables'] when 'fixedExpenses' then array['fixedexpenses']
 when 'costs' then array['payables','budget'] when 'measurementForecastLinks' then array['measurements','timeline','budget']
 when 'issues' then array['issues'] when 'responsibles' then array['responsibles'] when 'checklists' then array['checklist'] when 'diary' then array['diary'] when 'teams' then array['teams']
 when 'documents' then array['documents'] when 'facts' then array['documents'] else array[]::text[] end;
end $$;
create function engefex_private.cost_read(w uuid,u uuid,c jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select engefex_private.any_level(w,u,array['payables','budget'],1) or (coalesce(c->>'purchase',c->>'laborContract','')<>'' and engefex_private.any_level(w,u,array['supplies'],1)) or (coalesce(c->>'fixedExpense','')<>'' and engefex_private.any_level(w,u,array['fixedexpenses'],1)) $$;
create function engefex_private.factory_read(w uuid,u uuid,o jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;wf jsonb;pr jsonb;prepared boolean;v text;
begin
 r:=jsonb_build_object('id',o->'id','project',o->'project','number',o->'number','owner',o->'owner','updatedAt',o->'updatedAt','parts','[]'::jsonb,'fields','[]'::jsonb,'preparation','[]'::jsonb,'shipping','[]'::jsonb,'lots','[]'::jsonb,'loads','[]'::jsonb);
 if engefex_private.any_level(w,u,array['factory-overview','factory-quantities','factory-progress','factory-quality'],1) then r:=r||jsonb_build_object('parts',coalesce(o->'parts','[]'),'lots',coalesce(o->'lots','[]'));end if;
 r:=r||jsonb_build_object('revision',coalesce(o->>'revision',''),'start',coalesce(o->>'start',''),'due',coalesce(o->>'due',''),'note',case when engefex_private.any_level(w,u,array['factory-data'],1) then coalesce(o->>'note','') else '' end,'attachments',case when engefex_private.any_level(w,u,array['factory-data'],1) then coalesce(o->'attachments','[]') else '[]'::jsonb end,'warnings','[]'::jsonb,'sourceName','');
 wf:=coalesce(o->'workflow','{}');pr:=wf->'profile';
 if not engefex_private.any_level(w,u,array['factory-data'],1) then
  prepared:=coalesce((select bool_and(coalesce(pr->>k,'')<>'') from unnest(array['structureType','scope','drawing','steel']) k),false);
  pr:=jsonb_build_object('structureType',case when prepared then 'Conferido' else '' end,'scope',case when prepared then 'Conferido' else '' end,'drawing',case when prepared then 'Conferido' else '' end,'steel',case when prepared then 'Conferido' else '' end,'coating',coalesce(pr->>'coating','none'),'color','','width','','length','','height','','notes','','roofTileType','','roofTileColor','','wallTileType','','wallTileColor','');
 end if;
 r:=r||jsonb_build_object('workflow',jsonb_build_object('version',1,'profile',pr,'routes',coalesce(wf->'routes','{}'),'events',case when engefex_private.any_level(w,u,array['factory-progress'],1) then coalesce(wf->'events','[]') when engefex_private.any_level(w,u,array['factory-overview','factory-quantities','factory-quality'],1) then coalesce((select jsonb_agg(jsonb_build_object('id',e->'id','part',e->'part','stage',e->'stage','quantity',e->'quantity','date',e->'date','owner','Produção','note','')) from jsonb_array_elements(coalesce(wf->'events','[]')) e),'[]') else '[]'::jsonb end,'ready',case when engefex_private.any_level(w,u,array['factory-preparation'],1) then wf->'ready' else jsonb_build_array(jsonb_build_object('id','ACCESS-READY','name','Preparação da fabricação','group','Preparação','status',case when not exists(select 1 from jsonb_array_elements(coalesce(wf->'ready','[]')) c where c->>'status' not in ('ok','na')) then 'ok' else 'pending' end,'owner','','note','')) end,'quality',case when engefex_private.any_level(w,u,array['factory-quality'],1) then coalesce(wf->'quality','[]') else jsonb_build_array(jsonb_build_object('id','ACCESS-QUALITY','name','Conferência da fabricação','group','Conferência','status','pending','owner','','note','')) end,'qualityTemplateVersion',2,'closedAt',coalesce(wf->>'closedAt',''),'closedBy',coalesce(wf->>'closedBy',''),'reopenReason',coalesce(wf->>'reopenReason',''),'baselineResets',coalesce(wf->'baselineResets','{}'),'restartHistory',case when engefex_private.any_level(w,u,array['factory-progress'],1) then coalesce((select jsonb_agg(x-'snapshot'-'quality') from jsonb_array_elements(coalesce(wf->'restartHistory','[]')) x),'[]') else '[]'::jsonb end));
 return r;
end $$;
create function engefex_private.project_state(w uuid,u uuid,s jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='{}';k text;arr jsonb;r jsonb;outarr jsonb;readit boolean;has_any boolean;
begin
 if engefex_private.full_read(w,u) then return s;end if;
 has_any:=exists(select 1 from jsonb_object_keys('{"dashboard": "core", "projects": "core", "sharedcalendar": "core", "agenda": "works", "activities": "works", "timeline": "works", "budget": "works", "supplies": "works", "measurements": "works", "checklist": "works", "issues": "works", "responsibles": "works", "diary": "works", "documents": "works", "teams": "works", "payables": "finance", "receivables": "finance", "fixedexpenses": "finance", "fabrication": "factory", "factory-overview": "factory", "factory-data": "factory", "factory-quantities": "factory", "factory-preparation": "factory", "factory-progress": "factory", "factory-quality": "factory", "nextarstock": "nextar"}'::jsonb) v where engefex_private.level(w,u,v)>=1);
 result:=jsonb_build_object('version',1,'dataModel',2,'materialsBudgetLinked',coalesce(s->'materialsBudgetLinked','true'::jsonb),'_accessFiltered',true);
 for k in select jsonb_object_keys(s) loop
  if k in ('version','dataModel') then continue;end if;
  if k='history' then result:=result||jsonb_build_object(k,'[]'::jsonb);continue;end if;
  if jsonb_typeof(s->k)<>'array' then continue;end if;
  outarr:='[]';
  for r in select value from jsonb_array_elements(s->k) loop
   readit:=engefex_private.any_level(w,u,engefex_private.owners(array[k]),1);
   if k='history' then readit:=false;
   elsif k='projects' then
    if not has_any then continue;end if;
    if not engefex_private.any_level(w,u,array['projects','dashboard','budget','measurements','payables','receivables'],1) then r:=jsonb_build_object('id',r->'id','name',r->'name','code',r->'code');end if;readit:=true;
   elsif k in ('stages','activities') and not readit and engefex_private.any_level(w,u,array['diary','issues','checklist','teams'],1) then
    r:=r-'sale'-'unitPrice'-'laborUnit'-'materialUnit'-'equipmentUnit';readit:=true;
   elsif k in ('budgetStages','budgetItems') and not readit then
    if engefex_private.any_level(w,u,array['measurements','receivables'],1) then readit:=true;
    elsif engefex_private.any_level(w,u,array['supplies','payables'],1) then r:=jsonb_build_object('id',r->'id','project',r->'project','stage',r->'stage','name',r->'name','code',r->'code','parent',r->'parent','unit',r->'unit','quantity',0,'executed',0,'unitPrice',0,'sale',0);readit:=true;end if;
   elsif k='costs' then readit:=engefex_private.cost_read(w,u,r);
   elsif k in ('purchases','laborContracts','suppliers') then readit:=readit or engefex_private.any_level(w,u,array['payables'],1);
   elsif k='fixedExpenses' then readit:=readit or engefex_private.any_level(w,u,array['payables'],1);
   elsif k='receipts' then readit:=engefex_private.any_level(w,u,array['receivables'],1) or (coalesce(r->>'receivableId','')='' and engefex_private.any_level(w,u,array['measurements','budget'],1));
   elsif k='measurements' then readit:=readit or engefex_private.any_level(w,u,array['budget'],1);
   elsif k='responsibles' then readit:=readit or engefex_private.any_level(w,u,array['issues','sharedcalendar'],1);
   elsif k='notifications' then readit:=engefex_private.any_level(w,u,array['issues'],1) and lower(r->>'recipientEmail')=lower((select email from auth.users where id=u));
   elsif k='factoryOrders' then
    readit:=engefex_private.any_level(w,u,array['fabrication','factory-overview','factory-data','factory-quantities','factory-preparation','factory-progress','factory-quality'],1);
    if readit then r:=engefex_private.factory_read(w,u,r);end if;
   end if;
   if readit then outarr:=outarr||jsonb_build_array(r);end if;
  end loop;
  result:=result||jsonb_build_object(k,outarr);
 end loop;
 return result;
end $$;
create function engefex_private.can_edit(w uuid,u uuid,p text[],oldstate jsonb,newstate jsonb,v jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare c jsonb;ok boolean;part text;
begin
 if engefex_private.is_admin(w,u) then return true;end if;
 if p[1]='materialsBudgetLinked' and v='true'::jsonb then return engefex_private.any_level(w,u,array['budget','supplies','activities','timeline','diary','factory-progress'],2);end if;
 if p[1] in ('version','dataModel','_accessFiltered','history','notifications') then return false;end if;
 if p[1]='activities' and p[3] in ('executed','actualStart','actualFinish') and engefex_private.any_level(w,u,array['diary'],2) then return true;end if;
 if p[1]='factoryOrders' and p[3]='workflow' and p[4]='quality' and p[6] in ('status','owner','checkedAt') and v in ('"pending"'::jsonb,'""'::jsonb) and engefex_private.any_level(w,u,array['factory-progress'],2) then return true;end if;
 if p[1]='factoryOrders' and array_length(p,1)=2 and not exists(select 1 from jsonb_array_elements(coalesce(oldstate->'factoryOrders','[]')) x where x->>'id'=p[2]) then
  if not engefex_private.any_level(w,u,array['factory-data'],2) or jsonb_array_length(coalesce(v->'parts','[]'))<>0 or jsonb_array_length(coalesce(v->'workflow'->'events','[]'))<>0 or exists(select 1 from jsonb_array_elements(coalesce(v->'workflow'->'ready','[]')||coalesce(v->'workflow'->'quality','[]')) x where x->>'status'<>'pending') then return false;end if;return true;
 end if;
 if p[1]='costs' then
  for c in select x from jsonb_array_elements(coalesce(oldstate->'costs','[]')||coalesce(newstate->'costs','[]')) x where x->>'id'=p[2] loop
   ok:=engefex_private.any_level(w,u,array['payables','budget'],2) or (coalesce(c->>'purchase',c->>'laborContract','')<>'' and engefex_private.any_level(w,u,array['supplies'],2)) or (coalesce(c->>'fixedExpense','')<>'' and engefex_private.any_level(w,u,array['fixedexpenses'],2));
   if not ok then return false;end if;
  end loop;
  return c is not null;
 end if;
 return engefex_private.any_level(w,u,engefex_private.owners(p),2);
end $$;
create function engefex_private.merge_delta(w uuid,u uuid,fullvalue jsonb,visible jsonb,nextvalue jsonb,p text[],oldstate jsonb,newstate jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;key text;entry jsonb;prior jsonb;actual jsonb;target jsonb;ids boolean;
begin
 if visible is not distinct from nextvalue then return fullvalue;end if;
 if jsonb_typeof(visible)='object' and jsonb_typeof(nextvalue)='object' then
  result:=coalesce(fullvalue,'{}');
  for key in select jsonb_object_keys(visible||nextvalue) loop
   if visible->key is not distinct from nextvalue->key then continue;end if;
   if array_length(p,1) is null and key in ('history','notifications','_accessFiltered') then continue;end if;
   target:=engefex_private.merge_delta(w,u,fullvalue->key,visible->key,nextvalue->key,p||key,oldstate,newstate);
   if target is null then result:=result-key;else result:=jsonb_set(result,array[key],target,true);end if;
  end loop;return result;
 end if;
 if jsonb_typeof(visible)='array' and jsonb_typeof(nextvalue)='array' and (jsonb_array_length(visible)>0 or jsonb_array_length(nextvalue)>0) then
  ids:=not exists(select 1 from jsonb_array_elements(visible||nextvalue) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')='');
  if ids then
   if (select count(*) from jsonb_array_elements(nextvalue))<>(select count(distinct x->>'id') from jsonb_array_elements(nextvalue) x) then raise exception 'IDs duplicados' using errcode='22023';end if;
   result:='[]';
   for actual in select value from jsonb_array_elements(coalesce(fullvalue,'[]')) loop
    select x into prior from jsonb_array_elements(visible) x where x->>'id'=actual->>'id';
    if prior is null then result:=result||jsonb_build_array(actual);continue;end if;
    select x into entry from jsonb_array_elements(nextvalue) x where x->>'id'=actual->>'id';
    target:=engefex_private.merge_delta(w,u,actual,prior,entry,p||(actual->>'id'),oldstate,newstate);
    if target is not null then result:=result||jsonb_build_array(target);end if;
   end loop;
   for entry in select value from jsonb_array_elements(nextvalue) x where not exists(select 1 from jsonb_array_elements(visible) z where z->>'id'=x.value->>'id') loop
    if exists(select 1 from jsonb_array_elements(coalesce(fullvalue,'[]')) z where z->>'id'=entry->>'id') then raise exception 'Registro não autorizado' using errcode='42501';end if;
    target:=engefex_private.merge_delta(w,u,null,null,entry,p||(entry->>'id'),oldstate,newstate);result:=result||jsonb_build_array(target);
   end loop;return result;
  end if;
 end if;
 if not engefex_private.can_edit(w,u,p,oldstate,newstate,nextvalue) then raise exception 'Sem permissão de edição nesta área: %',array_to_string(p,' / ') using errcode='42501';end if;
 return nextvalue;
end $$;
create function engefex_private.financial_signature(s jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by key),'[]') from (select coalesce(x->>'purchase','')||'/'||coalesce(x->>'purchaseInstallment','')||'/'||coalesce(x->>'laborMeasurement','')||'/'||coalesce(x->>'fixedExpense','')||'/'||case when coalesce(x->>'purchase',x->>'laborContract',x->>'fixedExpense','')='' then x->>'id' else '' end as key,
 sum(coalesce((x->>'paid')::numeric,0)) paid,sum(coalesce((x->>'incurred')::numeric,0)) incurred,sum(coalesce((x->>'paymentDiscount')::numeric,0)) discount,sum(coalesce((x->>'paymentAddition')::numeric,0)) addition,max(x->>'paidDate') paid_date
 from jsonb_array_elements(coalesce(s->'costs','[]')) x where coalesce((x->>'paid')::numeric,0)<>0 or coalesce((x->>'incurred')::numeric,0)<>0 or coalesce((x->>'paymentDiscount')::numeric,0)<>0 or coalesce((x->>'paymentAddition')::numeric,0)<>0 group by 1) t $$;
create function engefex_private.file_ids(s jsonb) returns setof text language sql immutable set search_path='' as $$
 select distinct value#>>'{}' from (select jsonb_path_query(s,'$.**.attachments[*].id') as value union all select jsonb_path_query(s,'$.**.photos[*].id')) refs where jsonb_typeof(value)='string' $$;
create or replace function public.engefex_save_state(p_workspace uuid,p_revision bigint,p_payload jsonb) returns table(revision bigint,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare oldrow public.engefex_state%rowtype;merged jsonb;visible jsonb;event jsonb;orders jsonb:='[]';o jsonb;prior jsonb;c jsonb;notifs jsonb:='[]';candidate jsonb;email text;file_id text;
begin
 if auth.uid() is null or not exists(select 1 from public.engefex_members where workspace_id=p_workspace and user_id=auth.uid()) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'version' is distinct from '1' or p_payload->>'dataModel' is distinct from '2' or jsonb_typeof(p_payload->'projects') is distinct from 'array' or octet_length(p_payload::text)>20000000 then raise exception 'Base de dados inválida' using errcode='22023';end if;
 select * into oldrow from public.engefex_state s where s.workspace_id=p_workspace for update;
 if not found or oldrow.revision<>p_revision then raise exception 'A base mudou. Recarregue antes de salvar.' using errcode='40001';end if;
 if engefex_private.is_admin(p_workspace,auth.uid()) then merged:=p_payload-'_accessFiltered';
 else
  visible:=engefex_private.project_state(p_workspace,auth.uid(),oldrow.payload);
  merged:=engefex_private.merge_delta(p_workspace,auth.uid(),oldrow.payload,visible,p_payload,array[]::text[],oldrow.payload,p_payload);
  -- Referenciar um ID de arquivo de outra área não concede acesso ao arquivo.
  for file_id in select f from engefex_private.file_ids(p_payload) f where not exists(select 1 from engefex_private.file_ids(visible) old_id where old_id=f) loop
   if exists(select 1 from engefex_private.file_ids(oldrow.payload) old_id where old_id=file_id) or not exists(select 1 from storage.objects obj where obj.bucket_id='engefex-files' and obj.name=p_workspace::text||'/'||file_id and coalesce(obj.owner_id,obj.owner::text)=auth.uid()::text) then raise exception 'Anexo não autorizado para este registro' using errcode='42501';end if;
  end loop;
  -- Invalidar a conferência final é uma consequência da mudança da produção.
  for o in select value from jsonb_array_elements(coalesce(merged->'factoryOrders','[]')) loop
   select x into prior from jsonb_array_elements(coalesce(oldrow.payload->'factoryOrders','[]')) x where x->>'id'=o->>'id';
   if prior is not null and prior->'workflow'->'events' is distinct from o->'workflow'->'events' then
    o:=jsonb_set(o,'{workflow,quality}',coalesce((select jsonb_agg(x||'{"status":"pending","owner":"","checkedAt":""}'::jsonb) from jsonb_array_elements(coalesce(o->'workflow'->'quality','[]')) x),'[]'));
   end if;orders:=orders||jsonb_build_array(o);
  end loop;
  if merged?'factoryOrders' then merged:=jsonb_set(merged,'{factoryOrders}',orders);end if;
  email:=lower((select u.email from auth.users u where u.id=auth.uid()));
  for c in select value from jsonb_array_elements(coalesce(oldrow.payload->'notifications','[]')) loop
   select x into candidate from jsonb_array_elements(coalesce(p_payload->'notifications','[]')) x where x->>'id'=c->>'id';
   if candidate is not null and lower(c->>'recipientEmail')=email and c-'readBy'=candidate-'readBy' and not exists(select 1 from jsonb_array_elements_text(coalesce(candidate->'readBy','[]')) x where x<>email and not coalesce(c->'readBy','[]')?x) then c:=jsonb_set(c,'{readBy}',coalesce(candidate->'readBy','[]'));end if;
   notifs:=notifs||jsonb_build_array(c);
  end loop;
  if engefex_private.any_level(p_workspace,auth.uid(),array['issues'],2) then
   for c in select value from jsonb_array_elements(coalesce(p_payload->'notifications','[]')) loop
    if not exists(select 1 from jsonb_array_elements(notifs) x where x->>'id'=c->>'id') and exists(select 1 from jsonb_array_elements(coalesce(merged->'issues','[]')) i where i->>'id'=c->>'issueId' and i->>'project'=c->>'project') then notifs:=jsonb_build_array(c)||notifs;end if;
   end loop;
  end if;
  if oldrow.payload?'notifications' then merged:=jsonb_set(merged,'{notifications}',notifs);end if;
  if not exists(select 1 from jsonb_object_keys('{"dashboard": "core", "projects": "core", "sharedcalendar": "core", "agenda": "works", "activities": "works", "timeline": "works", "budget": "works", "supplies": "works", "measurements": "works", "checklist": "works", "issues": "works", "responsibles": "works", "diary": "works", "documents": "works", "teams": "works", "payables": "finance", "receivables": "finance", "fixedexpenses": "finance", "fabrication": "factory", "factory-overview": "factory", "factory-data": "factory", "factory-quantities": "factory", "factory-preparation": "factory", "factory-progress": "factory", "factory-quality": "factory", "nextarstock": "nextar"}'::jsonb) v where engefex_private.level(p_workspace,auth.uid(),v)=2) and coalesce(oldrow.payload->'notifications','[]')=notifs then raise exception 'Usuário sem permissão de edição' using errcode='42501';end if;
  if not engefex_private.any_level(p_workspace,auth.uid(),array['payables','budget'],2) and engefex_private.financial_signature(oldrow.payload) is distinct from engefex_private.financial_signature(merged) then raise exception 'Rateio deve preservar os pagamentos. Para alterar baixas é necessária permissão de edição no financeiro.' using errcode='42501';end if;
  event:=jsonb_build_object('id',gen_random_uuid(),'time',clock_timestamp(),'kind','scopedChange','record','','action','Alteração com permissões verificadas','actor',auth.uid());
  merged:=jsonb_set(merged,'{history}',jsonb_build_array(event)||coalesce((select jsonb_agg(x||jsonb_build_object('actor',auth.uid())) from jsonb_array_elements(coalesce(p_payload->'history','[]')) x where engefex_private.any_level(p_workspace,auth.uid(),array['projects','sharedcalendar','agenda','activities','timeline','budget','supplies','measurements','checklist','issues','responsibles','diary','documents','teams','payables','receivables','fixedexpenses','factory-data','factory-quantities','factory-preparation','factory-progress','factory-quality'],2) and not exists(select 1 from jsonb_array_elements(coalesce(oldrow.payload->'history','[]')) h where h->>'id'=x->>'id')),'[]')||coalesce(oldrow.payload->'history','[]'));
 end if;
 if octet_length(merged::text)>20000000 then raise exception 'Base excede 20 MB' using errcode='22023';end if;
 return query update public.engefex_state s set payload=merged,revision=s.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where s.workspace_id=p_workspace returning s.revision,s.updated_at;
end $$;
create function public.engefex_access_context(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.engefex_access%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.engefex_members where workspace_id=p_workspace and user_id=auth.uid()) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select * into a from public.engefex_access where workspace_id=p_workspace and user_id=auth.uid();
 return jsonb_build_object('is_admin',coalesce(a.is_admin,false),'permissions',coalesce(a.permissions,'{"modules":{},"views":{}}'),'revision',coalesce(a.revision,0),'restricted',not engefex_private.full_read(p_workspace,auth.uid()));
end $$;
create function public.engefex_read_state(p_workspace uuid,p_head boolean default false) returns table(revision bigint,updated_at timestamptz,payload jsonb) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.engefex_members where workspace_id=p_workspace and user_id=auth.uid()) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 return query select s.revision,s.updated_at,case when p_head then null else engefex_private.project_state(p_workspace,auth.uid(),s.payload) end from public.engefex_state s where s.workspace_id=p_workspace;
end $$;
create function public.engefex_list_access(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not engefex_private.is_admin(p_workspace,auth.uid()) then raise exception 'Somente o administrador pode gerenciar acessos' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'is_admin',coalesce(a.is_admin,false),'permissions',coalesce(a.permissions,'{"modules":{},"views":{}}'),'revision',coalesce(a.revision,0)) order by u.email),'[]') from public.engefex_members m join auth.users u on u.id=m.user_id left join public.engefex_access a using(workspace_id,user_id) where m.workspace_id=p_workspace);
end $$;
create function public.engefex_set_access(p_workspace uuid,p_user uuid,p_revision bigint,p_permissions jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare before_row public.engefex_access%rowtype;after_row public.engefex_access%rowtype;key text;value jsonb;
begin
 if not engefex_private.is_admin(p_workspace,auth.uid()) then raise exception 'Somente o administrador pode gerenciar acessos' using errcode='42501';end if;
 if not exists(select 1 from public.engefex_members where workspace_id=p_workspace and user_id=p_user) then raise exception 'Usuário não vinculado a esta área de trabalho';end if;
 perform 1 from public.engefex_workspaces where id=p_workspace for update;
 select * into before_row from public.engefex_access where workspace_id=p_workspace and user_id=p_user;
 if before_row.is_admin or p_user=auth.uid() then raise exception 'O acesso do administrador é preservado para evitar bloqueio';end if;
 if coalesce(before_row.revision,0)<>p_revision then raise exception 'As permissões mudaram. Atualize a lista.' using errcode='40001';end if;
 if jsonb_typeof(p_permissions) is distinct from 'object' or jsonb_typeof(p_permissions->'modules') is distinct from 'object' or jsonb_typeof(p_permissions->'views') is distinct from 'object' or (p_permissions-'modules'-'views')<>'{}' then raise exception 'Permissões inválidas' using errcode='22023';end if;
 for key,value in select * from jsonb_each(p_permissions->'modules') loop
  if key not in ('core','works','finance','factory','nextar') or value not in ('"none"'::jsonb,'"view"'::jsonb,'"edit"'::jsonb) then raise exception 'Permissão de módulo inválida';end if;
 end loop;
 for key,value in select * from jsonb_each(p_permissions->'views') loop
  if engefex_private.module_for(key) is null or value not in ('"none"'::jsonb,'"view"'::jsonb,'"edit"'::jsonb) then raise exception 'Permissão de tela inválida';end if;
 end loop;
 insert into public.engefex_access(workspace_id,user_id,permissions,revision,updated_by) values(p_workspace,p_user,p_permissions,1,auth.uid()) on conflict(workspace_id,user_id) do update set permissions=excluded.permissions,revision=engefex_access.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() returning * into after_row;
 insert into engefex_private.access_audit(workspace_id,user_id,actor,before_data,after_data) values(p_workspace,p_user,auth.uid(),to_jsonb(before_row),to_jsonb(after_row));
 return to_jsonb(after_row);
end $$;
drop policy engefex_state_read on public.engefex_state;
create policy engefex_state_read on public.engefex_state for select to authenticated using(engefex_private.full_read(workspace_id,(select auth.uid())));
-- Policy helper needs schema USAGE, but no private function is exposed through PostgREST.
grant usage on schema engefex_private to authenticated;
revoke all on all functions in schema engefex_private from public,anon,authenticated;
grant execute on function engefex_private.full_read(uuid,uuid) to authenticated;
create function engefex_private.file_access(w text,file_id text,writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare workspace uuid;s jsonb;
begin
 begin workspace:=w::uuid;exception when invalid_text_representation then return false;end;
 if auth.uid() is null or not exists(select 1 from public.engefex_members where workspace_id=workspace and user_id=auth.uid()) then return false;end if;
 if writing then return exists(select 1 from jsonb_object_keys('{"dashboard": "core", "projects": "core", "sharedcalendar": "core", "agenda": "works", "activities": "works", "timeline": "works", "budget": "works", "supplies": "works", "measurements": "works", "checklist": "works", "issues": "works", "responsibles": "works", "diary": "works", "documents": "works", "teams": "works", "payables": "finance", "receivables": "finance", "fixedexpenses": "finance", "fabrication": "factory", "factory-overview": "factory", "factory-data": "factory", "factory-quantities": "factory", "factory-preparation": "factory", "factory-progress": "factory", "factory-quality": "factory", "nextarstock": "nextar"}'::jsonb) v where engefex_private.level(workspace,auth.uid(),v)=2);end if;
 if engefex_private.full_read(workspace,auth.uid()) then return true;end if;
 select engefex_private.project_state(workspace,auth.uid(),payload) into s from public.engefex_state where workspace_id=workspace;
 return jsonb_path_exists(s,'$.**.attachments[*] ? (@.id == $file)',jsonb_build_object('file',file_id)) or jsonb_path_exists(s,'$.**.photos[*] ? (@.id == $file)',jsonb_build_object('file',file_id));
end $$;
revoke all on function engefex_private.file_access(text,text,boolean) from public,anon;
grant execute on function engefex_private.file_access(text,text,boolean) to authenticated;
drop policy engefex_files_read on storage.objects;
create policy engefex_files_read on storage.objects for select to authenticated using(bucket_id='engefex-files' and engefex_private.file_access((storage.foldername(name))[1],storage.filename(name),false));
drop policy engefex_files_insert on storage.objects;
create policy engefex_files_insert on storage.objects for insert to authenticated with check(bucket_id='engefex-files' and engefex_private.file_access((storage.foldername(name))[1],storage.filename(name),true));
revoke all on function public.engefex_access_context(uuid),public.engefex_read_state(uuid,boolean),public.engefex_list_access(uuid),public.engefex_set_access(uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.engefex_access_context(uuid),public.engefex_read_state(uuid,boolean),public.engefex_list_access(uuid),public.engefex_set_access(uuid,uuid,bigint,jsonb) to authenticated;
create function engefex_private.provision_member_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.engefex_access(workspace_id,user_id,is_admin) select new.workspace_id,new.user_id,lower(email)='admin@engefex.com' and email_confirmed_at is not null from auth.users where id=new.user_id on conflict do nothing;return new;
end $$;
revoke all on function engefex_private.provision_member_access() from public,anon,authenticated;
create trigger engefex_member_access after insert on public.engefex_members for each row execute function engefex_private.provision_member_access();

commit;
