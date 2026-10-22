-- Engefex v4.18.4: visibilidade e edicao do arquivo fiscal pelo modulo Contas a Pagar.
-- Idempotente. Mantem as demais permissoes inalteradas.
do $batch_permissions$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='engefex_private' and p.proname='owners'
    and pg_get_function_identity_arguments(p.oid)='p text[]';
  if definition is null then raise exception 'Funcao de permissoes nao encontrada'; end if;
  if position('when ''fiscalImports'' then array[''payables'']' in definition)>0 then return; end if;
  if position('when ''purchases'' then array[''supplies'']' in definition)=0
     or position('when ''costs'' then array[''payables'',''budget'']' in definition)=0 then
    raise exception 'Estrutura de permissoes mudou; revisar a migracao';
  end if;
  definition:=replace(definition,
    'when ''purchases'' then array[''supplies'']',
    'when ''purchases'' then array[''supplies'',''payables'']');
  definition:=replace(definition,
    'when ''costs'' then array[''payables'',''budget'']',
    'when ''costs'' then array[''payables'',''budget''] when ''fiscalImports'' then array[''payables'']');
  execute definition;
end;
$batch_permissions$;
