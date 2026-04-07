# Data Contracts — Canal do Vendedor Novacenter

## Objetivo
Documentar contratos de dados de entrada e saida para preservar compatibilidade entre views SQL, tipos TypeScript e o frontend.

## Regras Gerais
- Nao alterar nomes de colunas sem atualizar types TypeScript e views dependentes.
- Nao mudar tipo de dado sem estrategia de migracao.
- Campos obrigatorios devem ser validados antes da escrita no destino.

---

## Tabelas Espelho (somente leitura — origem: app_gerencial_seek)

### `vendas_detalhado`
Colunas esperadas (ordem do schema Supabase):
1. `id` (integer, PK)
2. `empresa` (integer) — codigo da loja
3. `ps_vendedor` (integer) — codigo do vendedor
4. `ps_nm_vendedor` (text) — nome do vendedor
5. `ps_dt_saida` (date) — data da venda
6. `ps_nota` (text) — numero da nota
7. `ps_cliente` (integer) — codigo do cliente (ancora de agrupamento)
8. `ps_nomcli` (text) — nome do cliente (pode variar; usar MAX)
9. `valor_liq` (numeric) — valor liquido da venda
10. `ps_desp_venda` (numeric)
11. `ps_ir` (numeric)
12. `ps_contrib_social` (numeric)
13. `ps_pis` (numeric)
14. `ps_custo` (numeric)
15. `ps_icms_efetivo` (numeric)
16. `ps_st` (numeric)
17. `ps_difal` (numeric)
18. `ps_codpro` (numeric) — codigo do produto
19. `ps_codfab` (integer) — codigo do fabricante
20. `ps_qtdpro` (numeric) — quantidade vendida
21. `ano_mes` (text, formato YYYY-MM)
22. `updated_at` (timestamptz)
23. `rentabilidade` (numeric) — coluna computada

### `fabricantes`
1. `csi_codfab` (integer, PK) — codigo do fabricante
2. `csi_nomfab` (text) — nome do fabricante
3. `created_at` (timestamptz)
4. `updated_at` (timestamptz)

---

## Tabelas Proprias (gerenciadas por este projeto)

### `vendedores`
1. `id` (uuid, PK) — gerado automaticamente
2. `auth_id` (uuid, FK auth.users) — vinculo com Supabase Auth
3. `codigo_erp` (integer, UNIQUE) — codigo do vendedor no Seek
4. `nome` (text)
5. `loja_id` (integer) — loja de origem
6. `cargo` (text) — vendedor | coordenador | gerente | proprietario
7. `ativo` (boolean, default true)
8. `foto_url` (text, nullable)
9. `created_at` (timestamptz)

### `metas`
1. `id` (uuid, PK)
2. `vendedor_id` (uuid, FK vendedores)
3. `mes` (date) — primeiro dia do mes de referencia
4. `tipo` (text) — faturamento | margem | mix
5. `valor_meta` (numeric)
6. `criado_por` (uuid, FK vendedores)
7. `created_at` (timestamptz)

### `bonus_regras`
1. `id` (uuid, PK)
2. `nome` (text)
3. `descricao` (text)
4. `tipo_meta` (text) — faturamento | margem | mix
5. `faixa_min` (numeric) — % minimo de atingimento
6. `faixa_max` (numeric) — % maximo de atingimento
7. `valor_bonus` (numeric)
8. `vigencia_inicio` (date)
9. `vigencia_fim` (date, nullable)
10. `created_at` (timestamptz)

### `insights`
1. `id` (uuid, PK)
2. `vendedor_cod` (integer) — codigo do vendedor (sem FK para evitar dependencia)
3. `tipo` (text) — cliente_inativo | fabricante_abaixo | mix_produto | upsell | alerta
4. `titulo` (text)
5. `descricao` (text)
6. `dados` (jsonb, default '{}')
7. `prioridade` (integer, 1-5)
8. `lido` (boolean, default false)
9. `criado_em` (timestamptz)

### `mensagens`
1. `id` (uuid, PK)
2. `remetente_id` (uuid, FK vendedores)
3. `destinatario_cod` (integer, nullable) — null = broadcast
4. `loja_id` (integer, nullable) — null = todas as lojas
5. `titulo` (text)
6. `conteudo` (text)
7. `criado_em` (timestamptz)

---

## Views (contratos de saida para o frontend)

### `v_acoes_vendedor`
Colunas consumidas pelo frontend (`AcaoVendedor` em `src/types/database.ts`):
1. `ps_vendedor` (integer)
2. `ps_nm_vendedor` (text)
3. `ps_cliente` (integer)
4. `ps_nomcli` (text)
5. `ps_codfab` (integer)
6. `nome_fabricante` (text)
7. `perfil_par` (text) — recorrente | intermitente | esporadico
8. `perfil_cliente` (text) — recorrente | intermitente | esporadico
9. `meses_com_compra` (integer)
10. `span_meses` (integer)
11. `densidade` (numeric)
12. `valor_medio_mes` (numeric)
13. `valor_total` (numeric)
14. `rentabilidade_total` (numeric)
15. `ultima_compra_fab` (date)
16. `primeira_compra_fab` (date)
17. `dias_sem_compra_fab` (integer)
18. `dias_limite_alerta` (integer)
19. `valor_total_cliente` (numeric)
20. `dias_sem_compra_cliente` (integer)
21. `comprou_com_outro` (boolean)
22. `score` (numeric)

### `v_clientes_perfil`
1. `ps_vendedor` (integer)
2. `ps_nm_vendedor` (text)
3. `ps_cliente` (integer)
4. `ps_nomcli` (text)
5. `meses_ativos` (integer)
6. `valor_total_12m` (numeric)
7. `valor_medio_mes` (numeric)
8. `ultima_compra` (date)
9. `dias_sem_compra` (integer)
10. `perfil` (text)
11. `dias_alerta` (integer)

### `v_fabricantes_perfil`
1. `ps_codfab` (integer)
2. `nome_fabricante` (text)
3. `meses_com_venda` (integer)
4. `total_clientes` (integer)
5. `valor_total_12m` (numeric)
6. `frequencia` (numeric)
7. `perfil` (text)

---

## Types TypeScript
Arquivo: `src/types/database.ts`
- `AcaoVendedor` — espelha `v_acoes_vendedor`
- `GrupoInsight` — agrupamento para o frontend (calculado no cliente)
- `PerfilDemanda` — union type: "recorrente" | "intermitente" | "esporadico"
- `GroupBy` — union type: "cliente" | "fabricante" | "vendedor"

## Formatos de Data
- Data diaria: `YYYY-MM-DD` (date no Postgres)
- Competencia mensal: `YYYY-MM` (text no campo `ano_mes`)
- Exibicao no frontend: `dd de MMM. de YY` via `Intl.DateTimeFormat`
