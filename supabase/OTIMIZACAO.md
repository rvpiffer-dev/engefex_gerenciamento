# Sincronização incremental - v4.7.0

O cliente passa a verificar somente a revisão a cada atualização automática. O conteúdo da base é baixado quando a revisão muda. Consultas simultâneas não são duplicadas e uma resposta antiga não substitui uma edição confirmada durante a consulta.

Para ativar o salvamento incremental, execute **uma vez**, no SQL Editor do projeto Supabase existente, o arquivo:

`migrations/202610190001_incremental_sync.sql`

Depois, atualize o aplicativo. A migração pode ser reexecutada e não modifica registros existentes. Ela acrescenta uma função autorizada somente para membros autenticados, preservando as regras e a função de salvamento anterior. Navegadores antigos continuam compatíveis. O aplicativo usa a função anterior se a nova ainda não estiver instalada; erros de rede e conflitos não acionam esse retorno.

O novo envio contém alterações por trecho de lista e campo. Uma alteração em uma atividade e uma nova entrada de histórico não reenviam as demais atividades nem o histórico anterior. Os índices só são aplicados após travar e conferir a revisão do workspace, na mesma transação; em conflito, nenhuma parte do lote é aplicada.

A base continua no formato JSONB existente. Esta atualização reduz a transferência e mantém a compatibilidade; não transforma os módulos em tabelas separadas nem permite editar offline.

## Validação

- Testes de aplicação: `node --test tests/cloud*.test.cjs`.
- Testes reais de PostgreSQL em WASM: instalar `@electric-sql/pglite@0.3.14` em um diretório temporário e apontar `ENGEFEX_PGLITE_MODULE` para o módulo antes de executar `node --test supabase/tests/incremental_sync.cjs`.
- A verificação do GitHub executa esses testes sem acessar a base de produção.
- Cenário de 1.000 atividades e 1.000 históricos: editar uma atividade e acrescentar um histórico reduz mais de 95% do corpo enviado. Isso mede volume transferido, não promete um tempo fixo de salvamento em produção.
- São verificados autorização, exclusão/inclusão/ordem, revisão antiga, rejeição integral de lote inválido e interoperabilidade com clientes antigos.

## Versão preservada

A versão anterior permanece em `backup/v4.6.0-cronograma-pdf-2026-10-19`. Para voltar o aplicativo, publique essa versão. A função incremental adicionada pode permanecer no banco: não altera o comportamento do cliente anterior.
