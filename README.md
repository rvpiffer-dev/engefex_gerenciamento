# Engefex Gerenciamento

Gerenciador independente, inicialmente vazio. Não contém dados de clientes, obras, orçamentos ou registros de exemplo.

## Abrir

No GitHub: Settings → Pages → Build and deployment → Source → GitHub Actions. Execute Actions → Verificar e publicar aplicativo → Run workflow se a publicação não iniciar. O aplicativo fica em https://rvpiffer-dev.github.io/engefex_gerenciamento/.

Para uso local: `python3 -m http.server 8765 --bind 127.0.0.1`, nesta pasta. Acesse http://127.0.0.1:8765/dist/. Use sempre o mesmo endereço e navegador. Não é necessário instalar dependências ou compilar.

## Começar

1. Obras → Adicionar obra. Informe os dados contratuais e responsáveis.
2. Selecione a obra no topo.
3. Serviços / Etapas / Orçamentos → Importar Excel. Escolha o arquivo e a aba, confira a prévia e confirme.
4. Todos os registros oferecem Visualizar, Editar e Excluir. Salvar grava as mudanças; Cancelar descarta o formulário.
5. Diário de obras → Adicionar registro diário. Inclua efetivo, fotos e legendas, salve e use Gerar DOCX.
6. Exporte o backup regularmente, incluindo os anexos.

## Importador XLSX

Padrão Engefex: B código, C descrição, D/E unidade e quantidade (reconhecidas pelo conteúdo), F/G/H unitários de mão de obra/material/equipamento, I/J/K totais por categoria e L total. Cabeçalhos podem ocupar várias linhas. Etapas podem ter subetapas; linhas sem unidade e quantidade são agrupadores. A prévia permite inverter unidade e quantidade.

O leitor percorre as linhas disponíveis, sem depender da quantidade de serviços ou posições fixas de totais. Reconhece TOTAL, TRIBUTOS e TOTAL GERAL. Lê fórmulas pelo último resultado gravado no arquivo; salve/recalcule no Excel ou LibreOffice antes de importar. Fórmulas sem resultado ou dados inválidos bloqueiam a confirmação. O arquivo original não é modificado. Importação não calcula fórmulas novas.

Os valores por categoria ficam nos serviços e podem ser editados. As verbas de planejamento das etapas são campos próprios. Importar não preenche datas nem substitui o valor contratado da obra. Códigos já existentes são rejeitados para evitar duplicação. Para importar um arquivo parcial sem as etapas superiores, a prévia informa os vínculos ausentes.

## Diário e anexos

O DOCX segue o modelo de diário da Engefex: logotipo, identificação, clima manhã/tarde, efetivo (função, quantidade, empresa e horas), atividades, equipamentos, observações, registro fotográfico e assinaturas. Não preenche assinaturas digitais. Nomes e números de registros anteriores não são pré-cadastrados. Fotos entram no DOCX como imagens incorporadas, com legenda e proporção preservada.

Fotos são reduzidas para até 1.600 pixels e convertidas a JPEG. JPEG e PNG são recomendados. Outros formatos dependem do navegador. Documentos podem receber anexos diversos; o diário aceita imagens. Limite por arquivo: 20 MB. Anexos ficam no IndexedDB e metadados no localStorage, em chaves exclusivas deste aplicativo. O backup JSON contém todos os arquivos ainda vinculados aos registros. Arquivos removidos ficam órfãos no armazenamento e não entram no backup.

## Funcionamento dos controles

Cadastros de contratação, pagamento, cotação, medição e recebimento são independentes. Não há geração automática de lançamentos. Cotações não comprometem verba. Estoque soma saldo inicial, entradas e ajustes positivos, menos consumos, perdas e ajustes negativos. Pedidos em aberto são atualizados manualmente. Diário não modifica avanço físico: edite a quantidade executada em Serviços.

Datas, duração e dependências são editáveis; não há reprogramação automática ou cálculo de caminho crítico nesta versão. Total de serviço é editável, sem recalcular automaticamente ao mudar os unitários. Campos vazios são preservados como desconhecidos; valores zero continuam zero.

Excluir obra remove seus registros mediante confirmação. Excluir etapa, serviço ou material preserva os demais registros e retira seus vínculos diretos. A recuperação de itens excluídos depende de backup anterior. Exporte antes de exclusões amplas.

## Celular e uso offline

Após a primeira carga com internet, aguarde Pronto para uso offline. O botão Instalar no celular explica os passos de Android e iPhone. O service worker guarda os arquivos do aplicativo; os anexos continuam no IndexedDB. A instalação pode usar armazenamento separado em alguns aparelhos: use backup para transferir registros se necessário.

## Armazenamento e publicação

GitHub Pages hospeda a interface. Registros e fotos ficam neste navegador e não são enviados ao GitHub, sincronizados ou protegidos por login. Banco, regras de acesso e sincronização serão adicionados depois. Não publique backups no repositório. A aplicação usa caminhos relativos e pode rodar em computador ou navegador móvel. A operação por toque em Android/iOS precisa ser conferida no aparelho; a verificação desta entrega cobre lógica e geração de documentos, sem navegador real.

## Verificação e bibliotecas

`node --test tests/*.test.cjs`

Testes sem instalação: cadastros vazios, criação/edição/exclusão, preservação de outra obra, vínculos, interpretação XML, hierarquia de importação, totais, dados ausentes, códigos duplicados e renderização lógica das áreas.

Bibliotecas distribuídas localmente: docx 9.6.1 (MIT) e JSZip (MIT/GPL, uso sob MIT). Licenças em dist/vendor. Nenhum documento de cliente está incluído.
