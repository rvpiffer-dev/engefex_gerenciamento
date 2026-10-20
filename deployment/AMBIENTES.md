# Operação do Gerenciador Engefex

Produção: https://rvpiffer-dev.github.io/engefex_gerenciamento/dist/
Testes: https://rvpiffer-dev.github.io/engefex_gerenciamento/testes/

- Orientação temporária do Ramon em 20/10/2026: publicar as mudanças solicitadas diretamente em produção enquanto a equipe ainda não foi liberada. Validar antes de cada publicação e manter desenvolvimento alinhada.
- Quando Ramon avisar que liberou produção para a equipe, voltar ao fluxo: novidades em `desenvolvimento`, promoção para `main` após aprovação.
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

## Usuários e permissões — v4.13.0

A conta `admin@engefex.com` administra a matriz em **Usuários e acessos**. Visualizar permite leitura e downloads; Editar permite criar, alterar e excluir; Sem acesso bloqueia a tela. O nível da tela não pode superar o do módulo. As contas existentes receberam edição integral na implantação; novos membros começam sem acesso, exceto a conta administrativa confirmada já prevista no provisionamento.

A matriz fica fora do JSONB de negócio, em `engefex_access`, sem acesso direto de clientes. RPCs administrativas verificam administrador no banco e usam revisão para evitar sobrescrita concorrente. O acesso do administrador não pode ser removido por essa interface. As alterações são auditadas em `engefex_private.access_audit`.

Usuários restritos recebem uma projeção autorizada da base via RPC. Identificação de obras e origem de notas/parcelas são compartilhadas quando necessárias ao módulo liberado. Gravações são mescladas no servidor com a base completa, preservando áreas ocultas; nenhuma permissão é confiada ao localStorage ou a user_metadata. A rota de leitura direta continua disponível apenas para contas com leitura de todas as telas. O Storage verifica referência em área permitida, e a gravação impede reutilizar IDs de anexos de áreas ocultas.

O cliente verifica permissões a cada sincronização; ao mudar o perfil, fecha formulários e recarrega a projeção autorizada. O banco aplica a nova matriz imediatamente, inclusive para clientes antigos. Faça uma revisão completa dos perfis antes de liberar a equipe.

A migração consolidada foi exercitada em testes antes da produção. `scripts/verify-access.sql` executa verificações com usuários sintéticos e rollback integral, sem criar contas persistentes ou mudar registros reais. Foram revisados os avisos do linter sobre RPCs SECURITY DEFINER (intencionais, com autenticação/vínculo/permissão) e tabelas de ACL/auditoria com RLS e acesso direto negado. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . O aviso de proteção contra senhas vazadas no projeto de testes já era independente desta implantação.
