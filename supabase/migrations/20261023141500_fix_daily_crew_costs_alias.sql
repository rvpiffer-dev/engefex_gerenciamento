-- Ajusta alias interno sem alterar dados ou políticas.
do $repair$
declare d text; pos integer; tail text;
begin
 d:=pg_get_functiondef('engefex_private.project_state(uuid,uuid,jsonb)'::regprocedure);
 pos:=position('''crewHourlyRates''' in d);
 if pos=0 then raise exception 'Projeção de custo/hora ausente';end if;
 tail:=substr(d,pos);
 if position('pay->' in tail)=0 then
   tail:=replace(tail,'r->','pay->');
   tail:=replace(tail,') r'||E'\n',') pay'||E'\n');
   d:=left(d,pos-1)||tail;
   execute d;
 end if;
end $repair$;