## 2.18.0 — 18/10/2026

- Compras e notas permitem vincular cada item diretamente aos grupos principais do orçamento, sem selecionar um serviço.
- O rateio entre etapas e obras oferece grupos principais; vínculos históricos com subgrupos e serviços são preservados e identificados.
- Orçamento distingue visualmente grupo principal, subgrupo e serviço, com códigos, recuo, cores e subtotais de serviços sem dupla contagem.
- Mantida a contabilização por parcela e destino e a proteção de pagamentos existentes; cronograma e medições permanecem independentes.
- Validação: 214 testes de regressão.

## 2.17.0 — 18/10/2026

- Campos monetários compartilham apresentação BRL (R$150.000,00) ao abrir e ao sair da edição, incluindo formulários, grades, compras, mão de obra, pagamentos e filtros. Quantidades e percentuais continuam separados.
- Salvamento numérico preserva precisão de unitários sem alteração; formato brasileiro aceito nos cálculos e filtros.
- Nova obra oferece importar orçamento após salvar, usando o mesmo importador de Orçamento, com modelos Matheus e Orlando, prévia e escolha de copiar para planejamento. Atalho contextual na linha da obra.
- Visão geral e Obras ficam na raiz; Medições passa para Gerenciamento de obras. Financeiro reúne Contas a pagar e Contas a receber.
- Contas a receber oferece Ver medição; preservadas integrações compra/parcela/rateio → contas a pagar e medição aprovada/retenção → contas a receber, sem gerar recebimentos automaticamente.
- Versão exibida no menu corrigida; seletor de arquivo legado sem uso removido.
- Validação: 211 testes de regressão e integração.

## 2.16.6 — 18/10/2026

- Compras e notas sugerem fornecedores cadastrados ao preencher nome ou CNPJ/CPF e completam os dados quando há correspondência única.
- Mantida a seleção direta de fornecedor e o preenchimento manual.

## 2.16.5 — 18/10/2026

- Lançamento e edição de compras e notas abrem em tela cheia, com mais espaço para itens, parcelas e rateios.
- Cabeçalho e fechamento acessíveis, com respeito às áreas seguras no celular.

## 2.16.4 — 18/10/2026

- Botão Medir 100% por item na nova medição em planilha preenche o acumulado e seleciona a linha, contabilizando somente o saldo restante.
- A alteração só é gravada ao salvar a medição; itens já concluídos permanecem bloqueados.

## 2.16.3 — 18/10/2026

- Botão Liberar por medição inteira, com datas e evidência comuns, gravação atômica e proteção contra dados desatualizados e duplo clique.
- Após aprovação de todos os itens, botão verde Liberada. Grupo com status diferentes pode ser liberado respeitando o saldo do orçamento.
- Contas a receber atualizado conforme retenção; liberação não registra recebimento nem libera retenções contratuais.

## 2.16.2 — 18/10/2026

- Planilha de medição ocupa toda a janela no computador e no celular, com cabeçalho e fechamento acessíveis e respeito às áreas seguras da tela.
- Demais diálogos preservam suas dimensões.

## 2.16.1 — 18/10/2026

- Medições agrupadas por número e obra, com vários itens, valor bruto e detalhes individuais.
- Nova medição em planilha como ação principal, com acumulado anterior preenchido e lançamento somente do incremento.
- Itens já medidos em 100% continuam visíveis e bloqueados na próxima planilha, inclusive no preenchimento em lote e após falha ao salvar.
- Mantida a edição dos lançamentos anteriores para correções e a separação entre orçamento e cronograma.

## 2.16.0 — 18/10/2026

- Distribuição mensal de etapas segue automaticamente as datas planejadas das atividades e subetapas, por dias corridos, com meses de calendário e horizonte ampliado.
- Alterações e importações do cronograma recalculam a distribuição; datas ausentes são sinalizadas.
- Ajuste manual disponível no cronograma e pela grade, exigindo soma de 100% e justificativa. Retorno ao automático preserva o ajuste salvo.
- Orçamento financeiro e medições permanecem independentes.

## 2.15.0 — 17/10/2026

- Importação de orçamento oferece Tipo 1 — Matheus (Excel .xlsx) e Tipo 2 — Orlando (PDF com texto selecionável).
- Tipo 2 lê a tabela de quantidades, descrições, preços unitários e totais por posição, verifica a soma com o total geral e bloqueia PDFs incompletos ou inconsistentes.
- Prévia com unidades editáveis, sem inferir unidades ou dividir custos de mão de obra/material/equipamento. Conferência explícita antes de confirmar.
- PDF original, metadados e observações ficam em Documentos; o orçamento permanece independente do cronograma, com cópia para planejamento somente quando escolhida.
- Proteções de alteração de obra/estado durante leitura e preparo, confirmação online e duplo clique. Mantida a importação do modelo Matheus.

## 2.14.1 — 17/10/2026

