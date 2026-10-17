# Engefex Gerenciamento

Gerenciador de obras estático para computador, Android e iOS, com menu lateral, edição em planilha, orçamento Excel, cronograma PDF/Gantt e diário completo Engefex. Começa vazio. Registros, anexos e histórico são locais ao navegador; o GitHub hospeda o aplicativo, não um banco de dados.

## Orçamento e planejamento separados

- **Orçamento**: itens, quantidades, preços, totais, verbas, cotações, contratos, pagamentos e planejamento financeiro mensal. Coleções `budgetStages` e `budgetItems`.
- **Etapas e atividades / Cronograma**: planejamento de execução, datas, duração, predecessoras, responsáveis, avanço, diário e Gantt. Coleções `stages` e `activities`.
- **Medições e recebimentos**: usam os itens e os preços do orçamento, sem exigir atividade correspondente ou avanço no cronograma. Quantidades acumuladas não podem exceder o item orçado; pagamentos ficam limitados às medições aprovadas.

Editar, excluir, reprogramar ou importar dados em uma área não atualiza nem exclui os registros da outra. O avanço do cronograma usa a média dos percentuais das atividades, sem pesos financeiros. Diário atualiza o avanço do planejamento; não altera os quantitativos do orçamento ou medições.

A versão `dataModel: 2` migra cadastros anteriores: mantém os itens e valores financeiros, vínculos de medições, histórico, fotos e execução; preserva também o planejamento já existente como cópia independente. Itens de planejamento criados por PDF sem valor financeiro não viram orçamento. IDs antigos das medições são preservados na coleção financeira. A migração é idempotente; a aplicação guarda a versão anterior no mesmo navegador antes da primeira gravação da separação. Planejamento antigo não é removido automaticamente.

## Começar

1. Obras → Nova obra. Nome, código curto, contrato, valores e prazos são editáveis; início pode ficar em aberto.
2. Selecione a obra no topo.
3. Orçamento → Importar orçamento Excel. Confira a aba, os valores e a opção de gerar cronograma.
4. Cronograma → Importar cronograma PDF, ou cadastre manualmente etapas e atividades.
5. Medições e recebimentos → Item de medição: selecione um item do orçamento.
6. Exporte backup ao encerrar o trabalho.

Cadastros podem ser adicionados, visualizados, editados e excluídos. Excluir etapas do planejamento remove suas atividades e vínculos operacionais, preservando orçamento e medições. Excluir item ou etapa financeira com medições exige remover as medições antes; essa proteção evita deixar recebimentos sem base. Excluir uma obra remove seus registros de ambas as áreas mediante confirmação. Alterações ficam no histórico.

## Importação do orçamento Excel

Layout Engefex: B código, C descrição, D/E unidade e quantidade (inferidas pelo conteúdo), F/G/H preços unitários de mão de obra/material/equipamento, I/J/K totais por categoria e L total. Linhas e etapas podem variar. Subtotais, tributos e total geral são conferidos sem somar novamente os serviços. Fórmulas dependem dos resultados salvos no Excel. Verbas internas e valores de venda permanecem distintos.

A importação oferece duas opções:

- **Não — somente orçamento e medições** (inicial): cria apenas etapas financeiras e itens do orçamento. Não altera etapas, atividades ou datas do cronograma existente. Depois, o PDF pode ser usado para todo o planejamento.
- **Sim — copiar para o cronograma**: além do orçamento financeiro, cria cópias de todas as etapas e serviços no planejamento, com IDs próprios e sem preços ou vínculos de atualização automática. As datas são definidas depois. Alterações posteriores no orçamento ou na cópia ficam restritas à respectiva área.

A opção de atualizar o valor contratado da obra pelo total geral do arquivo fica desmarcada por padrão. Códigos duplicados são conferidos somente dentro do orçamento da obra; uma EDT usada no PDF não impede importar o Excel.

## Edição em planilha

Orçamento → Planilha de serviços permite editar descrição, unidade, quantidade, preço unitário, total e unitários de custos. Quantidade/preço alterado recalcula o total; total alterado recalcula o preço. O valor contratado da obra é separado. Planilha de verbas edita as categorias financeiras e o saldo a contratar. Vazio significa a definir; zero é um valor informado.

Cronograma → Planilha edita ordem, descrição, datas, duração em dias corridos, predecessoras e responsável. Predecessoras usam os números fixos das linhas da edição atual, separados por vírgula, e indicam término → início. A ordem é aplicada ao salvar; os vínculos não deslocam datas automaticamente. A duração escrita no PDF fica em coluna de referência.

Tab avança entre células e Enter desce na mesma coluna. Cole blocos tabulados do Excel a partir de uma célula. Blocos fora dos limites são rejeitados inteiros. Salvar alterações grava todo o lote; erro de validação impede toda a gravação. Descartar alterações abandona o rascunho. Datas aceitam AAAA-MM-DD ou DD/MM/AAAA; números aceitam vírgula decimal. Há avisos de edição pendente e controle contra sobreposição de gravações entre abas.

## Conclusão rápida

Etapas e atividades → check Concluir na própria linha. Registra 100% da quantidade prevista e término real hoje, sem abrir formulário. O botão fica marcado e pode ser clicado novamente para desfazer e restaurar o avanço anterior. Reabrir uma conclusão feita pelo formulário remove apenas a data de conclusão e preserva a quantidade executada. O check mantém orçamento, medições e registros do diário, grava histórico e aplica as validações do planejamento.

