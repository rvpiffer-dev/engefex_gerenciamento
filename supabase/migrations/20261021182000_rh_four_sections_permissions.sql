-- Permissões para as quatro telas do RH; preservar os acessos preexistentes.
do $m$
declare d text;
begin
 d:=pg_get_functiondef('engefex_private.module_for(text)'::regprocedure);
 if position('hr-employees' in d)=0 then d:=replace(d, 'WHEN v=''hr'' THEN ''hr''','WHEN v IN (''hr'',''hr-employees'',''hr-documents'',''hr-vacations'',''hr-payroll'') THEN ''hr''');execute d;end if;
 d:=pg_get_functiondef('engefex_private.owners(text[])'::regprocedure);
 if position('hrVacations' in d)=0 then
  d:=replace(d, 'when ''hrEmployees'' then', 'when ''hrVacations'' then array[''hr-vacations''] when ''hrPayroll'' then array[''hr-payroll''] when ''hrEmployees'' then');
  d:=replace(d, 'when ''hrEmployees'' then array[''hr'']', 'when ''hrEmployees'' then array[''hr-employees'']');
  d:=replace(d, 'when ''hrDocuments'' then array[''hr'']', 'when ''hrDocuments'' then array[''hr-documents'']');
  d:=replace(d, 'when ''hrSettings'' then array[''hr'']', 'when ''hrSettings'' then array[''hr-documents'']');
  execute d;
 end if;
 d:=pg_get_functiondef('engefex_private.project_state(uuid,uuid,jsonb)'::regprocedure);
 if position('array[''hr''],1' in d)>0 then d:=replace(d,'array[''hr''],1','array[''hr-documents''],1');execute d;end if;
 update public.engefex_access set permissions=jsonb_set(permissions,'{views}',coalesce(permissions->'views','{}'::jsonb)||jsonb_build_object('hr-employees',permissions->'views'->'hr','hr-documents',permissions->'views'->'hr','hr-vacations','none','hr-payroll','none')) where permissions->'views' ? 'hr' and not permissions->'views' ? 'hr-employees';
end $m$;
