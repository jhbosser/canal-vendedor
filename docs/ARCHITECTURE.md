# Arquitetura — Canal do Vendedor Novacenter

## Visao Geral

```
┌─────────────────────────────────────────────────┐
│                    Vendedor                      │
│              (Browser / PWA Mobile)              │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│           Vite + React (Netlify)                 │
│  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Pages          │  │ Components           │   │
│  │ /insights      │  │ Header, FiltroDropdown│  │
│  │ /metas         │  │ LinhaCliente, etc.   │   │
│  │ /bonus         │  └──────────────────────┘   │
│  └────────────────┘                             │
└──────────────────────┬──────────────────────────┘
                       │ Supabase JS Client (anon key)
┌──────────────────────▼──────────────────────────┐
│              Supabase (canal_vendedor)            │
│  ┌──────┐  ┌─────────────────┐  ┌────────────┐  │
│  │ Auth │  │ DB (RLS)        │  │ Edge Func  │  │
│  │      │  │ mv_clientes_    │  │ sync-dados │  │
│  │      │  │ portfolio       │  │            │  │
│  └──────┘  └─────────────────┘  └────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ Edge Function (service_role key)
┌──────────────────────▼──────────────────────────┐
│         Supabase (monitor_seek / gerencial)       │
│    vendas_detalhado, fabricantes, clientes_tabela │
│         (fonte original — somente leitura)        │
└──────────────────────┬──────────────────────────┘
                       │ sync automatica
┌──────────────────────▼──────────────────────────┐
│              ERP Seek (Firebird)                 │
└─────────────────────────────────────────────────┘
```

## Fluxo de Dados

1. **ERP Seek** → sync automatica → **Supabase monitor_seek** (projeto app_gerencial_seek)
2. **Edge Function `sync-dados`** → copia dados do monitor_seek para o canal_vendedor via service_role key
3. Apos sync: chama `refresh_portfolio()` → recalcula `mv_clientes_portfolio`
4. **Frontend React** → lê `mv_clientes_portfolio` via anon key → renderiza para o vendedor

Este projeto **nunca** escreve nas tabelas de vendas/estoque. So le.

## Stack Atual

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React (JSX) + Tailwind CSS v4 |
| Deploy | Netlify (branch main, deploy automatico) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Sync | Edge Function Deno (sync-dados) |
| Icons | lucide-react |

## Banco de Dados — Tabelas Proprias

Definidas em `supabase/migrations/001_tables.sql`:

| Tabela | Descricao |
|---|---|
| `vendas_detalhado` | Espelho do gerencial (somente leitura) |
| `fabricantes` | Espelho do gerencial (somente leitura) |
| `clientes_tabela` | Espelho do gerencial (somente leitura) |
| `vendedores` | Perfil + vinculo auth_id <-> codigo_erp |
| `metas` | Metas mensais por vendedor |
| `bonus_regras` | Regras de bonus |
| `insights` | Insights gerados |
| `mensagens` | Comunicacao gerencia -> vendedores |

## Views e Materialized Views

Definidas em `supabase/migrations/`:

| Objeto | Arquivo | Descricao |
|---|---|---|
| `v_vendedores` | 003_views_insights.sql | Vendedores distintos com nome (acessivel pela anon key) |
| `v_clientes_portfolio` | 003_views_insights.sql | View dinamica (referencia — nao usada pelo frontend) |
| `mv_clientes_portfolio` | 004_materialized_view.sql | Resultado pre-computado; leitura instantanea |
| `refresh_portfolio()` | 004_materialized_view.sql | Funcao chamada pelo Edge Function apos sync |

### mv_clientes_portfolio — Colunas

| Coluna | Nivel | Descricao |
|---|---|---|
| ps_cliente | cliente | Codigo do cliente (ancora de agrupamento) |
| ps_nomcli | cliente | Nome do cliente |
| gap_atual_cliente | cliente | Dias desde ultima compra (qualquer fab) |
| gap_medio_cliente | cliente | Media dos intervalos entre compras |
| meses_compra_cliente | cliente | Meses distintos com compra (13 meses) |
| span_meses | cliente | Da primeira compra na janela ate hoje |
| primeira_compra | cliente | Data da primeira compra na janela |
| ultima_compra | cliente | Data da ultima compra |
| volume_total | cliente | Soma valor_liq 13 meses (todas as marcas) |
| vendedores_12m | cliente | Array de ps_vendedor dos ultimos 12 meses |
| cod_tabela | cliente | Codigo da tabela de preco |
| nom_tabela | cliente | Nome da tabela de preco |
| ps_codfab | fabricante | Codigo do fabricante |
| nome_fabricante | fabricante | Nome do fabricante |
| gap_atual_fab | fabricante | Dias desde ultima compra do par |
| gap_medio_fab | fabricante | Media dos intervalos entre compras do par |
| meses_compra_fab | fabricante | Meses distintos com compra do par |
| span_meses_fab | fabricante | Da primeira compra do par ate hoje |
| valor_medio_mes | fabricante | Ticket medio quando compra (valor_liq / meses) |
| valor_total_fab | fabricante | Soma valor_liq do par nos 13 meses |
| ultima_compra_fab | fabricante | Data da ultima compra do par |
| valor_no_gap | fabricante | Valor comprado nos ultimos gap_medio_fab dias |
| pct_executado | fabricante | % executado = valor_no_gap / valor_esperado * 100 |

