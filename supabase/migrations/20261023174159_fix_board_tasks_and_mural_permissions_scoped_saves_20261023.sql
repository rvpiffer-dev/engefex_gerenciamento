-- Corrige escopo da lousa (boardTasks e boardMuralPositions) no Supabase.
-- Mantém os módulos protegidos: somente permissão board autoriza leitura/edição.
-- Corrige também o envio de dados legados imutáveis por clientes com projeção antiga.
DO $migration$
DECLARE v text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='engefex_private' AND p.proname='owners';
 IF v IS NULL OR strpos(v,$old$when 'hrVacations' then$old$)=0
 THEN RAISE EXCEPTION 'Função owners mudou; atualização cancelada'; END IF;
 v:=replace(v,$old$when 'hrVacations' then$old$,
              $new$when 'boardTasks' then array['board'] when 'boardMuralPositions' then array['board'] when 'hrVacations' then$new$);
 EXECUTE v;

 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='engefex_private' AND p.proname='project_state';
 IF v IS NULL OR strpos(v,$old$"teams": "works"$old$)=0 OR strpos(v,$old$if k='hrSettings' then$old$)=0
 THEN RAISE EXCEPTION 'Função project_state mudou; atualização cancelada'; END IF;
 v:=replace(v,$old$"teams": "works"$old$,$new$"teams": "works", "board": "board"$new$);
 v:=replace(v,$old$if k='hrSettings' then$old$,
 $new$if k='boardMuralPositions' then
   if engefex_private.any_level(w,u,array['board'],1) then
     result:=result||jsonb_build_object(k,s->k);
   end if;
   continue;
 end if;
 if k='hrSettings' then$new$);
 EXECUTE v;

 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='engefex_save_state';
 IF v IS NULL OR strpos(v,$old$"teams": "works"$old$)=0 OR strpos(v,$old$'documents','teams','payables'$old$)=0
 THEN RAISE EXCEPTION 'Função engefex_save_state mudou; atualização cancelada'; END IF;
 v:=replace(v,$old$"teams": "works"$old$,$new$"teams": "works", "board": "board"$new$);
 v:=replace(v,$old$'documents','teams','payables'$old$,$new$'documents','teams','board','payables'$new$);
 EXECUTE v;

 SELECT pg_get_functiondef(p.oid) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='engefex_private' AND p.proname='merge_delta';
 IF v IS NULL OR strpos(v,$old$if visible is not distinct from nextvalue then return fullvalue;end if;$old$)=0
 THEN RAISE EXCEPTION 'Função merge_delta mudou; atualização cancelada'; END IF;
 v:=replace(v,$old$if visible is not distinct from nextvalue then return fullvalue;end if;$old$,
 $new$if visible is not distinct from nextvalue then return fullvalue;end if;
 -- Valor oculto reenviado sem nenhuma modificação: preservar, sem conceder edição.
 if array_length(p,1)>0 and fullvalue is not null and nextvalue is not distinct from fullvalue then return fullvalue;end if;$new$);
 EXECUTE v;
END
$migration$;
