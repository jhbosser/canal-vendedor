# CLAUDE.md — Canal do Vendedor Novacenter

## Project Overview
Portal web + mobile (PWA) para vendedores da Novacenter. Exibe metas, bonus e insights de oportunidades de venda baseados em dados reais. Frontend Vite + React consumindo materialized views do Supabase. Dados de vendas vem de copia diaria do projeto monitor_seek (somente leitura), sincronizados via Edge Function.

## Frontend
- **Stack:** Vite + React (JSX) + Tailwind CSS v4
- **Deploy:** Netlify (branch main, deploy automatico)
- **Pasta:** `frontend/`
- **Rotas:** `src/App.jsx` — /insights, /mapa, /metas, /bonus
- **Paginas:** `src/pages/` — Insights.jsx, Mapa.jsx, Login.jsx, EmConstrucao.jsx
- **Componentes:** `src/components/` — Header.jsx, FiltroDropdown.jsx
- **Context:** `src/context/` — AuthContext.jsx, PortfolioContext.jsx (estado compartilhado entre Insights e Mapa)
- **Supabase client:** `src/lib/supabase.js`
- **Variaveis de ambiente:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Materialized View Principal
`mv_clientes_portfolio` — definida em `supabase/migrations/004_materialized_view.sql`
- Uma linha por par cliente x fabricante
- Pre-computada; refresh automatico apos cada sync via `refresh_portfolio()`
- Substituiu a view dinamica `v_clientes_portfolio`

Ao alterar a logica: rodar DROP + CREATE no SQL Editor do Supabase (nao aceita ALTER).
Apos alterar: chamar `SELECT refresh_portfolio()` ou triggar o Edge Function.

## Views Auxiliares
- `v_vendedores` — vendedores distintos com nome (acessivel pela anon key)
Definidas em `supabase/migrations/003_views_insights.sql`

## Tabelas do Projeto
Definidas em `supabase/migrations/001_tables.sql`:
- `vendas_detalhado` — espelho do monitor_seek (somente leitura)
- `fabricantes` — espelho do monitor_seek (somente leitura)
- `clientes_tabela` — espelho do monitor_seek (somente leitura)
- `vendedores` — perfil + vinculo auth_id <-> ps_vendedor
- `metas`, `bonus_regras`, `insights`, `mensagens`

## Edge Function — sync-dados
`supabase/functions/sync-dados/index.ts`
- Sincroniza fabricantes e clientes_tabela via upsert
- Vendas: DELETE + INSERT dos ultimos 7 dias (espelho exato — captura delecoes e correcoes do ERP)
- Deduplicacao por id antes do insert (monitor_seek pode retornar duplicatas na paginacao)
- refresh_portfolio() disparado em background via waitUntil (nao bloqueia a resposta HTTP)
- Secrets: MONITOR_SEEK_URL, MONITOR_SEEK_SERVICE_KEY

## Logica de Insights (regras criticas)
- **Ancora de agrupamento:** `ps_cliente` (codigo), nunca `ps_nomcli` (pode variar no ERP)
- **Filtro de pares:** so pares com `meses_compra_fab >= 2`
- **Gap medio:** AVG dos intervalos entre compras consecutivas (LEAD window function)
- **Alerta:** Recorde gap_atual > gap_medio | Proximo gap_atual > gap_medio * 0.75 | Normal abaixo
- **Status cliente:** ativo <= 30d | em risco 31-60d | inativo > 60d
- **Potencial:** soma valor_medio_mes dos fabricantes em recorde ou proximo
- **% Executado:** valor_no_gap / (valor_medio_mes * gap_medio / 30) * 100
  - valor_no_gap = comprado nos ultimos gap_medio_fab dias (janela exata — 1 dia alem zera)
  - Agregado do cliente: soma realizados / soma esperados de todos os fabricantes
  - % por fabricante e mais acionavel que o agregado (fab de janela longa pode mascarar outros)
- **Modo fabricante filtrado:** linha/bolha reflete o par com maior gap_atual; status, gap, compras, exec e ordenacao seguem o fabricante filtrado
- **Modo cliente filtrado no Mapa:** quando cliente(s) selecionado(s) no filtro, o Mapa exibe uma bolha por fabricante do cliente (visao de portfolio do cliente); tooltip mostra fabricante como titulo e cliente como subtitulo; duplo clique numa bolha de cliente entra nesse modo (limpa filtro de fabricante); duplo clique numa bolha de fabricante filtra somente aquele fabricante
- **Preenchimento verde no Mapa:** todas as bolhas recebem verde proporcional ao % realizado
  - Com filtro fab: vermelho nunca tem verde (janela nao captura a ultima compra — matematicamente garantido)
  - Sem filtro: vermelho pode ter verde (fabs de ciclo longo dentro da janela mesmo com cliente atrasado no geral)
- **Cliente excluido:** ps_cliente = 31954 (balcao)

## Development Constraints
- Sempre ler `cont_export/PROJECT_CONTEXT.md` e `cont_export/BUSINESS_RULES.md` antes de modificar codigo
- Mudancas pequenas e localizadas — nao refatorar sem pedir
- Codigo completo e funcional — nao entregar rascunhos
- Perguntar antes de agir em caso de ambiguidade
- Nunca alterar tabelas de origem no Supabase (vendas_detalhado, fabricantes, clientes_tabela sao espelhos)
- Nunca expor credenciais em commits, logs ou exemplos
- Nunca inferir regras fiscais ou tributarias

## Data Safety Rules
- `vendas_detalhado`, `fabricantes` e `clientes_tabela` sao somente leitura
- `.env.local` nunca comitado — usar `.env.local.example` como referencia
- Nao inferir regras fiscais, tributarias ou contabeis sem confirmacao

## Execution Commands
```bash
cd frontend
npm run dev      # dev server (porta 5173)
npm run build    # build de producao
npm run lint     # lint
```

## Deploy (Netlify)
- Branch `main` → deploy automatico no Netlify
- Variaveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Build dir: `frontend/dist`
