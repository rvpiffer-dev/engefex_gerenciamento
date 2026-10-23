
-- Evita falso bloqueio de anexos durante o apontamento diário de equipes.
-- O histórico pré-existente não é um novo anexo. A validação de arquivos
-- operacionais e de anexos adicionados em novas entradas permanece rigorosa.
DO $migration$
DECLARE v text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='engefex_save_state';
 IF v IS NULL OR strpos(v,$old$for file_id in select f from engefex_private.file_ids(p_payload) f where not exists(select 1 from engefex_private.file_ids(visible) old_id where old_id=f) loop$old$)=0
 THEN RAISE EXCEPTION 'Validação de anexos mudou; migração interrompida';
 END IF;
 v:=replace(v,
 $old$for file_id in select f from engefex_private.file_ids(p_payload) f where not exists(select 1 from engefex_private.file_ids(visible) old_id where old_id=f) loop$old$,
 $new$for file_id in
   -- Referências operacionais do payload precisam ter sido visíveis.
   select f from engefex_private.file_ids(p_payload - 'history') f
     where not exists(select 1 from engefex_private.file_ids(visible - 'history') old_id where old_id=f)
   union
   -- Referências históricas antigas não representam arquivos recém-associados.
   -- Referências novas em histórico continuam exigindo autorização.
   select f from engefex_private.file_ids(p_payload->'history') f
     where not exists(select 1 from engefex_private.file_ids(oldrow.payload->'history') old_id where old_id=f)
       and not exists(select 1 from engefex_private.file_ids(visible - 'history') old_id where old_id=f)
 loop$new$);
 EXECUTE v;
END
$migration$;
