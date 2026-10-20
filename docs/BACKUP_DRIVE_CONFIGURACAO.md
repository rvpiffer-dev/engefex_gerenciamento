# Configuração do backup externo — Engefex

A rotina está **desativada** enquanto as credenciais de execução e a chave de criptografia não estiverem configuradas. Os anexos ainda não foram transferidos ao Google Drive.

## Destino já criado
- Google Drive: `Engefex - Backups Gerenciador`
- Subpasta: `Backups diarios criptografados`
- ID da subpasta: `18iUKY5XD34AhO9wsisUaScbtWMZiFq6p`

## Conteúdo previsto
- `postgres.dump`: exportação PostgreSQL custom do projeto inteiro com `pg_dump`, inspecionada pelo `pg_restore --list`.
- `storage/`: arquivos binários do bucket privado `engefex-files`.
- `storage-manifest.json`: lista e SHA-256 de cada arquivo.
- O pacote fica criptografado com `age` e é validado depois do upload com `rclone check`.
- Sem exclusão automática dos backups anteriores.

## Passos que o proprietário precisa autorizar
1. **Chave de recuperação:** instalar `age` em computador confiável, executar `age-keygen -o engefex-backup-key.txt` e guardar a **chave privada fora do Drive e do GitHub**, com uma segunda cópia offline. Apenas a chave pública, iniciada por `age1`, irá à variável de repositório `ENGEFEX_BACKUP_AGE_RECIPIENT`.
2. **Banco:** no Supabase, obter URL de conexão PostgreSQL apropriada para backup completo e adicionar ao GitHub Actions Secret `ENGEFEX_BACKUP_DB_URL`. Nunca publicar a senha.
3. **Arquivos:** no Supabase, obter a chave service_role **somente para o workflow privado** e adicionar ao GitHub Actions Secret `ENGEFEX_BACKUP_SERVICE_ROLE_KEY`. Nunca publicar no frontend.
4. **Drive:** instalar `rclone` e autorizar a conta que fará os backups. Recomenda-se fortemente conta Google separada e dedicada a backups, com acesso apenas à pasta necessária; conceder acesso à pasta antes da configuração. Salvar a credencial OAuth na área GitHub Actions Secrets como `ENGEFEX_BACKUP_GDRIVE_TOKEN`. **Nunca colar token nesta conversa.**
5. **Ativação:** criar variável do GitHub Actions `ENABLE_GDRIVE_BACKUP=true` somente após configurar o restante.
6. Executar `workflow_dispatch` de `Backup Engefex para Google Drive`. Verificar a chegada do primeiro arquivo `.age` e a finalização com `rclone check`.
7. **Restaurar em ambiente isolado:** descriptografar usando a chave privada, verificar dump, recuperar banco de teste e todos os anexos. Somente após sucesso considerar o backup operacional.

## Frequência
- Cronograma proposto: diariamente às 03h20 (Brasília). O workflow pode executar com alguns minutos de atraso.
- Histórico por data; a retenção e o orçamento de espaço devem ser definidos.
- Caso o backup falhe, consultar os avisos e logs da execução no GitHub Actions; o arquivo anterior não é sobrescrito.

## Segurança e limitações
- O conector Google Drive usado pelo ChatGPT **não transfere suas credenciais** para GitHub Actions.
- Permissão excessiva de um token do Drive é um risco: preferir conta dedicada, 2FA e segregação.
- A primeira execução de `pg_dump` ainda precisa ser validada contra as permissões do PostgreSQL gerenciado pelo Supabase.
- Backups do banco não copiam os bytes de Storage automaticamente; ambos são necessários.
- Histórico de cópias não substitui verificação periódica de restauração.
- Nenhum dump, token ou chave privada pode ser salvo no repositório público.
