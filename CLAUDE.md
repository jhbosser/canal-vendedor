# Canal do Vendedor — Novacenter

## Visao Geral
Portal personalizado para vendedores da Novacenter. Cada vendedor acessa suas metas, bonus e insights de oportunidades escondidas no negocio. Web + mobile (PWA).

## Contexto Rapido
- Empresa: Centerdiesel / Novacenter — autopecas (caminhao, onibus, automoveis, carretas)
- 6 lojas no ES (Viana, Serra, Atacado, Campo Grande, E-Commerce, Cachoeiro)
- ~25.000 SKUs, ERP Seek (Firebird), dados sincronizados no Supabase
- Dados somente leitura — alimentados pelo projeto `app_gerencial_seek`

## Regras de Desenvolvimento
- Ler `cont_export/PROJECT_CONTEXT.md` e `docs/PRD.md` antes de modificar codigo
- Mudancas pequenas e localizadas — nao refatorar sem pedir
- Codigo completo e funcional — nao entregar rascunhos
- Perguntar antes de agir em caso de ambiguidade
- Nunca alterar tabelas de origem no Supabase
- Nunca expor credenciais em commits, logs ou exemplos
- Nunca inferir regras fiscais ou tributarias

## Stack
- **Frontend:** Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
- **Backend/Dados:** Supabase (Postgres, Auth, RLS, Realtime)
- **Mobile:** PWA (Progressive Web App) — responsivo, installavel
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)

## Estrutura do Projeto
```
canal_vendedor/
├── CLAUDE.md
├── cont_export/           # Contexto exportado (somente leitura)
├── docs/                  # Documentacao do projeto
│   ├── PRD.md
│   └── ARCHITECTURE.md
├── src/
│   ├── app/               # Next.js App Router (pages)
│   ├── components/        # Componentes React
│   ├── lib/               # Supabase client, utils
│   ├── hooks/             # Custom hooks
│   └── types/             # TypeScript types
├── public/                # Assets estaticos + PWA manifest
├── supabase/              # Migrations e seeds
└── package.json
```

## Hierarquia de Acesso
| Nivel        | Visao                                   |
|--------------|----------------------------------------|
| Vendedor     | Proprias vendas, metas e insights      |
| Coordenador  | Loja inteira + vendedores da loja      |
| Gerente      | Todas as lojas e vendedores            |
| Proprietario | Visao completa + configuracoes         |

## Regras de Negocio Criticas
- Venda cruzada: metricas seguem o vendedor (loja de ORIGEM), nao a loja de faturamento
- E-Commerce (Loja 6): estoque na Loja 4, faturamento pela Loja 6
- Comparativos: sempre contra mesmo periodo do ano anterior e mes anterior
- Insights devem ser objetivos, diretos e acionaveis — dados concretos, sem teoria