## Cronograma PDF e Gantt

Cronograma → Importar cronograma PDF → arquivo → prévia → conferir os destinos → confirmar. Apenas o planejamento é alterado. Ao concluir, Etapas e atividades abre na obra de destino, com filtros limpos e contagem do resultado.

Compatível com PDF textual de tabela do Project contendo Id, EDT, Nome da tarefa, recursos, Início, Término, % planejado, % concluído, Duração e Predecessoras. Leitura por colunas em todas as páginas, incluindo descrições quebradas. Limites: 20 MB e 100 páginas. PDFs escaneados e vínculos especiais (II, TT, defasagens) são sinalizados como erro e não importados silenciosamente.

Etapas-resumo organizam a hierarquia. Etapas existentes do planejamento são reaproveitadas por vínculo de importação ou nome único. Atividades existentes são sugeridas por vínculo anterior, nome único ou código e etapa coincidentes; casos ambíguos podem ser revistos. EDTs repetidas com Ids distintos são mantidas separadas e avisadas. Predecessoras de resumos expandem para suas atividades. Vínculo inválido, ciclo ou dois destinos iguais rejeitam o lote.

Novas atividades do PDF têm unidade %, quantidade 100 e execução percentual conforme o documento. Datas planejadas não viram datas reais. Duração original é preservada: calendário de trabalho e feriados não são importados nem usados para recalcular datas. O Gantt mostra as barras, o avanço e conflitos entre datas e predecessoras. Todos os registros permanecem editáveis.

PDF.js 4.10.38 (Apache-2.0), worker e licença estão em `dist/vendor`. Leitura com `isEvalSupported:false`, sem enviar documentos ao servidor. Recursos são preparados para uso offline.

## Demais áreas

Visão geral, agenda do engenheiro (dia/semana/tarefas), materiais e compras, estoque/consumos/perdas, checklist, riscos e pendências, documentos/anexos e equipes/produtividade foram preservados. Comprometido, incorrido, pago e recebido são controles distintos.

Documentos podem receber anexos locais. A pasta de originais pode ser vinculada para consultar documentos externos; arquivos não anexados permanecem na pasta original. Fotografias do diário são anexadas, com legendas, e entram no DOCX e no backup.

## Diário completo

Diário de obra → Diário completo integra o formulário Engefex, clima, efetivo editável, equipamentos, observações, fotos com legenda, assinaturas, prévia, impressão/PDF e o gerador DOCX do aplicativo original. A subaba Avanço e produtividade mantém lançamentos incrementais por atividade do planejamento. Editar um registro aplica somente a diferença ao avanço.

Fonte React em `modules/diary`, saída pronta em `dist/diary`: não é necessário compilar para usar. Para reconstruir somente esse módulo, instale suas dependências e execute o script build. Código do serviço original em `modules/diary/cloud-source` é referência para futura implantação com servidor. Bibliotecas e licenças estão documentadas nessa pasta.

No GitHub Pages, o módulo usa obras, diário e arquivos locais do gerenciador. O botão Versão online abre o aplicativo original com sua autenticação e armazenamento próprios. As versões não sincronizam automaticamente.

## Backup, atualização e publicação

Exportar backup gera JSON com registros, as duas áreas, histórico e anexos. Importar backup substitui os dados locais mediante confirmação. Mantenha cópias fora do aparelho. Não há conta, autenticação, sincronização entre dispositivos ou banco compartilhado nesta versão.

Outras abas do mesmo navegador são atualizadas por eventos de armazenamento/foco/visibilidade. A atualização visual aguarda quando existe edição pendente em formulário, planilha ou diário.

URL: https://rvpiffer-dev.github.io/engefex_gerenciamento/

Atualizar: `dist/atualizar.html` → Atualizar e abrir atividades. Não apaga registros nem arquivos locais. Há aviso de nova versão no aplicativo. Instalação: Chrome/Android → Instalar aplicativo; Safari/iOS → Compartilhar → Adicionar à Tela de Início. No celular, o menu lateral abre pelo botão no canto superior esquerdo e tabelas permitem rolagem horizontal.

GitHub Pages: Settings → Pages → Source → GitHub Actions. Actions → Verificar e publicar aplicativo → Run workflow. O código do aplicativo é estático e não requer build.

Local: `python3 -m http.server 8765 --bind 127.0.0.1` nesta pasta; abra http://127.0.0.1:8765/dist/. Use o mesmo endereço e navegador para acessar os registros.

## Verificação

`node --test tests/*.test.cjs`

Testes cobrem cálculos, finanças, migração, diário, recebimentos, dependências, importações, geração opcional do planejamento, independência das áreas, edição em lote, Gantt, cache e renderização lógica. Excel e PDF fornecidos também foram usados localmente para verificar os dois fluxos, sem publicar dados de cliente. Testes de interface usam ambiente simulado; não substituem teste por toque em aparelho real.

Outras bibliotecas locais: docx 9.6.1 e JSZip, com licenças em `dist/vendor`. Logotipo Engefex. Não há obras ou documentos de cliente pré-cadastrados.
