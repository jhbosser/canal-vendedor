# Tech Stack — Insights Vendas Novacenter

## Decisoes a Tomar
As escolhas abaixo sao sugestoes iniciais baseadas no stack ja usado na Novacenter. Confirmar antes de implementar.

## Stack Sugerido

### Backend / Dados
- **Supabase** — banco de dados e autenticacao (ja em uso)
  - Auth nativo do Supabase para login/senha por vendedor
  - Row Level Security (RLS) para controle de acesso por vendedor/loja
  - Tabelas ja disponiveis (alimentadas pelo projeto gerencial)

### Frontend
- **React + Vite** — consistente com o projeto gerencial existente
- **Tailwind CSS** — estilizacao (ja em uso)
- Alternativa: considerar **Next.js** se precisar de SSR ou PWA

### Autenticacao
- **Supabase Auth** — gerenciamento de usuarios, login/senha
- Perfis de acesso: vendedor, coordenador, gerente, proprietario
- Vinculacao: usuario do Supabase Auth <-> codigo do vendedor no ERP

### Comunicacao / Insights
- Opcoes a definir:
  - Dashboard com notificacoes in-app
  - Push notifications (PWA)
  - Integracao com WhatsApp (API Business)
  - Email automatico

### Hospedagem
- **Vercel** ou **Netlify** para frontend (gratis para uso moderado)
- Supabase ja hospedado (plano atual)

## Estrutura de Projeto Sugerida
```
cont_export/
├── CLAUDE.md                 # Instrucoes para o assistente
├── PROJECT_CONTEXT.md        # Contexto do projeto
├── BUSINESS_RULES.md         # Regras de negocio
├── DATA_SOURCES.md           # Fontes de dados
├── TECH_STACK.md             # Stack tecnologico
├── frontend/                 # App React (a criar)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── utils/
│   └── package.json
└── docs/
    └── ...
```

## Integracao com Projeto Gerencial
- O novo projeto **consome** dados do Supabase, nao os produz
- Nao duplicar logica de sincronizacao — depender do pipeline existente
- Se precisar de tabelas/views adicionais, criar no Supabase (nao no Firebird)
- Compartilhar o mesmo projeto Supabase ou criar projeto separado (a definir)
