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

## Correção de salvamento — v4.18.43 (11/11/2026)

- Causa reproduzida: usuários não administradores com leitura integral recebiam patches por índice. A mesclagem SQL conserva a ordem anterior das listas; após editar uma compra, a ordem local podia divergir. A edição seguinte atingia outra posição e causava `IDs duplicados` em `merge_delta`.
- Agora os patches desses usuários substituem somente as listas alteradas e deixam a mesclagem autorizada resolver os registros pelo ID. Administradores mantêm patches por índice; perfis restritos mantêm gravação pela projeção autorizada. Histórico compacto continua apenas acrescentando eventos.
- Rascunhos antigos de atualização financeira com índices divergentes são recuperados pelo ID existente. Substituições de IDs desconhecidos não são inferidas; o rascunho continua disponível para conferência. A revisão do banco continua obrigatória e conflitos da equipe não são sobrescritos.
- Verificação: 424 testes automatizados aprovados, incluindo reprodução do erro antes da correção, duas edições consecutivas, preservação de outra nota e recuperação de rascunhos. Também foram exercitadas as RPCs reais com duas gravações por lista em transação integralmente revertida; nenhuma compra, conta ou revisão de produção foi alterada pelo teste.
- Banco conferido na revisão 511: 38 compras e 13 custos, sem IDs repetidos nas listas de registros. Não foi necessária migração de esquema nem alteração de permissões.

## Organização das colunas — v4.18.44 (11/11/2026)

Em Contas a pagar, a opção **Organizar colunas** permite mostrar/ocultar colunas, alterar sua ordem pelas setas e restaurar o padrão. A largura continua ajustável pela borda do cabeçalho ou pelo teclado. As preferências são mantidas neste navegador e compartilhadas entre as abas Em aberto/Pagos; produção e testes usam chaves separadas. A personalização também fica disponível para perfis somente de consulta. Não grava nem altera lançamentos financeiros.

Verificação visual com dados sintéticos: reordenação de cabeçalhos e células, ocultação, persistência após recarregar, redimensionamento e restauração do padrão.

## Confirmação pela lista — v4.18.45 (11/11/2026)

O botão **Confirmar** aparece nas ações das compras em rascunho que não pertencem a um fechamento. Confirma o documento sem abrir o editor, usando as mesmas validações de fornecedor, data, itens, rateio e parcelas do formulário; as contas são geradas pela rotina financeira existente. Bloqueia cliques simultâneos e exibe sucesso somente após o servidor confirmar o salvamento. Compras confirmadas/canceladas não exibem o botão. A ação respeita a permissão de edição de Compras e notas.

Verificação: fluxo visual com nota sintética, confirmação sem abrir formulário, três testes adicionais para integridade das parcelas, rascunho incompleto, duplo clique e resposta do servidor. Nenhuma nota real foi confirmada durante os testes.

## Contas a pagar — v4.18.46 (11/11/2026)

- Ordenação explícita por vencimento, número do documento, fornecedor, valor original, saldo, emissão, pagamento, obra e categoria; crescente/decrescente, com preferência no navegador e números em ordem natural. Datas ausentes ficam no final em ambas as direções. Número fiscal usa o documento de origem; contas manuais usam número/documento ou identificação extraída da descrição.
- Lista e CSV seguem a mesma ordenação e busca; a consulta inclui fornecedor, documento e obra. A ordenação trabalha em cópias dos agrupamentos e não altera registros ou rateios.
- Interface com resumo compacto, abas Em aberto/Pagos, busca e ordenação junto da tabela, vencimentos e saldos destacados. Ações secundárias ficam em Mais; categorias, edição em planilha e explicações ficam em Configurações e ajuda.
- Novos padrões de colunas mostram os dados essenciais; preferências anteriores continuam preservadas e todas as colunas permanecem disponíveis em Organizar colunas. Em Pagos, o padrão destaca Pago em vez do saldo zerado. Os cartões móveis seguem a ordenação selecionada.
- Verificação visual com lançamentos sintéticos em desktop e largura de 390 px: vencimento/número/fornecedor, inversão, preferência após recarregar, abas, colunas e acesso às ações. Testes de ordenação verificam acentos, números, datas ausentes, parcelas rateadas e ausência de mutação dos dados.

## Financeiro unificado — v4.18.47 (11/11/2026)

- Contas a receber e Despesas gerais adotam o mesmo padrão de Contas a pagar: resumo compacto, busca/ordenação/colunas na área da lista, ações secundárias em Mais e cartões responsivos no celular.
- Recebimentos: ordenação por vencimento, número, cliente, valores, saldo, obra e tipo; preferência no navegador e CSV na mesma ordem. Mantidas as rotinas de recebimento/estorno, parcelamento, comprovantes, retenções e exclusão. Recebidos destaca a coluna de valor recebido; parcelas e entrada conservam identificação em destaque.
- Despesas: abas Todas/Recorrentes/Únicas, busca por descrição/fornecedor/destino, ordenação, colunas personalizáveis e exportação CSV dos cadastros exibidos. A competência e a geração mensal ficam em uma faixa própria; o resumo informa as contas dessa competência. A geração, o ajuste de meses curtos, a proteção contra duplicação e a preservação de pagamentos continuam nas rotinas existentes.
- As preferências de consulta permanecem disponíveis a usuários com visualização, enquanto geração, recebimentos e alterações continuam sujeitos às permissões das respectivas telas.
- Verificação visual em desktop e 390 px: as duas telas, ordenação, abas, busca e valores recebidos. Testes adicionais verificam ordenação sem mutação e consulta das recorrências sem gerar contas.
