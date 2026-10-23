-- Alocação diária de funcionários: leitura por Equipes/Financeiro; escrita somente por Equipes.
-- Não expõe salário, holerite, benefícios ou outros dados do RH para usuários da obra.
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('engefex_private.owners(text[])'::regprocedure);
 if position('when ''crewAllocations'' then' in d)=0 then
   if position('when ''teams'' then array[''teams'']' in d)=0 then
     raise exception 'Mapa de permissões mudou: revisar antes de adicionar alocações';
   end if;
   d:=replace(d,'when ''teams'' then array[''teams'']',
     'when ''teams'' then array[''teams''] when ''crewAllocations'' then array[''teams'',''payables'']');
   execute d;
 end if;

 d:=pg_get_functiondef('engefex_private.can_edit(uuid,uuid,text[],jsonb,jsonb,jsonb)'::regprocedure);
 if position('if p[1]=''crewAllocations'' then' in d)=0 then
   if position('if p[1]=''materialsBudgetLinked'' ' in d)=0 then
     raise exception 'Validação de escrita mudou: revisar antes de adicionar alocações';
   end if;
   d:=replace(d,'if p[1]=''materialsBudgetLinked'' ',
     'if p[1]=''crewAllocations'' then return engefex_private.any_level(w,u,array[''teams''],2);end if; if p[1]=''materialsBudgetLinked'' ');
   execute d;
 end if;

 d:=pg_get_functiondef('engefex_private.project_state(uuid,uuid,jsonb)'::regprocedure);
 if position('crewHourlyRates' in d)=0 then
   if position(' return result;' in d)=0 then
     raise exception 'Projeção de estado mudou: revisar antes de adicionar alocações';
   end if;
   d:=replace(d,' return result;',
   $inject$
 -- A tela Equipes recebe somente campos operacionais e custo/hora calculado.
 -- Esta projeção nunca inclui base salarial, encargos discriminados ou holerite.
 if engefex_private.any_level(w,u,array['teams'],1) then
   result:=result||jsonb_build_object(
     'crewEmployees',
     coalesce((
       select jsonb_agg(jsonb_build_object(
         'id', e->'id',
         'name', e->'name',
         'role', coalesce(e->'role','""'::jsonb),
         'active', coalesce(e->'active','true'::jsonb),
         'employmentStatus', coalesce(e->'employmentStatus','""'::jsonb)
       ))
       from jsonb_array_elements(
         case when jsonb_typeof(s->'hrEmployees')='array' then s->'hrEmployees' else '[]'::jsonb end
       ) e
     ),'[]'::jsonb),
     'crewHourlyRates',
     coalesce((
       select jsonb_agg(jsonb_build_object(
         'employeeId',coalesce(r->>'employeeId',''),
         'employeeName',coalesce(r->>'employeeName',r->'values'->>'A',''),
         'period',coalesce(r->>'period',''),
         'hourlyRate', round((
           (case when coalesce(r->'values'->>'B','') ~ '^[0-9]+([.,][0-9]+)?$'
             then replace(r->'values'->>'B',',','.')::numeric else 0 end)
           +(case when coalesce(r->>'employerCosts','') ~ '^[0-9]+([.,][0-9]+)?$'
             then replace(r->>'employerCosts',',','.')::numeric else 0 end)
         )/
         (case when coalesce(r->>'monthlyHours','') ~ '^[0-9]+([.,][0-9]+)?$'
                 and replace(r->>'monthlyHours',',','.')::numeric>0
           then replace(r->>'monthlyHours',',','.')::numeric else 220 end),6),
         'chargesMissing',(case when coalesce(r->>'employerCosts','') ~ '^[0-9]+([.,][0-9]+)?
       ))
       from jsonb_array_elements(
         case when jsonb_typeof(s->'hrPayroll')='array' then s->'hrPayroll' else '[]'::jsonb end
       ) r
     ),'[]'::jsonb)
   );
 end if;
 return result;
$inject$);
   execute d;
 end if;
end $migration$;
           then replace(r->>'employerCosts',',','.')::numeric<=0 else true end)
       ))
       from jsonb_array_elements(
         case when jsonb_typeof(s->'hrPayroll')='array' then s->'hrPayroll' else '[]'::jsonb end
       ) r
     ),'[]'::jsonb)
   );
 end if;
 return result;
$inject$);
   execute d;
 end if;
end $migration$;