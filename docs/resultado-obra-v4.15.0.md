# Engefex — Resultado da obra (v4.15.0)

## Apuração
- Contrato: soma do campo `projects.value` das obras selecionadas.
- Despesa contabilizada neste painel: soma **uma única vez** de cada registro de `state.costs` atribuído à obra, já com acréscimos e descontos de pagamento, sem categorias de `destination=stock/general`.
- Compras e notas fiscais confirmadas geram linhas financeiras em `state.costs` rateadas por obra; somar `purchases.total` novamente seria duplicidade.
- Mão de obra: medição com status **Liberada** gera custo financeiro em `state.costs`; contratos sem medição liberada aparecem à parte como compromissos futuros.
- Resultado bruto parcial = contrato - despesas lançadas.
- Margem parcial = resultado / contrato, caso contrato > 0.
- Recebido: `state.receipts`; pago: `state.costs[].paid`. Fluxo líquido de caixa = recebido - pago. Não confundir fluxo com rentabilidade.
- Gráficos: rosca por categoria (materiais, mão de obra, gerais, outros), participação das despesas no contrato, barras mensais (datas da compra, do custo ou recebimento), detalhamento dos últimos custos.
- Filtro 'Todas as obras' soma as obras cadastradas, sem ratear automaticamente despesas gerais ou estoque ainda não atribuídos.
- Segurança: tela exige simultaneamente acesso a `dashboard`, `payables` e `receivables`, ou administrador. Não houve mudança no esquema de permissões do banco.

## Limites de interpretação
Esta apuração é gerencial e **não é lucro líquido contábil**. Despesas ainda não cadastradas, impostos, encargos, retenções, custos indiretos gerais não rateados e compromissos futuros podem alterar o lucro final. Quando não há custos registrados, mostra aviso de que o saldo não representa lucro realizado.

## Testes
`node tests/project-profit.test.cjs` testa rateio entre obras, notas e mão de obra já materializadas, descontos, pagamento, caixa, exclusão de 'Geral/Estoque' e gráficos. Teste manual autenticado no navegador permanece recomendado.
