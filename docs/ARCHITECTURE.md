# Arquitetura — Canal do Vendedor Novacenter

## Visao Geral

```
┌─────────────────────────────────────────────────┐
│                    Vendedor                      │
│              (Browser / PWA Mobile)              │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────┐
│              Next.js (Vercel)                    │
│  ┌────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Pages  │  │ API      │  │ Server         │  │
│  │ (SSR)  │  │ Routes   │  │ Components     │  │
│  └────────┘  └──────────┘  └────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ Supabase JS Client
┌──────────────────────▼──────────────────────────┐
│                  Supabase                        │
│  ┌──────┐  ┌─────┐  ┌──────────┐  ┌─────────┐ │
│  │ Auth │  │ DB  │  │ Realtime │  │ Storage │ │
│  │      │  │(RLS)│  │          │  │ (fotos) │ │
│  └──────┘  └─────┘  └──────────┘  └─────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ Sync (projeto gerencial)
┌──────────────────────▼──────────────────────────┐
│              ERP Seek (Firebird)                 │
│         (fonte original — somente leitura)       │
└─────────────────────────────────────────────────┘
```

## Fluxo de Dados

1. **ERP Seek** → sync automatica → **Supabase** (feito pelo `app_gerencial_seek`)
2. **Supabase** → queries + RLS → **Next.js** (este projeto)
3. **Next.js** → renderiza → **Vendedor** (browser/PWA)

Este projeto **nunca** escreve nas tabelas de vendas/estoque. So le.
Tabelas novas (vendedores, metas, bonus, insights, mensagens) sao gerenciadas por este projeto.

## Autenticacao

```
Vendedor → Login (email/senha) → Supabase Auth
                                      │
                                      ▼
                              JWT com user_id
                                      │
                                      ▼
                          RLS filtra dados pelo
                          vendedor_id vinculado
```

- Supabase Auth gerencia sessoes e tokens
- Tabela `vendedores` vincula `auth.users.id` ao `codigo_erp` do Seek
- RLS policies usam `auth.uid()` para filtrar dados
- Coordenadores/gerentes tem policies ampliadas baseadas no `cargo`

## Row Level Security (RLS)

### Vendedor
```sql
-- Ve apenas seus proprios dados
CREATE POLICY vendedor_own_data ON vendas_detalhado
  FOR SELECT USING (
    vendedor = (SELECT codigo_erp FROM vendedores WHERE id = auth.uid())
  );
```

### Coordenador
```sql
-- Ve dados de todos vendedores da sua loja
CREATE POLICY coordenador_loja ON vendas_detalhado
  FOR SELECT USING (
    empresa = (SELECT loja_id FROM vendedores WHERE id = auth.uid())
    AND (SELECT cargo FROM vendedores WHERE id = auth.uid()) IN ('coordenador', 'gerente', 'proprietario')
  );
```

### Gerente/Proprietario
```sql
-- Ve tudo
CREATE POLICY gerente_all ON vendas_detalhado
  FOR SELECT USING (
    (SELECT cargo FROM vendedores WHERE id = auth.uid()) IN ('gerente', 'proprietario')
  );
```

## Geracao de Insights

Insights sao gerados por **Supabase Edge Functions** (Deno) ou **cron jobs** no Supabase:

```
Diariamente (madrugada):
  1. Para cada vendedor ativo:
     a. Calcular clientes inativos → INSERT em insights
     b. Calcular fabricantes abaixo da media → INSERT em insights
     c. Calcular gaps no mix → INSERT em insights
     d. Detectar tendencias/alertas → INSERT em insights
  2. Limpar insights antigos (> 30 dias lidos)
  3. Enviar notificacao push para insights de alta prioridade
```

## PWA (Mobile)

- `manifest.json` com icones, cores, nome
- Service Worker para cache offline basico
- Push notifications via Web Push API
- Responsivo: mobile-first com breakpoints para desktop
- Instalavel na tela inicial do celular (Android + iOS)

## Estrutura de Pastas

```
src/
├── app/
│   ├── layout.tsx              # Layout raiz + providers
│   ├── page.tsx                # Redirect para /dashboard ou /login
│   ├── login/
│   │   └── page.tsx            # Tela de login
│   ├── dashboard/
│   │   ├── page.tsx            # Dashboard pessoal
│   │   ├── metas/
│   │   │   └── page.tsx        # Metas e bonus
│   │   ├── insights/
│   │   │   ├── page.tsx        # Feed de insights
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detalhe do insight
│   │   ├── ranking/
│   │   │   └── page.tsx        # Ranking vendedores
│   │   └── mensagens/
│   │       └── page.tsx        # Mensagens recebidas
│   └── admin/
│       ├── page.tsx            # Painel admin
│       ├── vendedores/
│       │   └── page.tsx        # Gerenciar vendedores
│       ├── metas/
│       │   └── page.tsx        # Configurar metas
│       └── bonus/
│           └── page.tsx        # Configurar bonus
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── charts/                 # Graficos (Recharts)
│   ├── insights/               # Cards de insight por tipo
│   └── layout/                 # Header, sidebar, nav
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts       # Auth middleware
│   ├── insights/
│   │   ├── clientes-inativos.ts
│   │   ├── marcas-abaixo.ts
│   │   ├── mix-produtos.ts
│   │   └── upsell.ts
│   └── utils.ts
├── hooks/
│   ├── use-vendedor.ts         # Dados do vendedor logado
│   ├── use-metas.ts            # Metas e progresso
│   └── use-insights.ts         # Insights do vendedor
└── types/
    ├── database.ts             # Types gerados do Supabase
    ├── insights.ts             # Types de insights
    └── metas.ts                # Types de metas
```

## Dependencias Principais

| Pacote           | Uso                              |
|------------------|----------------------------------|
| next             | Framework React SSR              |
| @supabase/ssr    | Cliente Supabase para Next.js    |
| tailwindcss      | Estilizacao                      |
| shadcn/ui        | Componentes UI                   |
| recharts         | Graficos                         |
| date-fns         | Manipulacao de datas             |
| zod              | Validacao de schemas             |
| next-pwa         | Configuracao PWA                 |
