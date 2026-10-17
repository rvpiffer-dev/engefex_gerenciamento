# Versões do Gerenciador Engefex

## v1.0.0 - versão preservada antes dos módulos

- Data: 17/10/2026.
- Commit: `a066b396b3a8d45dcb1bbfcc5872614f01d11e05`.
- Branch de backup: `backup/v1.0.0-2026-10-17`.
- Inclui login e sincronização Supabase, fotos privadas, orçamento independente,
  importação de cronograma PDF, EDT, avanço dos grupos e resumo total da obra.
- Esta versão recebeu o identificador v1.0.0 ao criar o ponto de recuperação.

## v2.0.0 - organização por áreas

- Gerenciamento de obras: recursos existentes de cadastro, planejamento,
  orçamento, suprimentos, execução, diário, equipes e documentos.
- Financeiro: Contas a pagar, Contas a receber (reservada) e Medições e recebimentos.
- Fabricação: espaço reservado, sem controles de produção implementados ainda.
- Contas a pagar usa os mesmos registros de contratos e pagamentos, sem cópia.
- Edição em planilha, importadores, cálculos e sincronização permanecem ativos.
- Não há mudança de esquema nem de permissões no banco nesta versão.

## O que o backup contém

A branch preserva o código e os arquivos versionados no GitHub. Não contém os
registros de obras, contas, usuários ou anexos particulares armazenados no
Supabase ou no navegador. Para esses registros, use a exportação de backup do
aplicativo e mantenha os backups do banco e do Storage.

## Recuperação do código

Compare a branch de backup com `main` antes de restaurar. Reaplique o snapshot
em um novo commit/PR; evite apagar o histórico. A recuperação do código não
restaura dados apagados do banco. Verifique a compatibilidade do esquema caso
existam migrações futuras.

## v2.1.0 - compras por documento

- Uma compra ou nota pode ter vários itens e parcelas, vinculados à mesma obra.
- Cadastro manual em grade, colagem de blocos do Excel e prévia de XML NF-e.
- Vinculação de cada item ao orçamento; confirmação gera contas a pagar rateadas pelas etapas.
- Rascunhos não geram dívida. Reedição reutiliza os vínculos financeiros e preserva pagamentos.
- Exclusões e alterações que removeriam parcelas pagas ou custos incorridos são bloqueadas.
- Identidade da nota impede importações duplicadas; não há validação de assinatura ou situação fiscal.
- XMLs e PDFs podem ser anexados como documentos privados. Extração automática de itens de PDF pendente de um modelo de exemplo.
- Insumos e estoque antigos são mantidos em aba própria; compras não geram movimentos de estoque automaticamente.
- Ponto de recuperação anterior: `backup/v2.0.0-2026-10-17`.

## v2.2.0 - previsão de medições por grupos

- Em Financeiro > Medições e recebimentos > Previsão de medições, selecione a obra e gere/revise vínculos em lote.
- Sugestões por nomes compatíveis, código com descrição compatível ou origem explícita do orçamento. Correspondências ambíguas ficam sem vínculo.
- Uma regra de grupo abrange as atividades e subetapas; participação define a fração do grupo do orçamento atribuída àquela regra. A soma por item financeiro não pode ultrapassar 100%.
- Distribuição durante a execução: atividades com igual peso dentro do grupo e valores uniformes por dia corrido. Na conclusão: último término do grupo, somente com datas completas. Critérios são estimativas gerenciais que exigem conferência contratual.
- Valores já lançados, incluindo medições preparadas e excluindo glosas, abatem cronologicamente as primeiras previsões do item. O saldo nunca é contado duas vezes.
- A programação é recalculada em cada leitura a partir das datas atuais; as regras ficam salvas. As medições, o orçamento e os recebimentos não são alterados.
- Quantidades são estimativas proporcionais ao saldo contratual e permanecem separadas por item/unidade.
- Sem vínculo, sem datas e valores previstos em meses passados continuam visíveis como pendências.
- Não cria medições, contas a receber ou aprovações automaticamente. Exige conferência explícita dos vínculos antes de salvar.
- CSV disponível; cópia de recuperação da versão anterior em `backup/v2.1.0-2026-10-17`.

## v2.2.1 - configuração de previsão pronta

- Importa arquivo privado contendo somente vínculos, com prévia e observações.
- Verifica obra, estrutura dos grupos/itens e alterações posteriores nos vínculos.
- Preserva lançamentos mais recentes: somente regras da obra selecionada são substituídas, após salvar e confirmar no servidor.
- Configurações particulares e backups de clientes não fazem parte do repositório.

## v2.2.2 - contas em aberto e pagas

- Contas a pagar separado em Em aberto e Pagos, conforme quitação em centavos.
- Pagamentos parciais permanecem em aberto; correções que reabrem saldo retornam à lista em aberto.
- CSV respeita a aba selecionada e a pesquisa. Nenhum lançamento é movido ou duplicado no banco.

## v2.3.0 - filtros e baixa de contas a pagar

- Filtros combináveis por nota/documento, cliente da obra, fornecedor, categoria, etapa, data da nota/lançamento, vencimento, último pagamento, saldo e contas vencidas. CSV acompanha os filtros e a aba.
- Botão Pagar abre quitação ou pagamento parcial com data, valor e observações. Quitação calcula desconto/acréscimo sobre o saldo; pagamento parcial conserva a diferença em aberto.
- Valor original preservado, descontos/acréscimos acumulados separados e saída de caixa pelo valor efetivamente pago. Conta quitada aparece verde como Pago.
- Edição individual/em planilha permite corrigir os acumulados; histórico registra antes/depois e detalhes da baixa.
- Regravação da compra preserva baixas e ajustes das parcelas. Proteções contra duplo clique, saldo desatualizado e salvamento não confirmado.
