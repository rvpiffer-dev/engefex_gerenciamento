-- v4.18.31 — notificações persistentes e permissionadas de atualização dos estoques.
-- Aplicada à produção em 2026-10-24; manter no repositório para novas instalações.
create table if not exists public.engefex_stock_updates (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.engefex_workspaces(id) on delete cascade,
  stock_kind text not null check (stock_kind in ('nextarstock','paintstock','civilstock')),
  actor_id uuid,
  actor_name text not null default 'Usuário da equipe',
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists engefex_stock_updates_recent on public.engefex_stock_updates(workspace_id,created_at desc,id desc);
alter table public.engefex_stock_updates enable row level security;
revoke all on public.engefex_stock_updates from public,anon,authenticated;
grant select on public.engefex_stock_updates to authenticated;

create or replace function public.engefex_can_read_stock_update(p_workspace uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null
    and coalesce(engefex_private.level(p_workspace,(select auth.uid()),p_kind),0)>=1
$$;
revoke all on function public.engefex_can_read_stock_update(uuid,text) from public,anon;
grant execute on function public.engefex_can_read_stock_update(uuid,text) to authenticated;
drop policy if exists engefex_stock_updates_visible on public.engefex_stock_updates;
create policy engefex_stock_updates_visible on public.engefex_stock_updates for select to authenticated
using (public.engefex_can_read_stock_update(workspace_id,stock_kind));

create or replace function public.engefex_log_state_stock_updates()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_actor text;
begin
 select nullif(btrim(u.nome),'') into v_actor from public.engefex_usuarios u where u.id=new.updated_by limit 1;
 if old.payload->'paintStock' is distinct from new.payload->'paintStock' then
  insert into public.engefex_stock_updates(workspace_id,stock_kind,actor_id,actor_name,created_at)
  values(new.workspace_id,'paintstock',new.updated_by,coalesce(v_actor,'Usuário da equipe'),new.updated_at);
 end if;
 if old.payload->'civilStock' is distinct from new.payload->'civilStock' then
  insert into public.engefex_stock_updates(workspace_id,stock_kind,actor_id,actor_name,created_at)
  values(new.workspace_id,'civilstock',new.updated_by,coalesce(v_actor,'Usuário da equipe'),new.updated_at);
 end if;
 return new;
end;
$$;
drop trigger if exists engefex_log_state_stock_updates on public.engefex_state;
create trigger engefex_log_state_stock_updates after update of payload on public.engefex_state
for each row execute function public.engefex_log_state_stock_updates();

create or replace function public.engefex_log_nextar_stock_updates()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_actor text;
begin
 if tg_op='UPDATE' and old.snapshot is not distinct from new.snapshot then return new; end if;
 select nullif(btrim(u.nome),'') into v_actor from public.engefex_usuarios u where u.id=new.updated_by limit 1;
 insert into public.engefex_stock_updates(workspace_id,stock_kind,actor_id,actor_name,created_at)
 values(new.workspace_id,'nextarstock',new.updated_by,coalesce(v_actor,'Usuário da equipe'),new.updated_at);
 return new;
end;
$$;
drop trigger if exists engefex_log_nextar_stock_updates on public.engefex_nextar_inventory;
create trigger engefex_log_nextar_stock_updates after insert or update on public.engefex_nextar_inventory
for each row execute function public.engefex_log_nextar_stock_updates();
notify pgrst,'reload schema';
