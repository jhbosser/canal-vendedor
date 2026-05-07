# Aba Dados — sincronização e agendamento

Igual ao app_gerencial_seek, mas sem servidor Windows: a fila + agendamento rodam dentro do próprio Supabase via `pg_cron` + `pg_net` chamando a Edge Function `sync-dados`.

## Componentes

| Camada       | Arquivo                                                          |
|--------------|------------------------------------------------------------------|
| Tabela       | `supabase/migrations/005_sync_executions.sql`                    |
| Função/cron  | `supabase/migrations/006_sync_trigger_e_cron.sql`                |
| Edge Function| `supabase/functions/sync-dados/index.ts` (atualiza `sync_executions`) |
| Frontend     | `frontend/src/pages/Dados.jsx`, rota `/dados` em `App.jsx`, aba no `Header.jsx` (visível para `cargo` proprietário/gerente) |

## Fluxo

1. Cron (`0 6 * * *` e `0 15 * * *` UTC = 03h/12h SP) ou botão "Atualizar agora" no app chamam `trigger_sync(tipo, criado_por)`.
2. `trigger_sync` insere registro `pending` em `sync_executions` e dispara a Edge Function via `net.http_post` passando `exec_id`.
3. Edge Function marca `running` + `started_at`, executa o sync atual, e ao terminar grava `done` + `finished_at` + `duracao_seg` (ou `error` + `erro` com stack).
4. Frontend faz polling de 10s na tabela e mostra status + histórico.

## Setup (uma vez)

### 1. Habilitar extensões
No painel do Supabase do canal_vendedor: **Database → Extensions** → ativar `pg_cron` e `pg_net`.

### 2. Cadastrar secrets no Vault
**Database → Vault**, criar dois secrets:

- `sync_dados_url` → `https://<PROJECT_REF>.supabase.co/functions/v1/sync-dados`
- `sync_dados_service_key` → o `service_role` key do projeto canal_vendedor (Settings → API)

Ou via SQL Editor:
```sql
SELECT vault.create_secret('https://<ref>.supabase.co/functions/v1/sync-dados', 'sync_dados_url');
SELECT vault.create_secret('<service_role_key>', 'sync_dados_service_key');
```

### 3. Rodar as migrations
SQL Editor:
```sql
-- Cole o conteúdo de 005_sync_executions.sql
-- Cole o conteúdo de 006_sync_trigger_e_cron.sql
```

### 4. Redeploy da Edge Function
```bash
supabase functions deploy sync-dados
```

A Edge Function agora aceita `exec_id` no body. Continua funcionando sem `exec_id` para chamadas manuais via `curl`/Postman.

## Verificação

```sql
-- Ver jobs cron registrados
SELECT * FROM cron.job;

-- Disparar manual no SQL Editor
SELECT trigger_sync('manual', 'admin-test');

-- Acompanhar
SELECT * FROM sync_executions ORDER BY criado_em DESC LIMIT 5;
```

Se a função retornar erro `Secrets sync_dados_url / sync_dados_service_key nao configurados no Vault` é porque o passo 2 não foi feito.

## Permissão na aba

Visível só para usuários com `cargo` = `proprietario` ou `gerente` (mesma checagem `podeVerTodos()` usada para "Gerenciar Usuários"). Para liberar mais usuários, edite o cargo na própria aba "Gerenciar Usuários".

## Limites

Edge Function do Supabase tem timeout (~150s no plano Pro, máx 400s). O sync atual cabe folgado, mas se um dia estourar (vendas dos últimos 7 dias muito grandes), a alternativa é mover a execução para o `sync_server.py` do app_gerencial_seek (caminho b descrito originalmente).
