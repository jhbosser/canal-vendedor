-- =============================================================================
-- Agendamento + disparo do sync via pg_cron e pg_net.
--
-- PRE-REQUISITOS (executar UMA VEZ no Supabase, no painel ou SQL Editor):
--
--   1) Habilitar extensoes:
--        Database -> Extensions: ativar "pg_cron" e "pg_net".
--      Ou via SQL (depende de permissao):
--        CREATE EXTENSION IF NOT EXISTS pg_cron;
--        CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   2) Cadastrar 2 secrets no Vault (Database -> Vault):
--        nome: sync_dados_url
--        valor: https://<PROJECT_REF>.supabase.co/functions/v1/sync-dados
--
--        nome: sync_dados_service_key
--        valor: <SUPABASE_SERVICE_ROLE_KEY do projeto canal_vendedor>
--
--      Ou via SQL:
--        SELECT vault.create_secret('https://<ref>.supabase.co/functions/v1/sync-dados', 'sync_dados_url');
--        SELECT vault.create_secret('<service_role_key>', 'sync_dados_service_key');
--
-- Apos rodar este arquivo e cumprir os pre-requisitos, os cron jobs ja comecam a
-- disparar nos horarios definidos.
-- =============================================================================

-- Funcao que cria o registro pending e dispara a Edge Function
CREATE OR REPLACE FUNCTION trigger_sync(
  p_tipo text,
  p_criado_por text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_exec_id uuid;
  v_url text;
  v_key text;
  v_em_andamento boolean;
BEGIN
  -- Bloqueia disparo se ja existe job pending ou running (evita fila empilhada)
  SELECT EXISTS (
    SELECT 1 FROM sync_executions WHERE status IN ('pending','running')
  ) INTO v_em_andamento;

  IF v_em_andamento THEN
    RAISE EXCEPTION 'Ja existe sincronizacao em andamento ou na fila';
  END IF;

  -- Le secrets do Vault
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'sync_dados_url';
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'sync_dados_service_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'Secrets sync_dados_url / sync_dados_service_key nao configurados no Vault';
  END IF;

  -- Cria o registro de execucao
  INSERT INTO sync_executions (tipo, criado_por, status)
  VALUES (p_tipo, p_criado_por, 'pending')
  RETURNING id INTO v_exec_id;

  -- Dispara a Edge Function (assincrono — pg_net retorna na hora)
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('exec_id', v_exec_id::text),
    timeout_milliseconds := 600000
  );

  RETURN v_exec_id;
END;
$$;

-- Permite que o frontend chame via supabase.rpc('trigger_sync', ...) com a anon key
GRANT EXECUTE ON FUNCTION trigger_sync(text, text) TO anon, authenticated;

-- =============================================================================
-- Cron jobs (horarios em UTC; SP = UTC-3)
--   06:45 UTC = 03:45 SP
--   15:45 UTC = 12:45 SP
-- Defasagem de 45 min em relacao ao sync do app_gerencial_seek (03h e 12h),
-- que demora ~25 min — garante que monitor_seek ja terminou a escrita
-- antes do canal_vendedor copiar os dados.
-- Reaplica idempotente: remove jobs anteriores com mesmo nome antes de criar
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-03h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-12h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-03h30');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-12h30');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-03h45');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-canal-vendedor-12h45');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-canal-vendedor-03h45',
  '45 6 * * *',
  $cron$ SELECT trigger_sync('agendado', 'scheduler') $cron$
);

SELECT cron.schedule(
  'sync-canal-vendedor-12h45',
  '45 15 * * *',
  $cron$ SELECT trigger_sync('agendado', 'scheduler') $cron$
);
