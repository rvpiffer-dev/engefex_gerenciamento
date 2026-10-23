-- Evita que permissões antigas de acesso completo ignorem as novas áreas do RH.
-- Somente administradores podem receber o estado inteiro sem projeção por módulos.
do $fix$
declare d text;
begin
 d:=pg_get_functiondef('engefex_private.project_state(uuid,uuid,jsonb)'::regprocedure);
 if position('if engefex_private.full_read(w,u) then return s;end if;' in d)>0 then
   d:=replace(d,
     'if engefex_private.full_read(w,u) then return s;end if;',
     'if engefex_private.is_admin(w,u) then return s;end if;');
   execute d;
 end if;
end $fix$;