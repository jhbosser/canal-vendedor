# CLAUDE.md — Insights Vendas Novacenter

## Project Overview
Projeto de comunicacao com equipe de vendas da Novacenter. Sistema com autenticacao individual (login/senha) que analisa dados de vendas de todas as 6 lojas e distribui insights personalizados para cada vendedor. Dados originam do Supabase (sincronizados pelo projeto app_gerencial_seek a partir do ERP Seek/Firebird).

## Development Constraints
- Sempre ler `PROJECT_CONTEXT.md` antes de modificar codigo.
- Preferir mudancas pequenas e localizadas.
- Nao remover codigo existente sem justificativa documentada.
- Entregar codigo completo e funcional — nao entregar rascunhos.
- Quando houver duvida ou ambiguidade, perguntar antes de executar.
- Nunca agir sem instrucao e confirmacao do usuario.
- Separar fatos confirmados de inferencias contextuais.

## Data Safety Rules
- Dados de vendas sao somente leitura — nao alterar tabelas de origem no Supabase.
- Nao expor credenciais de `.env` em commits, logs ou exemplos.
- Nao inferir regras fiscais, tributarias ou contabeis sem confirmacao.
- Nao responder temas fiscais sem 100% de certeza.

## Business Rules
- Venda cruzada: fiscalmente o resultado fica na loja que faturou; gerencialmente fica na loja de origem do vendedor.
- Loja 6 (E-Commerce/Enova): estoque fisico na Loja 4, faturamento pela Loja 6.
- Indicadores prioritarios: faturamento, margem, custo.
- Vendedores pertencem a lojas especificas mas podem fazer vendas cruzadas.

## Authentication
- Cada vendedor tera login e senha individual.
- Acesso restrito aos proprios dados (vendedor ve apenas suas metricas).
- Coordenadores e gerentes podem ter visao ampliada (por loja ou geral).

## Tone & Communication
- Insights devem ser objetivos, diretos e acionaveis.
- Nada de teoria solta — sempre dados concretos.
- Linguagem adequada para equipe de vendas (pratica, sem jargao tecnico excessivo).
