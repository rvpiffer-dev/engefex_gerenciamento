# Ativação do compartilhamento gratuito

Estado: integração do navegador implementada na ramificação `feat/supabase-shared-workspace`, aguardando execução do SQL, cadastro dos usuários e testes reais antes de publicação. A versão `main` publicada continua local enquanto esta ramificação não for integrada.

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

## 4. Conectar a interface (implementado na ramificação de integração)

Projeto configurado na ramificação: `https://kxekeeysonrppechegsq.supabase.co` e chave **publishable** pública (`sb_publishable_...`). O endpoint que termina em `/rest/v1/` não é a Project URL. A configuração fica em `dist/cloud.js`.
Nunca usar `service_role`, `sb_secret_...` ou senha do banco no navegador.
A chave publicável identifica o projeto; quem autoriza os registros é o login com RLS.

O código já implementa: login/sessão, atualização de token, logout, leitura do workspace, migração inicial explícita, leitura e gravação de estado por `engefex_save_state`, atualização periódica, controle de revisão e upload/download de arquivos no bucket privado. A edição é bloqueada offline e quando há falha ou confirmação pendente; uma cópia local de emergência permanece disponível para backup. A versão no ramo `main` não será substituída até os testes no projeto Supabase confirmarem a segurança.

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

## 6. Checklist de ativação antes do merge

1. Execute `202610170001_shared_workspace.sql` no Supabase **uma única vez**, em um projeto novo (SQL Editor > New query > Run).
2. No Supabase, Authentication > Users > Add user: crie três contas distintas (confirme e-mails conforme as opções de autenticação ativas). Não compartilhe senhas entre usuários.
3. Execute o bloco `DO $$` da seção 3 para criar o workspace e os três vínculos. Não execute o bloco duas vezes.
4. Revise as RLS no Table Editor / Database e confirme o bucket `engefex-files` como **Private** no Storage.
5. Confira os testes do GitHub Actions na ramificação e somente então publique/mescle para `main`.
6. Na primeira abertura do site, faça login. Exporte o backup local antes de enviar dados; o primeiro usuário só inicializa a base se estiver vazia.
7. Entre no segundo navegador com outra conta: veja os mesmos dados, salve uma alteração, teste leitura de anexos; repita com o terceiro usuário.
8. Teste concorrência editando dois navegadores: a gravação com revisão antiga deve ser **rejeitada**, preservando rascunho local para exportar backup.
9. Teste um usuário não autorizado e sessão sem login: nenhum registro nem arquivo privado acessível.
10. Antes de produção, defina quem pode adicionar/remover membros e quais dados serão retidos no Supabase; o admin mantém o controle de acessos pelo painel.

**Nota de arquitetura:** é uma primeira versão de sincronização por revisão de um estado JSON compartilhado, não edição colaborativa célula por célula; conflitos exigem atualização manual. O plano gratuito do Supabase tem limites de banco, banda e Storage. A interface pode ficar em cache offline, mas lançamentos novos dependem de conexão com o servidor.
