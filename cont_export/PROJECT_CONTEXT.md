# PROJECT_CONTEXT.md — Canal do Vendedor Novacenter

## Objetivo do Projeto
Portal web + mobile (PWA) para vendedores da Novacenter. Exibe metas, bonus e insights de oportunidades de venda baseados em dados reais. Frontend React (Vite) consumindo views/materialized views do Supabase. Dados de vendas vem de copia diaria do projeto monitor_seek (somente leitura).

## Empresa
- **Razao Social:** Centerdiesel Auto Pecas Ltda. / Novacenter
- **Segmento:** autopecas para caminhao, onibus, automoveis e carretas
- **Mix:** ~25.000 SKUs, foco OEM e premium
- **ERP:** Seek (Firebird)
- **Backend de dados:** Supabase (projeto canal_vendedor)

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

### Supabase canal_vendedor (este projeto)
- `mv_clientes_portfolio` — materialized view principal; pre-computada; refresh apos sync
- `v_vendedores` — view de vendedores com nome (acessivel pela anon key)
- `vendedores` — perfil + vinculo auth_id <-> ps_vendedor
- `metas`, `bonus_regras`, `insights`, `mensagens` — tabelas proprias

### Supabase monitor_seek (somente leitura)
- `vendas_detalhado` — vendas por produto/vendedor/loja (janela de 13 meses)
- `fabricantes` — cadastro de fabricantes
- `clientes_tabela` — tabela de preco por cliente

### Sync
- Edge Function `sync-dados` copia dados do monitor_seek para o canal_vendedor diariamente
- Apos sync: chama `refresh_portfolio()` para recalcular a materialized view

## Estado Atual da Implementacao

### Implementado e funcionando
- [x] Frontend Vite + React com Tailwind CSS v4
- [x] Header com navegacao (Insights, Mapa, Metas, Bonus)
- [x] PortfolioContext — estado compartilhado (dados, filtros, clientes) entre Insights e Mapa
- [x] Tela de Portfolio de Clientes (`/insights`)
  - Tabela agrupada por cliente x fabricante
  - Expansao por linha com fabricantes
  - Navegacao por teclado (setas)
  - Ordenacao por todas as colunas
  - Filtros inline fixos: Vendedor, Fabricante, Tabela, Rec. min., Media/mes min.
  - Coluna Potencial (valor_medio_mes dos pares em recorde ou proximo)
  - Coluna Exec. (% executado por fabricante e agregado por cliente)
- [x] Tela Mapa de Portfolio (`/mapa`)
  - Grafico de bolhas D3: X=gap_atual, Y=gap_medio, escala log 1-400d
  - Tamanho da bolha = potencial (escala sqrt)
  - Cor por nivel de alerta (recorde/proximo/normal)
  - Preenchimento verde proporcional ao % realizado (todas as bolhas)
  - Linha diagonal tracejada (gap_atual = gap_medio)
  - Zonas de fundo: ativo (verde), em risco (amarelo), inativo (cinza)
  - d3-force com colisao para evitar sobreposicao
  - Tooltip com nome, gaps, % ciclo, compras, potencial, % realizado
  - Checkbox "Ocultar 100% realizados"
  - Contadores por nivel + potencial total + exec. total da selecao
  - Filtros compartilhados via PortfolioContext: vendedores, clientes, fabricantes, tabelas, recorrencia, volume
  - Modo cliente filtrado: uma bolha por fabricante do cliente selecionado (visao de portfolio do cliente)
  - Duplo clique em bolha de cliente: entra no modo cliente filtrado
  - Duplo clique em bolha de fabricante: filtra somente aquele fabricante
- [x] Edge Function sync-dados
  - Espelho exato: delete + reinsert dos ultimos 7 dias (padrao)
  - Deduplicacao por id antes do insert
  - refresh_portfolio() disparado em background (waitUntil) — nao bloqueia resposta
- [x] Materialized view mv_clientes_portfolio com pct_executado e valor_no_gap
- [x] Deploy automatico no Netlify (branch main)

### Pendente
- [ ] Autenticacao real (Supabase Auth + RLS por vendedor)
- [ ] Tela de Metas
- [ ] Tela de Bonus
- [ ] PWA (manifest + service worker)
- [ ] Visao do coordenador/gerente

## Regras de Desenvolvimento
- Sempre ler este arquivo e BUSINESS_RULES.md antes de modificar codigo
- Mudancas pequenas e localizadas — nao refatorar sem pedir
- Codigo completo e funcional — nao entregar rascunhos
- Perguntar antes de agir em caso de ambiguidade
- Nunca alterar tabelas de origem (vendas_detalhado, fabricantes, clientes_tabela sao espelhos)
- Nunca expor credenciais em commits, logs ou exemplos
- Nunca inferir regras fiscais ou tributarias
