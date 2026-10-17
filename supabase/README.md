# Ativação do compartilhamento gratuito

Estado: estrutura de banco preparada; login e sincronização da interface ainda não
ativados. O aplicativo publicado continua local e não envia dados a terceiros.

## 1. Criar o projeto

No dashboard do Supabase, crie uma organização Free e um projeto
`engefex-gerenciamento`. Escolha região próxima ao Brasil quando disponível.
Guarde a senha do banco; ela não deve ser incluída no GitHub nem na configuração
pública do aplicativo.

## 2. Instalar a estrutura

Em SQL Editor > New query, execute uma vez
`migrations/202610170001_shared_workspace.sql` em um projeto novo.
O script inteiro é transacional. Não o execute em outro banco de produção.
Ele cria áreas de trabalho, membros, estado com revisão e bucket privado.

## 3. Autorizar os usuários

Em Authentication > Users, crie as três contas. Defina senhas individuais por um
canal privado ou use o fluxo de convite após configurar o envio de e-mails.
Não precisamos das senhas dos usuários para integrar o aplicativo.
No SQL Editor, substitua os três e-mails no exemplo abaixo antes de executá-lo.
O script exige as três contas existentes e cria somente uma área compartilhada.

```sql
do $$
declare
 emails text[] := array['PREENCHER_EMAIL_1','PREENCHER_EMAIL_2','PREENCHER_EMAIL_3'];
 workspace uuid;
 n integer;
begin
 select count(*) into n from auth.users where lower(email)=any(
  select lower(e) from unnest(emails) e
 );
 if n <> 3 then raise exception 'Cadastre as três contas distintas antes de continuar'; end if;
 insert into public.engefex_workspaces(name) values ('Engefex') returning id into workspace;
 insert into public.engefex_members(workspace_id,user_id)
 select workspace,id from auth.users where lower(email)=any(select lower(e) from unnest(emails) e);
 insert into public.engefex_state(workspace_id) values (workspace);
 raise notice 'Workspace: %',workspace;
end $$;
```

## 4. Conectar a interface (etapa pendente)

Precisamos da Project URL e da chave **publishable** (`sb_publishable_...`),
localizadas no painel Connect / Settings > API Keys.
Nunca usar `service_role`, `sb_secret_...` ou senha do banco no navegador.
A chave publicável identifica o projeto; quem autoriza os registros é o login com RLS.

A integração precisa concluir: login, renovação de sessão, logout com isolamento
entre contas, upload/download autenticado de anexos, leitura do estado e salvamento
pela função `engefex_save_state`. Toda gravação exige a revisão lida anteriormente;
conflitos devem manter o rascunho e pedir recarga, nunca substituir o servidor.
Não anunciar sucesso online enquanto o servidor não confirmar a transação.
Sem conexão, bloquear gravações compartilhadas nesta primeira versão.

## 5. Migrar e verificar

1. Exportar backup completo no navegador que contém os dados reais.
2. Ler primeiro a base remota. Migrar somente se ainda estiver vazia.
3. Enviar os anexos referenciados ao bucket privado antes de salvar o estado.
4. Salvar o estado com revisão 0, sem incluir os bytes dos anexos no JSON.
5. Abrir em outro aparelho e conferir obras, orçamento, cronograma e fotos.
6. Testar dois usuários editando a mesma revisão: o segundo deve receber conflito.
7. Testar usuário sem vínculo e usuário sem login: nenhum dado/anexo acessível.
8. Testar sessão expirada, perda de rede e backup exportado após a migração.

## Limites de validação

O SQL ainda precisa ser executado e testado no projeto Supabase criado pelo
proprietário. Os testes locais atuais do gerenciador não validam Postgres/RLS.
Cadastro e revogação de membros serão feitos pelo administrador no painel nesta
primeira etapa. Os três membros terão acesso de edição à mesma base.

Referências oficiais:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/getting-started/api-keys
