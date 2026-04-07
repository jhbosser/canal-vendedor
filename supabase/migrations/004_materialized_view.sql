-- ============================================================
-- Canal do Vendedor — Materialized View de portfolio
--
-- Substitui v_clientes_portfolio por mv_clientes_portfolio.
-- O refresh é chamado pelo Edge Function sync-dados após cada sync.
-- REFRESH CONCURRENTLY não bloqueia leituras (requer unique index).
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_clientes_portfolio;

CREATE MATERIALIZED VIEW mv_clientes_portfolio AS
WITH

base AS (
  SELECT *
  FROM vendas_detalhado
  WHERE ps_dt_saida >= CURRENT_DATE - INTERVAL '13 months'
),

-- ── Nível CLIENTE ────────────────────────────────────────────

cli AS (
  SELECT
    ps_cliente,
    MAX(ps_nomcli)                                         AS ps_nomcli,
    MIN(ps_dt_saida)                                       AS primeira_compra,
    MAX(ps_dt_saida)                                       AS ultima_compra,
    (CURRENT_DATE - MAX(ps_dt_saida))::integer             AS gap_atual_cliente,
    COUNT(DISTINCT TO_CHAR(ps_dt_saida, 'YYYY-MM'))        AS meses_compra_cliente,
    GREATEST(
      (EXTRACT(YEAR  FROM CURRENT_DATE) - EXTRACT(YEAR  FROM MIN(ps_dt_saida))) * 12
      + EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM MIN(ps_dt_saida)),
      1
    )::integer                                             AS span_meses,
    ROUND(SUM(valor_liq)::numeric, 2)                      AS volume_total
  FROM base
  GROUP BY ps_cliente
),

vendedores_12m AS (
  SELECT
    ps_cliente,
    ARRAY_AGG(DISTINCT ps_vendedor ORDER BY ps_vendedor) AS vendedores
  FROM vendas_detalhado
  WHERE ps_dt_saida >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY ps_cliente
),

datas_cli AS (
  SELECT DISTINCT ps_cliente, ps_dt_saida FROM base
),
gaps_cli AS (
  SELECT
    ps_cliente,
    ( LEAD(ps_dt_saida) OVER (PARTITION BY ps_cliente ORDER BY ps_dt_saida)
      - ps_dt_saida )::integer AS gap_dias
  FROM datas_cli
),
gap_medio_cli AS (
  SELECT ps_cliente, ROUND(AVG(gap_dias)) AS gap_medio_cliente
  FROM gaps_cli
  WHERE gap_dias IS NOT NULL
  GROUP BY ps_cliente
),

-- ── Nível FABRICANTE ─────────────────────────────────────────

fab AS (
  SELECT
    ps_cliente,
    ps_codfab,
    (CURRENT_DATE - MAX(ps_dt_saida))::integer              AS gap_atual_fab,
    COUNT(DISTINCT TO_CHAR(ps_dt_saida, 'YYYY-MM'))         AS meses_compra_fab,
    SUM(valor_liq)                                          AS valor_total_fab,
    ROUND(SUM(valor_liq)
      / NULLIF(COUNT(DISTINCT TO_CHAR(ps_dt_saida, 'YYYY-MM')), 0), 2)
                                                            AS valor_medio_mes,
    MAX(ps_dt_saida)                                        AS ultima_compra_fab,
    GREATEST(
      (EXTRACT(YEAR  FROM CURRENT_DATE) - EXTRACT(YEAR  FROM MIN(ps_dt_saida))) * 12
      + EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM MIN(ps_dt_saida)),
      1
    )::integer                                             AS span_meses_fab
  FROM base
  WHERE ps_codfab IS NOT NULL
  GROUP BY ps_cliente, ps_codfab
),

