# Controle de aditivos contratuais — Engefex 4.16.0

## Fluxo
1. Acesse **Gerenciamento de obras → Orçamento → Aditivos** e selecione uma obra.
2. Cadastre número, objeto, data e itens (unidade, quantidade e preço unitário).
3. Salve como **Rascunho**, depois altere para **Em aprovação**; apenas aditivos aprovados aumentam o valor de contrato.
4. Clique em **Aprovar aditivo** depois de confirmar o aceite contratual. Isso cria um grupo financeiro `AD-001` e itens próprios no `budgetItems`.
5. Esses itens aprovados poderão ser usados no módulo normal de **Medições**. O cronograma continua independente — acrescente as atividades e prazos adicionais por lá quando necessário.

## Preservação do contrato e segurança
- `projects[].value` continua sendo o contrato **original** e não sofre alteração.
- Aditivos são armazenados como objetos `budgetStages[].amendment`, aproveitando o controle de acesso existente ao orçamento. Rascunhos não criam linhas de medição.
- Grupo aprovado armazena valor aprovado e linhas de serviços. `budgetItems[].amendmentStageId` estabelece vínculo imutável para auditoria. Edição/exclusão acidental por formulário comum bloqueada; uma revisão exige novo aditivo.
- `Obras.contractValue(s,project)` = valor do contrato original + soma de aditivos **Aprovados**; usado em Visão Geral, Orçamento e Dashboard de Resultado.
- Não há migração SQL ou alteração destrutiva do banco de dados.
- A página principal de orçamento ainda mostra grupos adicionais aprovados dentro da planilha e, durante análise, os grupos em rascunho aparecem com valor 0 na árvore e seu valor de proposta na aba Aditivos.

## Limitações de escopo
- Aditivos **supressivos** (valores negativos), anexação do termo assinado, importação de planilhas externas para o aditivo e revisão de item já aprovado não estão automatizados nesta versão.
- Antes da aprovação, confirme autorização contratual e fiscal; clicar em Aprovar equivale a registrar internamente que o documento foi aprovado, sem assinatura eletrônica.
- Aditivo aprovado soma **receita contratual**, não significa valor recebido. Recebimentos continuam sujeitos ao módulo de medições e contas a receber.

## Testes
`node tests/additives.test.cjs` cobre estados, preço, integração com orçamento, valor contratado, lucro parcial, duplicidade, integridade e imutabilidade.