- Validação de contrato informa especificamente prestador, descrição, valor ou data ausente/inválida, destacando e focando o campo correspondente.
- Erros de medição identificam a linha e o campo que precisam ser corrigidos, com orientações para número, valor, data e vencimento.
- Formulário de contrato usa a grade responsiva existente; no celular, medições aparecem em blocos verticais com rótulos, campos e comprovantes visíveis, sem exigir rolagem lateral.
- Campos obrigatórios identificados e orientação para salvar somente o contrato quando ainda não houver medições.

## 2.14.0 — 17/10/2026

- Contratos de mão de obra permitem selecionar uma etapa do orçamento ou Obra geral (empreita completa), sem criar etapa fictícia nem exigir orçamento cadastrado para a empreita geral.
- Cada medição do prestador aceita múltiplos comprovantes em imagem ou PDF, até 20 MB por arquivo, com abertura e remoção no cadastro de origem.
- Arquivos usam o armazenamento de anexos do aplicativo, sincronização privada no Supabase e backup com conteúdo; metadados ficam vinculados à medição.
- Backup remapeia também anexos dentro das medições e do histórico. Comprovantes de imagem não são confundidos com fotos do diário na restauração.
- Empreitas gerais entram no comprometido e nos pagamentos da obra sem duplicar parcelas e podem ser filtradas em Contas a Pagar pela opção Obra geral.

## 2.13.0 — 17/10/2026

- Contas a receber ganha filtros recolhidos por cliente, cobrança/documento, obra (incluindo sem obra), tipo, lançamento, vencimento/previsão, último recebimento, saldo e vencidos; filtros também aplicados ao CSV.
- Compras e notas ganha Contratos de mão de obra, integrado ao cadastro de fornecedores, com contrato total e medições manuais do prestador.
- Apenas medições liberadas geram parcelas em Contas a Pagar; rascunhos permanecem no contrato. Cada parcela mantém seu vencimento e pagamento independente.
- O total contratado fica comprometido no orçamento, sem duplicar as parcelas liberadas. O contrato mostra total, liberado, pago e saldo a liberar.
- Proteções contra medições acima do contrato, números repetidos, exclusão de parcelas baixadas e edição da origem pelo contas a pagar; salvamento idempotente preserva pagamentos e descontos.
- Contratos e medições integram backup, histórico e sincronização; visualização/edição/exclusão disponíveis no cadastro de origem.

## 2.12.0 — 17/10/2026

- Financeiro → Contas a receber ganha + Conta a receber para cobranças avulsas, com cliente, descrição, documento, valor, lançamento, vencimento e observações.
- Obra opcional: permite Sem obra específica, inclusive sem qualquer obra cadastrada.
- Recebimentos parciais ou totais com saldo atualizado, abas Em aberto e Recebidos, edição/visualização/exclusão e correção de recebimentos.
- Cobranças avulsas usam referências próprias; não criam medições nem consomem seus saldos, mesmo com números iguais.
- Backup e sincronização incluem as contas avulsas, com validação de valores, datas e referências. Exclusão/alteração de contas recebidas exige corrigir os recebimentos antes.

## 2.11.0 — 17/10/2026

- Medições passam a usar o fluxo manual em planilha; previsão automática vinculada ao cronograma removida da navegação, preservando dados históricos no backup.
- Contas a receber calcula os valores líquidos aprovados diretamente das medições, sem duplicar lançamentos e sem gerar receitas a partir do cronograma.
- Abas Em aberto e Recebidos, saldos parciais, cliente, obra, data prevista e registro de recebimento preenchido com a medição e o saldo disponível.
- Retenções entram separadamente em contas a receber após liberação. Recebimentos podem ser corrigidos pela própria lista; exportação CSV e consulta adaptada ao celular.

## 2.10.0 — 17/10/2026

- Percentuais de retenção independentes para entrada e demais medições, configurados por obra/contrato; novos contratos iniciam em 0% e 5%, ambos editáveis.
- Entrada lançada como primeira medição dos itens do orçamento, consumindo quantidades e saldo, sem novo faturamento do mesmo valor.
- Planilha de medição permite escolher Entrada e aplicar um acumulado percentual a todos os itens.
- Retenção calculada em centavos sobre o total aprovado de cada número de medição; percentual preservado nas medições existentes.
- Nova aba Entrada e retenções: bruto, líquido, retenção, liberação e saldo retido. Recebimentos distinguem líquido da medição e retenção liberada.
- Proteções de saldo, edição/exclusão, cobertura de recebimentos, importação de backup e concorrência no Supabase. Registros antigos mantêm seus valores, sem retenção retroativa automática.

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

## v2.3.1 - filtros recolhidos

- Filtros de contas a pagar iniciam fechados e abrem ao clicar em Filtros.
- Mantém a escolha de abrir/fechar durante a navegação e indica quando há filtros ativos.

## v2.4.0 - experiência em celular

- Contas a pagar em cartões no celular, com saldo, vencimento e ações principais à vista. Tabela mantida no computador.
- Menu lateral com fundo escurecido, botão de fechar, fechamento ao navegar e bloqueio da rolagem de fundo.
- Cabeçalho com seletor de obra flexível e alvos de toque maiores.
- Formulários em painel inferior, fonte de entrada de 16px, ações acessíveis e respeito às áreas seguras.
- Filtros em duas colunas, cartões de totais ajustados, grades roláveis e orientação de rolagem nas tabelas de consulta.
- Sem alterações nos dados ou nas regras financeiras.

