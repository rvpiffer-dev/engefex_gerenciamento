-- Campos projetados para consulta de Equipes não são gravações da aplicação.
-- Apenas crewAllocations persiste obra, data, funcionário, horas e custo gerencial.
-- Ignoramos mudanças em crewEmployees/crewHourlyRates na raiz do payload
-- para não dar permissão de edição de RH a usuários do módulo Equipes.
DO $migration$
DECLARE v text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='engefex_private' AND p.proname='merge_delta';
 IF v IS NULL OR strpos(v,$old$key in ('history','notifications','_accessFiltered')$old$)=0
 THEN RAISE EXCEPTION 'Função merge_delta mudou; correção interrompida';
 END IF;
 v:=replace(v,
   $old$key in ('history','notifications','_accessFiltered')$old$,
   $new$key in ('history','notifications','_accessFiltered','crewEmployees','crewHourlyRates')$new$);
 EXECUTE v;
END
$migration$;
