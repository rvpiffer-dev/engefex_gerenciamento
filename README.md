# Engefex Gerenciamento

Gerenciador vazio baseado na organização e nas regras de cálculo do aplicativo Obras dos Lagos. Mantém navegação lateral à esquerda e todas as áreas originais, com cadastros adicionais e importação de orçamento XLSX.

## Áreas preservadas

- Visão geral: contrato, avanço ponderado, custos previstos e caixa.
- Agenda do engenheiro: dia, semana, todas as tarefas, prioridades, frentes e prazos de compra.
- Etapas e atividades: quantidades, execução, dependências, equipes, critérios de aceitação e próxima ação.
- Cronograma: datas de serviços, duração, distribuição mensal e planejamento financeiro mensal.
- Orçamento e custos: cinco categorias de verba, cotações, comprometido, incorrido, pago e saldo a contratar.
- Materiais e compras: necessidade, estoque, pedidos, consumo, perdas e prazo de pedido.
- Medições e recebimentos: preparação, apresentação, aprovação, evidências e entrada efetiva de caixa.
- Checklist de execução: conferências por fase e etapa.
- Pendências e riscos: responsáveis, criticidade, prazos e decisões.
- Diário de obra: descrição, avanço incremental, horas-pessoa, equipe, ocorrências, fotos com legenda e DOCX Engefex.
- Documentos e diagnóstico: fontes, notas, anexos permanentes locais, pasta de originais e histórico antes/depois.
- Equipes e produtividade: cadastro de equipes e produtividade por serviço calculada a partir do diário.

Obras, etapas, serviços e demais cadastros podem ser adicionados, visualizados, editados e excluídos. A visualização não altera os dados. IDs internos são estáveis. Exclusões de obra e etapa removem os dependentes mediante confirmação; exporte backup antes. Informações removidas ficam registradas no histórico, sem botão de restauração individual.

## Começar

1. Obras → Nova obra. Informe identificação, contrato, valor e prazos; datas podem permanecer em aberto.
2. Selecione a obra no topo.
3. Etapas e atividades ou Orçamento e custos → Importar orçamento Excel.
4. Confira a aba, a prévia, os valores e o destino. A opção de atualizar o valor contratado da obra fica desmarcada por padrão.
5. Edite o planejamento e as verbas internas conforme necessário. Todos os serviços importados permanecem editáveis.
6. Exporte o backup regularmente.

## Importação XLSX

Layout Engefex: B código, C descrição, D/E unidade e quantidade (inferidas pelo conteúdo), F/G/H preços unitários de mão de obra/material/equipamento, I/J/K totais por categoria, L total. Linhas e etapas podem variar. Reconhece etapas, subetapas e serviços, sem somar agrupadores novamente no orçamento.

Fórmulas usam o último resultado salvo no arquivo. Recalcule e salve no Excel/LibreOffice antes de importar. Dados inválidos ou fórmulas sem resultado bloqueiam a confirmação. Códigos já existentes na obra são rejeitados para evitar duplicação. Arquivos parciais sem etapas superiores recebem uma etapa de agrupamento. O arquivo original não é alterado.

Os preços e totais originais são preservados nos serviços. Orçamento de venda e verba interna de custo são conceitos separados; importar preços não inventa custos ou margens. Etapas calculam sua venda pelos serviços, com opção Manual no editor. Etapas agrupadoras somam subetapas; verbas e contratações registradas diretamente no agrupador são adicionais às subetapas. Datas e distribuição mensal não são inventadas.

## Migração e backup

A versão anterior do Engefex é migrada automaticamente, preservando os registros e os anexos. A chave anterior fica intacta. Também é possível importar seu backup JSON anterior. O aplicativo Obras dos Lagos possui armazenamento independente e não é modificado.

Backup inclui registros, histórico e arquivos anexados. Os registros ficam no localStorage; anexos e fotos ficam no IndexedDB deste navegador. Nada é enviado ao GitHub ou sincronizado entre dispositivos. Banco e regras de acesso serão uma etapa futura. Não publique backups no repositório.

## Diário de obra completo

A aba Diário de obra contém a interface completa do aplicativo separado https://diario-de-obras-piffer.rapiffer.chatgpt.site, adaptada para usar as mesmas obras e anexos do gerenciador. Inclui identificação, clima por período, efetivo com linhas editáveis, atividades, equipamentos, observações, fotos com legenda, assinaturas, prévia, impressão/PDF e o mesmo gerador DOCX do aplicativo original. Obras e diários podem ser adicionados, visualizados, editados e excluídos.

A subaba Avanço e produtividade mantém o diário do gerenciador antigo: quantidades incrementais atualizam o avanço e horas-pessoa permitem produtividade. Editar pelo formulário completo preserva esses vínculos e valores.

No GitHub Pages, os registros ficam no navegador e entram no backup do gerenciador. Não há autenticação nem sincronização no módulo local. O botão Versão online abre o aplicativo original, que mantém seu login por conta e fotos online. Os dados dessas duas versões não são sincronizados automaticamente. O código do serviço original foi preservado em modules/diary/cloud-source como referência para a futura implantação com servidor.

O módulo possui fonte React em modules/diary e saída pronta em dist/diary. Não é necessário compilar para usar. Para reconstruir somente esse módulo: instale as dependências de modules/diary e execute seu script build. Bibliotecas e licenças estão documentadas nessa pasta. O aplicativo principal continua estático e sem instalação de dependências.

## Publicação e uso local

GitHub Pages: Settings → Pages → Source → GitHub Actions. Actions → Verificar e publicar aplicativo → Run workflow.

URL: https://rvpiffer-dev.github.io/engefex_gerenciamento/

Local: `python3 -m http.server 8765 --bind 127.0.0.1` nesta pasta; abra http://127.0.0.1:8765/dist/. Use sempre o mesmo endereço e navegador.

No celular, o menu lateral abre pelo botão no canto superior esquerdo. Após a primeira carga com internet, aguarde Pronto para uso offline. A instalação usa o menu do Chrome no Android e Safari → Compartilhar → Adicionar à Tela de Início no iPhone. Para carregar uma atualização, feche e reabra a aplicação com internet.

## Verificação

`node --test tests/*.test.cjs`

Testes de cálculo, caixa, custos, estoque, diário incremental, medições, recebimentos, dependências, exclusão, migração, hierarquia, importação e renderização lógica das telas e subabas. O arquivo XLSX de referência também foi usado numa verificação local de importação e reconciliação, sem publicar seus dados. Não houve teste em navegador real nesta entrega; a operação por toque deve ser conferida no aparelho.

Bibliotecas distribuídas localmente: docx 9.6.1 e JSZip, sob suas licenças em dist/vendor. O logotipo é da Engefex. Não há obras ou documentos de cliente pré-cadastrados.
