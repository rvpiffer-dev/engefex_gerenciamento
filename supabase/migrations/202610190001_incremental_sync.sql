-- Engefex v4.7.0 - envio incremental compatível com clientes antigos.
-- Executar uma vez no SQL Editor. Reexecutar é seguro.
-- Não migra, remove ou reordena registros existentes.
begin;
create or replace function public.engefex_patch_state(
 p_workspace uuid,p_revision bigint,p_changes jsonb
) returns table(revision bigint,updated_at timestamptz)
 language plpgsql security definer set search_path = '' as $$
declare
 v_payload jsonb;
 v_revision bigint;
 v_change jsonb;
 v_key text;
 v_array jsonb;
 v_prefix jsonb;
 v_suffix jsonb;
 v_start integer;
 v_delete integer;
 v_length integer;
begin
 if auth.uid() is null or not exists (
  select 1 from public.engefex_members m
  where m.workspace_id=p_workspace and m.user_id=auth.uid()
 ) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_revision is null or p_revision<0
 or jsonb_typeof(p_changes) is distinct from 'array' then
  raise exception 'Alterações inválidas' using errcode='22023';
 end if;
 if jsonb_array_length(p_changes)>1000 or octet_length(p_changes::text)>20000000 then
  raise exception 'Lote de alterações muito grande' using errcode='22023';
 end if;
 -- Trava a revisão antes de aplicar índices. Nenhuma alteração é feita se estiver antiga.
 select s.payload,s.revision into v_payload,v_revision
 from public.engefex_state s where s.workspace_id=p_workspace for update;
 if not found or v_revision<>p_revision then
  raise exception 'A base mudou. Recarregue antes de salvar.' using errcode='40001';
 end if;
 if v_payload is null then
  raise exception 'Base online não inicializada' using errcode='22023';
 end if;
 for v_change in select e.value from jsonb_array_elements(p_changes) e loop
  v_key:=v_change->>'key';
  if jsonb_typeof(v_change) is distinct from 'object' or v_key is null
  or v_key !~ '^[a-zA-Z][a-zA-Z0-9_]{0,63}$'
  or v_key in ('constructor','prototype','__proto__') then
   raise exception 'Campo de alteração inválido' using errcode='22023';
  end if;
  if v_change->'remove'='true'::jsonb then
   if v_change ? 'value' or v_change ? 'start' then
    raise exception 'Operação ambígua' using errcode='22023';
   end if;
   v_payload:=v_payload-v_key;
  elsif v_change ? 'value' then
   if v_change ? 'start' then raise exception 'Operação ambígua' using errcode='22023'; end if;
   v_payload:=jsonb_set(v_payload,array[v_key],v_change->'value',true);
  else
   if jsonb_typeof(v_change->'start') is distinct from 'number'
   or jsonb_typeof(v_change->'deleteCount') is distinct from 'number'
   or (v_change->>'start') !~ '^[0-9]{1,9}$'
   or (v_change->>'deleteCount') !~ '^[0-9]{1,9}$'
   or jsonb_typeof(v_change->'items') is distinct from 'array'
   or jsonb_typeof(v_payload->v_key) is distinct from 'array' then
    raise exception 'Operação de lista inválida' using errcode='22023';
   end if;
   v_start:=(v_change->>'start')::integer;
   v_delete:=(v_change->>'deleteCount')::integer;
   v_array:=v_payload->v_key;
   v_length:=jsonb_array_length(v_array);
   if v_start>v_length or v_delete>v_length-v_start then
    raise exception 'Índices de lista inválidos' using errcode='22023';
   end if;
   select coalesce(jsonb_agg(e.value order by e.n),'[]'::jsonb) into v_prefix
    from jsonb_array_elements(v_array) with ordinality e(value,n) where e.n<=v_start;
   select coalesce(jsonb_agg(e.value order by e.n),'[]'::jsonb) into v_suffix
    from jsonb_array_elements(v_array) with ordinality e(value,n) where e.n>v_start+v_delete;
   v_payload:=jsonb_set(v_payload,array[v_key],v_prefix||(v_change->'items')||v_suffix,false);
  end if;
 end loop;
 -- Reutiliza validação, limite de 20 MB, auditoria e compare-and-swap existentes.
 return query select saved.revision,saved.updated_at
 from public.engefex_save_state(p_workspace,p_revision,v_payload) saved;
end;
$$;
revoke all on function public.engefex_patch_state(uuid,bigint,jsonb) from public,anon;
grant execute on function public.engefex_patch_state(uuid,bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
