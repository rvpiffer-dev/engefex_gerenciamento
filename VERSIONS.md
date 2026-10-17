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
