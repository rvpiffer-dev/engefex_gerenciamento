-- Somente no projeto de TESTES. Não executar em produção.
-- Facilita o primeiro acesso do administrador confirmado criado pelo Dashboard.
create schema if not exists engefex_private;
revoke all on schema engefex_private from public,anon,authenticated;
create function engefex_private.link_test_administrator() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if lower(new.email)='admin@engefex.com' and new.email_confirmed_at is not null then
  insert into public.engefex_members(workspace_id,user_id)
  select id,new.id from public.engefex_workspaces
  where name='Engefex — Ambiente de testes' on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function engefex_private.link_test_administrator() from public,anon,authenticated;
create trigger engefex_test_administrator after insert or update of email_confirmed_at,email
on auth.users for each row execute function engefex_private.link_test_administrator();
