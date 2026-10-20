# Checklist de liberação — Gerenciador Engefex

Este documento contém apenas procedimentos operacionais. **Não colocar senhas, chaves secretas nem backups de dados neste repositório público.**

## 1. Segurança das contas e do banco
- [ ] Confirmar MFA nos acessos administrativos ao GitHub e Supabase.
- [ ] Ativar a proteção de senhas vazadas no Supabase Auth.
- [ ] Confirmar e-mails verificados e política adequada para senhas e sessões.
- [ ] Conferir os alertas no Supabase Security Advisor e documentar justificativas para RPCs privilegiadas.
- [ ] Confirmar RLS de todas as tabelas e controles do bucket privado.

## 2. Permissões: matriz de teste
Executar o teste **também por chamada de API autenticada**, não apenas escondendo botões.

| Conta de teste | Consultar | Atualizar | Outras telas |
| --- | --- | --- | --- |
| Administrador | Sim | Sim | Conforme administração |
| Visualizar | Sim | Não | Apenas módulos autorizados |
| Editar | Sim | Sim | Apenas módulos autorizados |
| Sem acesso | Não | Não | Apenas módulos autorizados |

- [ ] Testar acesso por dois dispositivos diferentes.
- [ ] Testar revogação de permissão em sessão já iniciada.
- [ ] Testar tentativa de ler arquivo/documento não autorizado.
- [ ] Testar dois usuários alterando o mesmo registro e lidar com revisão conflitante.
- [ ] Testar recuperação de sessão e logout em aparelho compartilhado.

## 3. Backup e recuperação
- [x] Referência recuperável do código no GitHub (branch backup/pre-liberacao-2026-10-20).
- [x] Ponto de recuperação interno no Supabase: base de obras + estoque + manifesto dos anexos.
- [ ] Configurar backup **fora do projeto de produção**: banco de dados e 99 anexos binários.
- [ ] Definir destino privado, criptografia, política de retenção e responsáveis pelo acesso.
- [ ] Testar a restauração em ambiente isolado, sem sobrescrever a produção.
- [ ] Verificar integridade de anexos e vínculos após restauração.
- [ ] Registrar data do último backup válido e última restauração testada.

## 4. Publicação segura
- [x] Ambientes Supabase de testes e produção separados.
- [x] Pipeline de testes no GitHub já existente.
- [ ] Proteger branch `main`: PR obrigatório, aprovação e checagens antes do merge.
- [ ] Evitar mudanças diretas em `main` e deploy automático sem revisão.
- [ ] Revisar permissões de colaboradores e segredos GitHub Actions.

## 5. Implantação-piloto
- [ ] Escolher dois ou três funcionários com atribuições reais.
- [ ] Liberar por módulo em etapas; começar com consulta/diário.
- [ ] Validar fotos, DOCX/PDF, fabricação, medições, financeiro e estoque.
- [ ] Conferir simultaneidade em telefone e computador.
- [ ] Definir contato de suporte e procedimento de rollback.
- [ ] Liberar restante da equipe apenas após validação do piloto.
