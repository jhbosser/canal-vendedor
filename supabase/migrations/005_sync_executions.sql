-- Historico e fila de execucoes do sync (canal_vendedor).
-- Mesmo schema usado em app_gerencial_seek.
--
-- Fluxo:
--   1. Cron job (pg_cron) ou usuario clicando "Atualizar agora" no app
--      chama trigger_sync(tipo, criado_por) -> insere registro 'pending'
--      e dispara a Edge Function sync-dados via pg_net.
--   2. A Edge Function recebe exec_id no body, marca 'running'/started_at,
--      executa o sync, e ao terminar grava 'done'/'error' + finished_at +
--      duracao_seg + erro.
--   3. O frontend (aba Dados) faz polling a cada 10s pra mostrar o status.

CREATE TABLE IF NOT EXISTS sync_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                            -- 'agendado' | 'manual'
  criado_por text,                               -- username de quem disparou (null pra agendado)
  criado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',        -- 'pending' | 'running' | 'done' | 'error'
  started_at timestamptz,
  finished_at timestamptz,
  duracao_seg integer,
  erro text,
  hostname text                                  -- identifica a origem (ex.: 'edge-function')
);

CREATE INDEX IF NOT EXISTS idx_sync_executions_status ON sync_executions (status);
CREATE INDEX IF NOT EXISTS idx_sync_executions_criado_em ON sync_executions (criado_em DESC);

ALTER TABLE sync_executions DISABLE ROW LEVEL SECURITY;