### Estrategia de Refresh

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` — nao bloqueia leituras
- Requer `CREATE UNIQUE INDEX ON mv_clientes_portfolio (ps_cliente, ps_codfab)`
- Chamado automaticamente pelo Edge Function `sync-dados` apos cada sync
- Leitura pelo frontend e instantanea (dados pre-computados em disco)

## Edge Function — sync-dados

Localizada em `supabase/functions/sync-dados/index.ts`.

**Parametros (body JSON):**
- `desde` / `ate`: datas YYYY-MM-DD (padrao: ultimos 7 dias)
- `fabricantes: false`: pula sync de fabricantes
- `clientes_tabela: false`: pula sync de clientes_tabela

**O que faz (em ordem):**
1. Sincroniza `fabricantes` do monitor_seek (upsert on csi_codfab)
2. Sincroniza `clientes_tabela` do monitor_seek (upsert on csi_codcli, paginado 1000/batch)
3. Vendas: DELETE do periodo + INSERT de tudo do monitor_seek (espelho exato — captura delecoes e correcoes)
   - Deduplicacao por id antes do insert (monitor_seek pode retornar duplicatas na paginacao)
4. Dispara `refresh_portfolio()` em background via waitUntil (nao bloqueia resposta HTTP)

**Secrets necessarios:**
- `MONITOR_SEEK_URL` — URL do projeto monitor_seek
- `MONITOR_SEEK_SERVICE_KEY` — service_role key do monitor_seek
- `SUPABASE_URL` — automatico
- `SUPABASE_SERVICE_ROLE_KEY` — automatico

## Frontend — Estrutura

```
frontend/
├── src/
│   ├── App.jsx              # Rotas: /mapa (ativa), /metas, /bonus (placeholders)
│   ├── context/
│   │   ├── AuthContext.jsx  # Autenticacao Supabase
│   │   └── PortfolioContext.jsx  # Estado compartilhado: dados, filtros, clientesFiltrados
│   ├── lib/
│   │   └── supabase.js      # Cliente Supabase (anon key)
│   ├── pages/
│   │   ├── Insights.jsx     # Portfolio de Clientes — tabela expandivel
│   │   ├── Mapa.jsx         # Mapa de Portfolio — grafico de bolhas D3
│   │   ├── Login.jsx        # Tela de login
│   │   └── EmConstrucao.jsx # Placeholder para Metas/Bonus
│   └── components/
│       ├── Header.jsx       # Navegacao principal
│       └── FiltroDropdown.jsx  # Dropdown multi-select reutilizavel
├── .env.local               # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
└── vite.config.js
```

## Frontend — PortfolioContext

Estado centralizado compartilhado entre Insights e Mapa:
- Carrega `mv_clientes_portfolio` (paginado 1000/batch) e `v_vendedores`
- `agruparPorCliente()` — agrupa linhas por ps_cliente, monta array de fabricantes
- `clientesFiltrados` — useMemo com todos os filtros aplicados (sem ordenacao — cada pagina ordena como quer)
- Filtros: vendedores, clientes, fabricantes, tabelas, recorrencia, volume
- Opcoes dos dropdowns (opcoesVendedores, opcoesClientes, opcoesFabricantes, opcoesTabelas) derivadas dos dados brutos

## Frontend — Insights.jsx

- Consome `clientesFiltrados` e `filtros` do PortfolioContext
- Aplica ordenacao local sobre os dados ja filtrados
- `LinhaCliente` (memo) — linha expansivel com gap, status, potencial, % exec agregado
- `LinhaFabricante` (memo) — gap do par, valor_medio_mes, pct_executado
- Navegacao por teclado: setas ↑↓ navegam clientes e fabricantes, → abre, ← fecha

## Frontend — Mapa.jsx

- Consome `clientesFiltrados` e `filtros` do PortfolioContext
- Grafico D3: X=gap_atual, Y=gap_medio, escala log 1-400d
- Tamanho bolha = sqrt(potencial); cor = nivel de alerta
- Preenchimento verde de baixo para cima proporcional ao % realizado (todas as bolhas)
- d3-force com colisao para evitar sobreposicao; simulacao assincrona via rAF
- Dimensoes lidas diretamente do SVG (clientWidth/clientHeight) — sem ResizeObserver
- Tooltip com: nome, status, gaps, % ciclo, compras, potencial, % realizado
- Contadores por nivel + potencial total + exec. total na barra de legenda
- Filtros: vendedores, clientes, fabricantes, tabelas, recorrencia, volume (compartilhados com Insights)
- **Modo cliente filtrado:** quando cliente(s) selecionado(s), exibe uma bolha por fabricante do cliente; tooltip mostra fabricante como titulo e cliente como subtitulo; subtitle conta "N fabricantes"
- **Duplo clique em bolha de cliente:** entra no modo cliente filtrado (limpa fabricantes, seleciona o cliente)
- **Duplo clique em bolha de fabricante:** filtra somente aquele fabricante

## Autenticacao

Login proprio via tabela `vendedores` (sem Supabase Auth):
- Colunas: `username`, `senha_hash` (texto puro), `cargo`, `ativo`
- AuthContext faz SELECT na tabela com username + senha_hash + ativo=true
- Sessao salva em localStorage (`canal_user`)
- Perfis: `proprietario`/`gerente` = Administrador; demais = Usuario
- RLS desabilitado na tabela `vendedores`
- Gerenciar Usuarios: CRUD no modal do Header, visivel apenas para Administradores

## Deploy

- **URL:** mapa-vendedor.netlify.app
- **Repositorio:** github.com/jhbosser/canal-vendedor (privado)
- Branch `main` → deploy automatico no Netlify
- Variaveis de ambiente Netlify: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Build: `cd frontend && npm run build` → `frontend/dist/`
