-- ============================================================
-- Canal do Vendedor — Tabelas base
-- Rodar no SQL Editor do projeto canal_vendedor (novo)
-- ============================================================

-- 1. Espelho de vendas_detalhado (copia diaria do projeto monitor_seek)
CREATE TABLE vendas_detalhado (
  id              integer PRIMARY KEY,
  empresa         integer NOT NULL,
  ps_vendedor     integer NOT NULL,
  ps_nm_vendedor  text,
  ps_dt_saida     date NOT NULL,
  ps_nota         text,
  ps_cliente      integer NOT NULL,
  ps_nomcli       text,
  valor_liq       numeric DEFAULT 0,
  ps_desp_venda   numeric DEFAULT 0,
  ps_ir           numeric DEFAULT 0,
  ps_contrib_social numeric DEFAULT 0,
  ps_pis          numeric DEFAULT 0,
  ps_custo        numeric DEFAULT 0,
  ps_icms_efetivo numeric DEFAULT 0,
  ps_st           numeric DEFAULT 0,
  ps_difal        numeric DEFAULT 0,
  ps_codpro       numeric,
  ps_codfab       integer,
  ps_qtdpro       numeric DEFAULT 0,
  ano_mes         text,
  updated_at      timestamptz DEFAULT now(),
  rentabilidade   numeric DEFAULT 0
);

-- Indices para as queries de insight
CREATE INDEX idx_vendas_vendedor ON vendas_detalhado (ps_vendedor);
CREATE INDEX idx_vendas_cliente ON vendas_detalhado (ps_cliente);
CREATE INDEX idx_vendas_fabricante ON vendas_detalhado (ps_codfab);
CREATE INDEX idx_vendas_data ON vendas_detalhado (ps_dt_saida);
CREATE INDEX idx_vendas_vendedor_cliente ON vendas_detalhado (ps_vendedor, ps_cliente);
CREATE INDEX idx_vendas_vendedor_cliente_fab ON vendas_detalhado (ps_vendedor, ps_cliente, ps_codfab);
CREATE INDEX idx_vendas_ano_mes ON vendas_detalhado (ano_mes);

-- 2. Espelho de fabricantes (copia do monitor_seek)
CREATE TABLE fabricantes (
  csi_codfab    integer PRIMARY KEY,
  csi_nomfab    text NOT NULL,
  created_at    timestamptz,
  updated_at    timestamptz
);

-- 3. Vendedores — perfil vinculado ao Auth
CREATE TABLE vendedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     uuid UNIQUE REFERENCES auth.users(id),
  codigo_erp  integer UNIQUE NOT NULL,
  nome        text NOT NULL,
  loja_id     integer NOT NULL,
  cargo       text NOT NULL DEFAULT 'vendedor'
                CHECK (cargo IN ('vendedor', 'coordenador', 'gerente', 'proprietario')),
  ativo       boolean DEFAULT true,
  foto_url    text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_vendedores_codigo_erp ON vendedores (codigo_erp);
CREATE INDEX idx_vendedores_loja ON vendedores (loja_id);

-- 4. Metas mensais (futuro)
CREATE TABLE metas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid REFERENCES vendedores(id),
  mes         date NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('faturamento', 'margem', 'mix')),
  valor_meta  numeric NOT NULL,
  criado_por  uuid REFERENCES vendedores(id),
  created_at  timestamptz DEFAULT now()
);

-- 5. Regras de bonus (futuro)
CREATE TABLE bonus_regras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  descricao       text,
  tipo_meta       text NOT NULL CHECK (tipo_meta IN ('faturamento', 'margem', 'mix')),
  faixa_min       numeric NOT NULL,
  faixa_max       numeric NOT NULL,
  valor_bonus     numeric NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim    date,
  created_at      timestamptz DEFAULT now()
);

-- 6. Insights gerados
CREATE TABLE insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_cod integer NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('cliente_inativo', 'fabricante_abaixo', 'mix_produto', 'upsell', 'alerta')),
  titulo       text NOT NULL,
  descricao    text NOT NULL,
  dados        jsonb DEFAULT '{}',
  prioridade   integer DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 5),
  lido         boolean DEFAULT false,
  criado_em    timestamptz DEFAULT now()
);

CREATE INDEX idx_insights_vendedor ON insights (vendedor_cod);
CREATE INDEX idx_insights_tipo ON insights (tipo);
CREATE INDEX idx_insights_criado ON insights (criado_em DESC);

-- 7. Mensagens da gerencia (futuro)
CREATE TABLE mensagens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id    uuid REFERENCES vendedores(id),
  destinatario_cod integer,
  loja_id         integer,
  titulo          text NOT NULL,
  conteudo        text NOT NULL,
  criado_em       timestamptz DEFAULT now()
);
