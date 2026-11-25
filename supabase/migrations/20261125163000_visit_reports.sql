-- Relatórios de visitas compartilham o nível de acesso do Diário de Obra.
do $$
declare
 definition text := pg_get_functiondef('engefex_private.owners(text[])'::regprocedure);
 diary_rule text := 'when ''diary'' then array[''diary'']';
 visit_rule text := 'when ''visitReports'' then array[''diary'']';
begin
 if strpos(definition, visit_rule) > 0 then return; end if;
 if strpos(definition, diary_rule) = 0 then
  raise exception 'Regra de acesso do Diário de Obra ausente';
 end if;
 execute replace(definition, diary_rule, diary_rule || ' ' || visit_rule);
end $$;
