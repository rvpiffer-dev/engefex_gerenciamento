# Cadastro e senhas pelo administrador

Entre com a conta administradora e abra **Usuários e acessos**.

- **Novo usuário:** informe nome, e-mail, senha inicial (12 a 128 caracteres) e confirmação. A conta é criada no Supabase Auth, vinculada ao workspace e começa sem acesso aos módulos. Selecione os níveis de acesso e clique em **Salvar permissões**.
- **Redefinir senha:** selecione uma conta comum, clique no botão, informe e confirme a nova senha. O e-mail, os registros e as permissões permanecem iguais. A conta administradora é protegida contra redefinição por este fluxo.

O sistema não envia a senha por e-mail. A interface limpa os campos após a operação e não grava senhas no estado da aplicação ou no armazenamento local. O cadastro confirma o e-mail administrativamente. Uma tentativa de cadastrar e-mail existente não altera essa conta.

## Servidor

`supabase/functions/admin-create-user` atende cadastro e redefinição. Implantar com verificação de JWT habilitada. A função usa somente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente de execução da Edge Function; nenhuma chave privilegiada é enviada ao navegador. Não configurar a chave administrativa em `dist`.

A função valida a identidade pelo Auth, consulta autorização de administrador e sessão ativa no banco, limita tentativas e usa a API administrativa do Auth. Os auxiliares SQL são exclusivos de `service_role`; `anon` e `authenticated` não têm EXECUTE. Senhas não constam da auditoria. A redefinição usa `PUT /auth/v1/admin/users/:id` e não promete encerrar instantaneamente tokens já emitidos.

Os ambientes de produção e testes têm bancos e funções próprios. A tabela de perfil legado é atualizada quando existe; Auth, vínculo e matriz de acesso são obrigatórios em ambos. O fluxo não promove novas contas a administrador.

## Validação

`node --test tests/*.test.cjs` valida regras de acesso, fluxo da tela e chamadas do servidor, incluindo recusa de e-mail duplicado, falha de vínculo e senha sem exposição na resposta. `scripts/verify-admin-user-creation.sql` usa contas sintéticas e rollback e deve ser executado **somente no banco de testes**. Em produção, conferir funções e privilégios por consultas de leitura.
