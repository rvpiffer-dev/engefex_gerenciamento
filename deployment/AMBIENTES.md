# Operação do Gerenciador Engefex

Produção: https://rvpiffer-dev.github.io/engefex_gerenciamento/dist/
Testes: https://rvpiffer-dev.github.io/engefex_gerenciamento/testes/

- `main`: versão estável usada pela equipe. Não publicar novidades aqui antes da aprovação do Ramon.
- `desenvolvimento`: implementar e testar todas as próximas mudanças nesta branch.
- Cada push publica os dois diretórios, lendo a produção sempre da main e os testes sempre de desenvolvimento.
- A configuração pública de conexão é injetada pelo montador da main. Os projetos Supabase devem ser diferentes.
- Produção conserva login, cache e banco atuais. Testes usa outro projeto, outros usuários, bucket privado e chaves locais próprias.
- Nunca copiar registros de testes para produção durante uma promoção.
- Mudanças SQL devem ser executadas e conferidas em testes antes de produção; migrações de produção precisam ser compatíveis com clientes da versão anterior.

## Aprovar uma versão

1. Validar na URL de testes, inclusive mobile, recebimentos, pagamentos e anexos.
2. Conferir o diff de desenvolvimento contra main e os testes automatizados.
3. Guardar uma branch `backup/producao-<versao>-<data>` na main atual.
4. Abrir PR de desenvolvimento para main. Só integrar após aprovação do Ramon.
5. Verificar Actions e as versões publicadas nas duas URLs.

Reverter código por commit de reversão. Não restaurar o banco para voltar versão de interface: isso perderia lançamentos reais posteriores.

## Primeiro acesso aos testes

Cadastrar `admin@engefex.com` no Auth do projeto Supabase Engefex-Gerenciador-Testes, com Auto Confirm User ativado. Usar uma senha própria para testes. Não copiar senhas ou sessões de produção. O administrador é vinculado pelo provisionamento restrito instalado no projeto de testes; outras contas precisam de vínculo explícito na tabela engefex_members.

## Segurança revisada

As tabelas usam RLS e o bucket é privado. As RPCs de salvamento são SECURITY DEFINER de forma intencional: verificam auth.uid(), vínculo do usuário com o workspace e revisão antes de escrever. EXECUTE é negado a anon/PUBLIC. O provisionamento de administrador fica em schema não exposto e não pode ser executado por clientes. O linter sinaliza as duas RPCs por serem chamadas por usuários autenticados; revisão: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