## v2.4.1 - listas de obras no celular

- Listas de obras, atividades, materiais, compras, checklist, pendências, equipes, responsáveis e diário clássico apresentadas como cartões no celular.
- Campos essenciais e ações visíveis; botão Mais detalhes revela campos complementares. Hierarquia de etapas e check de conclusão preservados.
- Consulta no computador, impressão, orçamento, cronograma/Gantt e editores em grade mantêm o formato de tabela. Sem duplicar registros ou alterar dados.

## v2.4.2 - medição por orçamento da obra

- Seletor da medição lista somente itens do orçamento da obra selecionada, com código, quantidade, unidade e valor orçado.
- Trocar a obra reconstrói o seletor financeiro e limpa seleção incompatível, inclusive em navegadores móveis.
- Orçamento vazio mostra orientação, sem recorrer a atividades do cronograma. Medições anteriores preservadas.


## v2.5.0 - medições acumuladas em planilha

- Nova medição em planilha por obra, com uma linha por item do orçamento, anterior, acumulado atual, incremento, valor e saldo.
- Preenchimento em percentual ou quantidade acumulada. A segunda medição inicia pelos acumulados anteriores e grava somente aumentos selecionados. Preparadas contam no anterior; glosas não contam.
- Pesquisa por código, item ou etapa e colagem de uma coluna do Excel. Sem recorrer ao cronograma.
- Lote salvo como Preparada, preservando edição individual e edição em grade existentes. Número da medição exclusivo na obra; valores acima de 100%, redução do anterior e itens de outra obra são bloqueados atomicamente.
- Proteções contra duplo clique, dados alterados durante o preenchimento e falta de confirmação no Supabase. Sem criar recebimentos, aprovações ou alterações no orçamento/cronograma.

## v2.6.0 - compras, notas e fornecedores

- Menu Compras e notas com abas Compras e notas e Fornecedores. Estoque, insumos e movimentos retirados dessa navegação; dados históricos preservados.
- Cadastro global de fornecedores com visualizar, adicionar, editar e excluir. Exclusão desassocia o cadastro sem apagar dados das compras ou pagamentos.
- Seleção de fornecedor preenche nome/documento na compra. Dados manuais e XML continuam aceitos; XML pode reconhecer cadastro por documento. Alterações cadastrais não reescrevem dados históricos de notas.
- Filtros recolhidos por documento, fornecedor/documento, cliente da obra, tipo, situação, emissão, vencimento de parcelas e valor.
- Cadastro integrado ao backup, sincronização e proteções de gravação existentes.

## v2.7.0 - rateio de compras entre etapas e obras

- Cada item da nota pode ser dividido em destinos com obra, etapa do orçamento e percentual; confirmação exige soma de 100%. Vínculo único anterior continua disponível.
- Uma única nota gera contas por parcela, obra e etapa; frete/desconto/tributos seguem a proporção dos itens. Centavos dos novos rateios fecham tanto por parcela quanto por destino no total da nota.
- Compra aparece ao filtrar qualquer obra beneficiada, com valor integral da nota e indicação do valor atribuído à obra selecionada.
- Rateios podem ser vistos, alterados ou removidos na prévia. Pagamentos existentes são preservados e alterações que os deixariam sem cobertura são bloqueadas.
- Exclusão/mudança de etapas e obras protege notas compartilhadas de outras obras; ajuste o rateio antes de remover um destino.
- Compras anteriores sem rateio explícito mantêm a regra e os identificadores financeiros anteriores.

## v2.8.0 - uma linha por nota em contas a pagar

- Lista e cartões agrupam todos os rateios e parcelas de uma compra em uma única nota. Clique no valor original para abrir obras, etapas, parcelas e baixas. Contas manuais continuam individuais.
- Filtrar por obra/etapa encontra a nota sem cortar seu valor integral; aviso explica que os totais da lista consideram documentos completos. Dashboard financeiro por obra continua usando os rateios.
- Pagar opera sobre a nota inteira. Parcial abate parcelas por ordem de vencimento, com distribuição proporcional entre destinos; quitação distribui desconto/acréscimo sobre os saldos restantes.
- Uma nota permanece em aberto enquanto houver saldo em qualquer destino; só aparece em Pagos quando quitada integralmente. CSV acompanha o agrupamento.
- Rateios, pagamentos e valores originais preservados no banco; agrupamento é derivado da estrutura financeira existente.

## v2.9.0 - identidade Engefex

- Logotipo original no menu e na tela de acesso. Azul, preto e cinza aplicados à navegação, botões, destaques e seleções.
- Ícone do aplicativo usa o símbolo da marca original; cores de tema e manifesto atualizadas.
- Identidade adaptada ao celular, com indicadores de pago, vencido e alerta mantidos por significado. Sem alterações de dados ou regras de negócio.