datas_fab AS (
  SELECT DISTINCT ps_cliente, ps_codfab, ps_dt_saida
  FROM base
  WHERE ps_codfab IS NOT NULL
),
gaps_fab AS (
  SELECT
    ps_cliente,
    ps_codfab,
    ( LEAD(ps_dt_saida) OVER (PARTITION BY ps_cliente, ps_codfab ORDER BY ps_dt_saida)
      - ps_dt_saida )::integer AS gap_dias
  FROM datas_fab
),
gap_medio_fab AS (
  SELECT ps_cliente, ps_codfab, ROUND(AVG(gap_dias)) AS gap_medio_fab
  FROM gaps_fab
  WHERE gap_dias IS NOT NULL
  GROUP BY ps_cliente, ps_codfab
),

-- % executado: valor comprado nos últimos gap_medio_fab dias / valor esperado no período
pct_exec AS (
  SELECT
    v.ps_cliente,
    v.ps_codfab,
    ROUND(SUM(v.valor_liq)::numeric, 2) AS valor_no_gap
  FROM vendas_detalhado v
  JOIN gap_medio_fab gmf ON gmf.ps_cliente = v.ps_cliente
                        AND gmf.ps_codfab  = v.ps_codfab
  WHERE v.ps_dt_saida >= CURRENT_DATE - (gmf.gap_medio_fab || ' days')::interval
  GROUP BY v.ps_cliente, v.ps_codfab
)

SELECT
  c.ps_cliente,
  c.ps_nomcli,
  c.gap_atual_cliente,
  COALESCE(gm.gap_medio_cliente, 0)           AS gap_medio_cliente,
  c.meses_compra_cliente,
  c.span_meses,
  c.primeira_compra,
  c.ultima_compra,
  c.volume_total,
  COALESCE(v6.vendedores, ARRAY[]::integer[])  AS vendedores_12m,
  COALESCE(ct.csi_codtab_atac, 0)             AS cod_tabela,
  COALESCE(ct.csi_nomtab, '—')                AS nom_tabela,
  f.ps_codfab,
  COALESCE(fab_ref.csi_nomfab, 'Fab ' || f.ps_codfab) AS nome_fabricante,
  f.gap_atual_fab,
  COALESCE(gmf.gap_medio_fab, 0)              AS gap_medio_fab,
  f.meses_compra_fab,
  f.span_meses_fab,
  f.valor_medio_mes,
  f.valor_total_fab,
  f.ultima_compra_fab,
  COALESCE(pe.valor_no_gap, 0)                 AS valor_no_gap,
  -- % executado = valor comprado nos últimos gap_medio_fab dias / valor esperado no período
  CASE
    WHEN COALESCE(gmf.gap_medio_fab, 0) = 0 OR COALESCE(f.valor_medio_mes, 0) = 0 THEN NULL
    ELSE ROUND(
      COALESCE(pe.valor_no_gap, 0)
      / (f.valor_medio_mes * gmf.gap_medio_fab / 30.0)
      * 100
    )::integer
  END AS pct_executado

FROM fab f
JOIN  cli               c    ON c.ps_cliente   = f.ps_cliente
LEFT JOIN gap_medio_cli gm   ON gm.ps_cliente  = f.ps_cliente
LEFT JOIN gap_medio_fab gmf  ON gmf.ps_cliente = f.ps_cliente
                             AND gmf.ps_codfab  = f.ps_codfab
LEFT JOIN fabricantes fab_ref ON fab_ref.csi_codfab = f.ps_codfab
LEFT JOIN vendedores_12m v6  ON v6.ps_cliente  = f.ps_cliente
LEFT JOIN clientes_tabela ct ON ct.csi_codcli  = f.ps_cliente
LEFT JOIN pct_exec pe        ON pe.ps_cliente  = f.ps_cliente
                             AND pe.ps_codfab   = f.ps_codfab
WHERE f.meses_compra_fab >= 2
  AND c.ps_cliente <> 31954;

-- Índice único necessário para REFRESH CONCURRENTLY (não bloqueia leituras)
CREATE UNIQUE INDEX ON mv_clientes_portfolio (ps_cliente, ps_codfab);

-- Função chamada pelo Edge Function após o sync
CREATE OR REPLACE FUNCTION refresh_portfolio()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clientes_portfolio;
END;
$$;
