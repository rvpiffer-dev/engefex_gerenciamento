# Engefex — otimização de desempenho v4.14.0 (homologação)

Data: 21/10/2026. Repositório: `rvpiffer-dev/engefex_gerenciamento`.

## Ponto de recuperação

- Código preservado na branch `backup/pre-otimizacao-2026-10-21`, commit `68834e119be5de90d1fd5c60762bc5b54be187e3` (v4.13.47).
- Supabase: `engefex_private.release_safety_snapshots`, id `2`, label `pre-otimizacao-2026-10-21`, revisão `284`.
- Inclui payload original, estoque Nextar e inventário de 119 anexos; **não** contém os bytes físicos do Storage nem configurações completas do Supabase Auth. Não é backup externo/offsite. Para proteção integral, exportar também o backup no aplicativo e baixar os anexos.

## Problema medido

- JSONB original: 7.848.848 bytes em texto; histórico: 667 eventos.
- Projeção compacta (50 eventos recentes): 725.976 bytes — cerca de 90,75% menos bytes na resposta do estado.
- Histórico completo **continua gravado** em `public.engefex_state`; nenhuma exclusão/pruning foi feita.
- `pg_stat_statements` apontou muitos acessos ao estado inteiro. A projeção ainda lê o JSONB grande na execução SQL; ganho maior é em transferência, parse, clones e cache do navegador.

## Mudanças preparadas

1. RPC `public.engefex_read_state_compact(uuid)`: verifica `auth.uid()`, associação à workspace e permissões, retornando 50 eventos recentes para quem possui leitura integral; para usuários restritos preserva `engefex_private.project_state`.
2. `dist/cloud.js`: solicita RPC compacta quando autorizado, com fallback para RPC anterior se não existir; mantém checagem de revisão a cada 20 s, mas consulta permissões a cada 60 s (ou atualização manual); cópias via `structuredClone`.
3. `dist/cloud.js`: **não permite substituição do histórico por um recorte**. Com modo compacto, somente eventos novos podem ser inseridos no começo; exigido `engefex_patch_state`; se patch não estiver disponível, bloqueia o salvamento de forma segura.
4. `dist/app.js`: consulta histórico antigo sob demanda, mostra 50 eventos por padrão; backup completo recarrega o estado integral pela RPC antiga, com verificação de revisão.
5. `dist/access.js`: permite consultar histórico antigo em telas somente leitura.
6. Atualizados versão e service worker apenas na branch de homologação (4.14.0).

## Estado de implantação

- Nova RPC **já adicionada** ao Supabase como migração aditiva `engefex_compact_state_read_20261021`; não altera consultas existentes nem apaga informações.
- Interface **não publicada**: arquivos alterados somente na branch `otimizacao/performance-2026-10-21`. A branch principal e a versão publicada continuam na v4.13.47, sujeitas a outros commits posteriores.

## Testes realizados

- Verificação sintática de `dist/cloud.js` e `dist/app.js`: OK.
- RPC testada com contexto simulado de administrador e usuário comum: projeção idêntica à prevista; revisões preservadas.
- RPC bloqueia solicitação sem identidade autenticada; `anon` não possui permissão de EXECUTE.
- Teste de inserção no histórico: 667 itens originais + 1 novo = 668, sem exclusão.
- Teste read-only de tamanho do JSON: 7.848.848 → 725.976 bytes.
- Ainda **não** testados login, salvamento e geração de PDF no navegador real, nem tempos reais de carregamento. Não publicar em produção sem testar esses fluxos.

## Homologação sugerida

1. Em ambiente isolado, entrar como administrador e como usuário comum.
2. Abrir obras, RH, fabricação, estoque e lousa; conferir permissões.
3. Editar uma tarefa da Lousa e um documento RH; confirmar salvamento, atualização em outra sessão e revisão.
4. Consultar histórico recente e histórico antigo; conferir restauração por registros de exclusão, quando aplicável.
5. Exportar backup geral, verificar todos os registros e anexos. Confirmar que não houve perda de eventos antigos.
6. Comparar tempo de carga inicial, bytes transferidos, latência das requisições e responsividade no navegador.

## Reversão

- Reverter a interface à branch `backup/pre-otimizacao-2026-10-21` ou à versão estável mais recente, mantendo dados atuais no banco (não sobrescrever dados novos automaticamente).
- A RPC nova pode permanecer instalada sem causar efeitos na interface antiga. Se desejar removê-la após reverter a interface: `drop function if exists public.engefex_read_state_compact(uuid);`, executado em migração controlada.
- Não restaurar o snapshot nº 2 automaticamente: isso substituiria alterações feitas após a revisão 284. Usar somente em cenário de recuperação, após comparar revisões.
