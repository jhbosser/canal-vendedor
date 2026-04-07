# Report Layouts — Canal do Vendedor Novacenter

## Objetivo
Definir layouts oficiais das views e datasets consumidos pelo frontend.

Regra obrigatoria: views nao devem mudar de colunas sem atualizar este arquivo e `docs/data_contracts.md`.

## Padrao de Controle de Layout
Para cada view/dataset, registrar:
- nome da view;
- colunas esperadas e ordem;
- observacoes importantes.

---

## Layout 1 — `v_acoes_vendedor`
View principal consumida pelo frontend. Uma linha por par `vendedor × cliente × fabricante` com gap detectado.

Colunas (ordem da view):
1. `ps_vendedor` (integer)
2. `ps_nm_vendedor` (text)
3. `ps_cliente` (integer) — ancora de agrupamento
4. `ps_nomcli` (text) — nome via MAX, pode variar
5. `ps_codfab` (integer)
6. `nome_fabricante` (text) — via JOIN em fabricantes; fallback 'Fab X'
7. `perfil_par` (text) — classificacao por densidade do par
8. `perfil_cliente` (text) — classificacao por meses_ativos geral
9. `meses_com_compra` (integer) — meses distintos com compra nos ultimos 12m
10. `span_meses` (integer) — meses entre inicio dos dados e ultima compra
11. `densidade` (numeric) — meses_com_compra / span_meses
12. `valor_medio_mes` (numeric) — valor_total / meses_com_compra
13. `valor_total` (numeric) — soma de valor_liq no periodo
14. `rentabilidade_total` (numeric) — soma de rentabilidade no periodo
15. `ultima_compra_fab` (date)
16. `primeira_compra_fab` (date)
17. `dias_sem_compra_fab` (integer) — CURRENT_DATE - ultima_compra_fab
18. `dias_limite_alerta` (integer) — 45 | 90 | 180 conforme perfil_par
19. `valor_total_cliente` (numeric) — total geral do cliente com esse vendedor
20. `dias_sem_compra_cliente` (integer) — dias desde ultima compra (qualquer fabricante)
21. `comprou_com_outro` (boolean)
22. `score` (numeric) — valor_medio_mes × mult_par × mult_cliente

Filtros aplicados pela view:
- `dias_sem_compra_fab > dias_limite_alerta`
- `comprou_com_outro = false`
- `meses_com_compra >= 2`

Ordenacao: `ps_vendedor ASC, score DESC`

---

## Layout 2 — `v_clientes_perfil`
Perfil de cada cliente por vendedor (ultimos 12 meses).

Colunas:
1. `ps_vendedor` (integer)
2. `ps_nm_vendedor` (text)
3. `ps_cliente` (integer)
4. `ps_nomcli` (text)
5. `meses_ativos` (integer)
6. `valor_total_12m` (numeric)
7. `valor_medio_mes` (numeric)
8. `ultima_compra` (date)
9. `dias_sem_compra` (integer)
10. `perfil` (text) — recorrente | intermitente | esporadico
11. `dias_alerta` (integer) — 30 | 60 | 120

---

## Layout 3 — `v_fabricantes_perfil`
Perfil global de cada fabricante (frequencia de mercado, ultimos 12 meses).

Colunas:
1. `ps_codfab` (integer)
2. `nome_fabricante` (text)
3. `meses_com_venda` (integer)
4. `total_clientes` (integer)
5. `valor_total_12m` (numeric)
6. `frequencia` (numeric) — meses_com_venda / 12
7. `perfil` (text) — recorrente | intermitente | esporadico

Observacoes:
- Perfil global do fabricante nao e usado para calcular alertas (usa-se perfil_par).
- Usado como referencia informativa e para futuros insights de tendencia de mercado.

---

## Layout 4 — `v_gaps_cliente_fabricante`
View intermediaria com todos os pares que tem historico >= 2 meses, sem filtro de gap.

Colunas: mesmas que `v_acoes_vendedor` mais campos intermediarios.
- Inclui pares com `comprou_com_outro = true` (filtrados em v_acoes_vendedor)
- Inclui pares onde `dias_sem_compra_fab <= dias_limite_alerta` (ainda ativos)

---

## Layout 5 — Agrupamento no Frontend (GrupoInsight)
Estrutura calculada no cliente para a tabela agrupavel. Nao persiste no banco.

Campos do grupo:
- `key` (string) — codigo do agrupamento
- `label` (string) — nome exibido
- `sublabel` (string) — codigo para referencia
- `perfil` (PerfilDemanda)
- `total_valor_medio` (number) — soma dos valor_medio_mes dos itens
- `total_score` (number) — soma dos scores
- `count` (number) — numero de oportunidades no grupo
- `itens` (AcaoVendedor[]) — linhas originais, ordenadas por score desc

Modos de agrupamento:
- **por Cliente:** key = ps_cliente, label = ps_nomcli
- **por Fabricante:** key = ps_codfab, label = nome_fabricante
- **por Vendedor:** key = ps_vendedor, label = ps_nm_vendedor
