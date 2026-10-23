-- Preserva acesso à aba de vales da folha para quem tem permissão do RH.
do $fix$
declare d text;
begin
 d:=pg_get_functiondef('engefex_private.owners(text[])'::regprocedure);
 if position('when ''hrPayrollVale'' then' in d)=0 then
   if position('when ''hrPayroll'' then array[''hr-payroll'']' in d)=0 then
     raise exception 'Mapa de proprietários do RH alterado. Revisar antes de prosseguir.';
   end if;
   d:=replace(d,
    'when ''hrPayroll'' then array[''hr-payroll'']',
    'when ''hrPayroll'' then array[''hr-payroll''] when ''hrPayrollVale'' then array[''hr-payroll'']');
   execute d;
 end if;
end $fix$;