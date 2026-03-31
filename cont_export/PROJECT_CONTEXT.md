# PROJECT_CONTEXT.md — Insights Vendas Novacenter

## Objetivo do Projeto
Sistema de comunicacao com a equipe de vendas da Novacenter. Analise dados de vendas de todas as lojas e distribui insights personalizados para cada vendedor. Cada usuario tera login e senha individuais.

## Empresa
- **Razao Social:** Centerdiesel Auto Pecas Ltda. / Novacenter
- **Segmento:** autopecas para caminhao, onibus, automoveis e carretas
- **Mix:** ~25.000 SKUs, foco OEM e premium
- **ERP:** Seek (Firebird)
- **Backend de dados:** Supabase (ja em uso no projeto gerencial)

## Lojas (todas no ES)
| Loja | Emp | Cidade       | Funcao                         |
|------|-----|--------------|--------------------------------|
| 1    | 1   | Viana        | Matriz                         |
| 3    | 3   | Serra        | Filial                         |
| 4    | 4   | Atacado      | Centro de estoque e atacado    |
| 5    | 5   | Campo Grande | Filial                         |
| 6    | 6   | E-Commerce   | Enova / Mercado Livre           |
| 7    | 7   | Cachoeiro    | Filial                         |

## Canais de Venda
- Balcao (presencial em cada loja)
- Televendas
- Mercado Livre (~25% do faturamento) — estoque na Loja 4, faturamento pela Loja 6
- Venda cruzada: vendedor pode trocar de loja no ERP para vender item de outra unidade

## Coordenadores por Loja
- **Carlos:** gerente geral
- **Victor:** coordenador geral
- **Gilberto:** coord. Loja 1 (Viana)
- **Tiago:** coord. Loja 3 (Serra)
- **Weiglas:** coord. Loja 6 (E-Commerce)
- **Prote:** coord. Loja 5 (Campo Grande)
- **Julio:** coord. Loja 7 (Cachoeiro)

## Fonte de Dados
Os dados de vendas ja estao sincronizados no Supabase pelo projeto `app_gerencial_seek`:
- `vendas_detalhado` — vendas por produto/vendedor/loja (janela de 13 meses)
- `vendas_por_mes` — consolidado mensal por produto/loja
- `estatisticas_demanda` — medias, medianas, desvios de demanda
- `estoque` — posicao de estoque por empresa/produto
- `produtos` — cadastro de produtos
- `fabricantes` — cadastro de fabricantes

## Funcionalidades Previstas
1. **Autenticacao:** login/senha individual por vendedor
2. **Dashboard pessoal:** metricas de vendas do vendedor logado
3. **Insights automaticos:** analises e recomendacoes baseadas nos dados de vendas
4. **Comunicacao direcionada:** mensagens/insights segmentados por loja, vendedor ou equipe
5. **Historico:** acompanhamento da evolucao de desempenho ao longo do tempo

## Indicadores-Chave
- Faturamento (total e por periodo)
- Margem (% e valor)
- Custo medio
- Ticket medio
- Mix de produtos vendidos
- Comparativo com periodos anteriores
- Ranking entre vendedores/lojas
