-- ============================================================
-- Canal do Vendedor — Views de insights v5
--
-- LOGICA:
--   gap_atual       = dias desde a última compra (empresa-wide)
--   gap_medio       = média dos intervalos entre compras consecutivas
--   meses_com_compra = meses distintos com compra / span total
--   volume_total    = soma valor_liq 13 meses
--   vendedores_6m   = array de ps_vendedor que atenderam nos últimos 6 meses
--   empresa-wide    = qualquer vendedor, qualquer loja
-- ============================================================

DROP VIEW IF EXISTS v_acoes_vendedor;
DROP VIEW IF EXISTS v_clientes_portfolio;
DROP VIEW IF EXISTS v_portfolio_cliente_fabricante;
DROP VIEW IF EXISTS v_gaps_cliente_fabricante;
DROP VIEW IF EXISTS v_vendedores;

-- Vendedores distintos com nome (expõe para anon via view, sem acesso direto à tabela)
CREATE VIEW v_vendedores AS
SELECT ps_vendedor, MAX(ps_nm_vendedor) AS ps_nm_vendedor
FROM vendas_detalhado
WHERE ps_nm_vendedor IS NOT NULL
GROUP BY ps_vendedor;

CREATE VIEW v_clientes_portfolio AS
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

-- Vendedores que atenderam nos últimos 6 meses
vendedores_6m AS (
  SELECT
    ps_cliente,
    ARRAY_AGG(DISTINCT ps_vendedor ORDER BY ps_vendedor) AS vendedores
  FROM vendas_detalhado
  WHERE ps_dt_saida >= CURRENT_DATE - INTERVAL '6 months'
  GROUP BY ps_cliente
),

-- Gap médio nível cliente
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

-- Gap médio nível fabricante
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
)

-- ── SELECT FINAL ─────────────────────────────────────────────
SELECT
  -- Cliente
  c.ps_cliente,
  c.ps_nomcli,
  c.gap_atual_cliente,
  COALESCE(gm.gap_medio_cliente, 0)        AS gap_medio_cliente,
  c.meses_compra_cliente,
  c.span_meses,
  c.primeira_compra,
  c.ultima_compra,
  c.volume_total,
  COALESCE(v6.vendedores, ARRAY[]::integer[]) AS vendedores_6m,
  COALESCE(ct.csi_codtab_atac, 0)          AS cod_tabela,
  COALESCE(ct.csi_nomtab, '—')             AS nom_tabela,

  -- Fabricante
  f.ps_codfab,
  COALESCE(fab_ref.csi_nomfab, 'Fab ' || f.ps_codfab) AS nome_fabricante,
  f.gap_atual_fab,
  COALESCE(gmf.gap_medio_fab, 0)           AS gap_medio_fab,
  f.meses_compra_fab,
  f.span_meses_fab,
  f.valor_medio_mes,
  f.valor_total_fab,
  f.ultima_compra_fab

FROM fab f
JOIN  cli               c    ON c.ps_cliente   = f.ps_cliente
LEFT JOIN gap_medio_cli gm   ON gm.ps_cliente  = f.ps_cliente
LEFT JOIN gap_medio_fab gmf  ON gmf.ps_cliente = f.ps_cliente
                             AND gmf.ps_codfab  = f.ps_codfab
LEFT JOIN fabricantes fab_ref ON fab_ref.csi_codfab = f.ps_codfab
LEFT JOIN vendedores_6m v6   ON v6.ps_cliente  = f.ps_cliente
LEFT JOIN clientes_tabela ct ON ct.csi_codcli  = f.ps_cliente
WHERE f.meses_compra_fab >= 2
  AND c.ps_cliente <> 31954;
