-- Corrige a projeção de RH para usuários com permissão específica.
-- Mantém os registros existentes e não libera dados a quem não possui acesso.
do $migration$
declare d text;
begin
 if engefex_private.module_for('hr') <> 'hr' then
   raise exception 'Módulo RH não registrado nas permissões';
 end if;
 d:=pg_get_functiondef('engefex_private.owners(text[])'::regprocedure);
 if position('hrEmployees' in d)=0 then
   d:=replace(d, 'when ''documents'' then', 'when ''hrEmployees'' then array[''hr''] when ''hrDocuments'' then array[''hr''] when ''hrSettings'' then array[''hr''] when ''documents'' then');
   if position('hrEmployees' in d)=0 then raise exception 'Função owners inesperada';end if;
   execute d;
 end if;
 d:=pg_get_functiondef('engefex_private.full_read(uuid,uuid)'::regprocedure);
 if position('"hr": "hr"' in d)=0 then
   d:=replace(d,'"nextarstock": "nextar"','"nextarstock": "nextar", "hr": "hr"');
   if position('"hr": "hr"' in d)=0 then raise exception 'Função full_read inesperada';end if;
   execute d;
 end if;
 d:=pg_get_functiondef('engefex_private.project_state(uuid,uuid,jsonb)'::regprocedure);
 if position('k=''hrSettings''' in d)=0 then
   d:=replace(d, 'if jsonb_typeof(s->k)<>''array'' then continue;end if;', 'if k=''hrSettings'' then if engefex_private.any_level(w,u,array[''hr''],1) then result:=result||jsonb_build_object(k,s->k);end if;continue;end if; if jsonb_typeof(s->k)<>''array'' then continue;end if;');
   if position('k=''hrSettings''' in d)=0 then raise exception 'Função project_state inesperada';end if;
   execute d;
 end if;
end $migration$;
