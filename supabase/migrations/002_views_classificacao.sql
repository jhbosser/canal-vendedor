-- ============================================================
-- Canal do Vendedor — Views de classificacao
-- Camada 1: Perfil do fabricante (recorrente/intermitente/esporadico)
-- Camada 2: Perfil do cliente por vendedor
-- ============================================================

-- ============================================================
-- CAMADA 1: Classificar fabricantes pelo comportamento de demanda
-- ============================================================
-- Olha os ultimos 12 meses:
--   - Em quantos meses diferentes teve venda?
--   - Quantos clientes diferentes compram?
--
-- Resultado:
--   frequencia > 6 meses  → RECORRENTE  (filtros, oleo, consumiveis)
--   frequencia 3-6 meses  → INTERMITENTE
--   frequencia <= 3 meses → ESPORADICO  (motor, cambio, colisao)
-- ============================================================

CREATE OR REPLACE VIEW v_fabricantes_perfil AS
WITH ultimos_12m AS (
  SELECT *
  FROM vendas_detalhado
  WHERE ps_dt_saida >= (CURRENT_DATE - INTERVAL '12 months')
    AND ps_codfab IS NOT NULL
),
stats_fabricante AS (
  SELECT
    ps_codfab,
    -- Em quantos meses distintos houve venda desse fabricante?
    COUNT(DISTINCT ano_mes) AS meses_com_venda,
    -- Quantos clientes diferentes compram?
    COUNT(DISTINCT ps_cliente) AS total_clientes,
    -- Valor total
    SUM(valor_liq) AS valor_total_12m,
    -- Frequencia media: meses com venda / 12
    ROUND(COUNT(DISTINCT ano_mes)::numeric / 12, 2) AS frequencia
  FROM ultimos_12m
  GROUP BY ps_codfab
)
SELECT
  sf.ps_codfab,
  COALESCE(f.csi_nomfab, 'Fabricante ' || sf.ps_codfab) AS nome_fabricante,
  sf.meses_com_venda,
  sf.total_clientes,
  sf.valor_total_12m,
  sf.frequencia,
  CASE
    WHEN sf.meses_com_venda > 6  THEN 'recorrente'
    WHEN sf.meses_com_venda >= 3 THEN 'intermitente'
    ELSE 'esporadico'
  END AS perfil
FROM stats_fabricante sf
LEFT JOIN fabricantes f ON f.csi_codfab = sf.ps_codfab;


-- ============================================================
-- CAMADA 2: Classificar clientes por vendedor
-- ============================================================
-- Para cada par vendedor × cliente nos ultimos 12 meses:
--   - Quantos meses comprou?
--   - Valor total e medio
--   - Ultima compra
--
-- Resultado:
--   10+ meses ativos → RECORRENTE  (alerta se sumir 30 dias)
--   4-9 meses ativos → INTERMITENTE (alerta se sumir 60 dias)
--   1-3 meses ativos → ESPORADICO  (alerta se sumir 120 dias)
-- ============================================================

CREATE OR REPLACE VIEW v_clientes_perfil AS
WITH ultimos_12m AS (
  SELECT *
  FROM vendas_detalhado
  WHERE ps_dt_saida >= (CURRENT_DATE - INTERVAL '12 months')
),
stats_cliente AS (
  SELECT
    ps_vendedor,
    MAX(ps_nm_vendedor) AS ps_nm_vendedor,
    ps_cliente,
    MAX(ps_nomcli) AS ps_nomcli,
    COUNT(DISTINCT ano_mes) AS meses_ativos,
    SUM(valor_liq) AS valor_total_12m,
    ROUND(SUM(valor_liq) / NULLIF(COUNT(DISTINCT ano_mes), 0), 2) AS valor_medio_mes,
    MAX(ps_dt_saida) AS ultima_compra,
    CURRENT_DATE - MAX(ps_dt_saida) AS dias_sem_compra
  FROM ultimos_12m
  GROUP BY ps_vendedor, ps_cliente
)
SELECT
  *,
  CASE
    WHEN meses_ativos >= 10 THEN 'recorrente'
    WHEN meses_ativos >= 4  THEN 'intermitente'
    ELSE 'esporadico'
  END AS perfil,
  CASE
    WHEN meses_ativos >= 10 THEN 30
    WHEN meses_ativos >= 4  THEN 60
    ELSE 120
  END AS dias_alerta
FROM stats_cliente;
