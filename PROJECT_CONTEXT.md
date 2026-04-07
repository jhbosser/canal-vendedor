# PROJECT_CONTEXT.md — Canal do Vendedor Novacenter

## Project Purpose
Portal web + mobile (PWA) para vendedores da Novacenter. Cada vendedor acessa metas, bonus e insights de oportunidades escondidas no negocio: clientes que pararam de comprar, fabricantes com queda de recorrencia, gaps de mix. Dados consumidos via Supabase (projeto canal_vendedor), alimentado por copia diaria do projeto app_gerencial_seek.

## Business Context
- **Empresa:** Centerdiesel Auto Pecas Ltda. / Novacenter — autopecas (caminhao, onibus, automoveis, carretas)
- **Mix:** ~25.000 SKUs, foco OEM e premium
- **ERP:** Seek (Firebird) — somente leitura para este projeto
- **Lojas:** 6 unidades no ES (Viana, Serra, Atacado, Campo Grande, E-Commerce, Cachoeiro)
- **Vendedores:** ~30-40 ativos; coordenadores por loja; gerente geral; proprietario

## Hierarquia de Acesso
| Nivel        | Visao                                   |
|--------------|----------------------------------------|
| Vendedor     | Proprias vendas, metas e insights      |
| Coordenador  | Loja inteira + vendedores da loja      |
| Gerente      | Todas as lojas e vendedores            |
| Proprietario | Visao completa + configuracoes         |

## Data Sources
Todos os dados de vendas vem do Supabase canal_vendedor, copiados diariamente do projeto app_gerencial_seek:
- `vendas_detalhado` — vendas por nota/item (janela 13 meses)
- `fabricantes` — cadastro de fabricantes

Tabelas criadas e gerenciadas por este projeto:
- `vendedores` — perfil + vinculo Auth <-> codigo ERP
- `metas` — metas mensais por vendedor
- `bonus_regras` — regras de bonus vigentes
- `insights` — insights gerados (futuro: cron diario)
- `mensagens` — comunicacao da gerencia para vendedores

## Views de Negocio
Definidas em `supabase/migrations/`:
- `v_fabricantes_perfil` — classifica fabricantes por frequencia global
- `v_clientes_perfil` — classifica clientes por vendedor (recorrente/intermitente/esporadico)
- `v_gaps_cliente_fabricante` — detecta pares cliente x fabricante com gap (densidade + dias_sem_compra)
- `v_acoes_vendedor` — resultado final: acao concreta para o vendedor, ordenada por score

## Data Flow
1. `app_gerencial_seek` sincroniza Firebird → Supabase (projeto gerencial) diariamente, termina ~09h
2. Copia diaria: `vendas_detalhado` e `fabricantes` do projeto gerencial → projeto canal_vendedor
3. Views recalculam automaticamente ao serem consultadas
4. Frontend Next.js consome as views via Supabase JS client

## Critical Business Rules
- Venda cruzada: metricas seguem o vendedor de ORIGEM, nao a loja de faturamento
- E-Commerce (Loja 6): estoque na Loja 4, faturamento pela Loja 6
- Comparativos: sempre contra mesmo periodo do ano anterior e mes anterior
- Insights: objetivos, diretos e acionaveis — dados concretos, sem teoria
- Densidade do par cliente x fabricante: meses_com_compra / span (inicio dos dados ate ultima compra)
- Perfil recorrente: densidade >= 0.7 | intermitente: 0.4-0.69 | esporadico: < 0.4
- Cliente nao comprou com outro vendedor: nao gerar insight (nao parou, trocou de vendedor)

## Tech Stack
- **Frontend:** Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui
- **Backend/Dados:** Supabase (Postgres + Auth + RLS)
- **Mobile:** PWA — responsivo, instalavel
- **Deploy:** Netlify (frontend) + Supabase Cloud (backend)
- **Linguagem:** TypeScript

## Known Limitations
- Copia de dados entre projetos Supabase ainda e manual (CSV); pipeline automatico pendente
- Auth e RLS ainda nao implementados (fase 1 usa vendedor hardcoded cod 34 para teste)
- Insights gerados por views on-demand; cron para geracao e persistencia pendente
- Nomes de ps_nomcli podem variar no ERP; agrupamento usa ps_cliente (codigo) como ancora
