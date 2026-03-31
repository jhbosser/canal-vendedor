# Data Sources — Insights Vendas Novacenter

## Origem dos Dados
Todos os dados estao disponiveis no Supabase, sincronizados pelo projeto `app_gerencial_seek` a partir do ERP Seek (Firebird). O novo projeto consome dados ja processados — nao acessa Firebird diretamente.

## Tabelas Disponiveis no Supabase

### Vendas
| Tabela               | Descricao                                        | Atualizacao     |
|----------------------|--------------------------------------------------|-----------------|
| `vendas_detalhado`   | Vendas por produto/vendedor/loja/dia             | Diaria (sync)   |
| `vendas_por_mes`     | Consolidado mensal por produto/loja              | Diaria (calc)   |
| `ultima_venda_produto` | Data da ultima venda por produto/loja          | Diaria (calc)   |

### Estoque e Produtos
| Tabela               | Descricao                                        | Atualizacao     |
|----------------------|--------------------------------------------------|-----------------|
| `produtos`           | Cadastro de produtos (incl. bloqueio de compra)  | Diaria (sync)   |
| `fabricantes`        | Cadastro de fabricantes                          | Diaria (sync)   |
| `estoque`            | Posicao de estoque por empresa/produto           | Diaria (sync)   |
| `tabela_precos`      | Precos de custo atacado                          | Diaria (sync)   |

### Demanda e Estatisticas
| Tabela                  | Descricao                                     | Atualizacao     |
|-------------------------|-----------------------------------------------|-----------------|
| `demanda_mensal`        | Demanda calculada por produto/loja/mes        | Diaria (calc)   |
| `estatisticas_demanda`  | Medias, medianas, desvios (12 meses)          | Diaria (calc)   |

### KPI
| Tabela                       | Descricao                                | Atualizacao     |
|------------------------------|------------------------------------------|-----------------|
| `kpi_fabricantes_historico`   | Snapshot diario: Vlr.Estoque, Rent/Est, Giro | Diaria (snapshot) |

### Outras
| Tabela               | Descricao                                        |
|----------------------|--------------------------------------------------|
| `pedidos`            | Pedidos de compra pendentes                      |
| `transito`           | Notas em transito                                |
| `entradas_mensal`    | Entradas consolidadas por mes                    |
| `entradas_detalhado` | Entradas detalhadas                              |
| `similares`          | Pares de produtos similares (bidirecional)       |
| `clientes_tabela`    | Clientes com tabela de preco                     |

## Campos Relevantes em `vendas_detalhado`
Campos tipicos para analise de vendas por vendedor:
- `empresa` — codigo da loja (1, 3, 4, 5, 6, 7)
- `codpro` — codigo do produto
- `vendedor` — codigo/nome do vendedor
- `data_venda` — data da venda
- `quantidade` — quantidade vendida
- `valor_total` — valor total da venda
- `custo` — custo do produto
- `margem` — margem da venda

> **Nota:** verificar nomes exatos das colunas no schema do Supabase antes de implementar. Os nomes acima sao aproximados com base no projeto gerencial.

## Regras de Consumo
- Somente leitura — nunca alterar dados de origem
- Janela de vendas: 13 meses disponiveis
- Estatisticas: baseadas nos 12 meses anteriores ao mes corrente
- Dados sao atualizados pela sync do projeto gerencial (nao pelo novo projeto)
