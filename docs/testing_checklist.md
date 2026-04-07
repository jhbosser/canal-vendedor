# Testing Checklist — Canal do Vendedor Novacenter

## Objetivo
Checklist padrao para validar mudancas sem regressao funcional, estrutural ou contratual.

## Checklist Obrigatorio
- [ ] `npx next build` executa sem erros de TypeScript ou build
- [ ] Entradas continuam compativeis com contratos em `docs/data_contracts.md`
- [ ] Views SQL refletem as migrations em `supabase/migrations/`
- [ ] Types TypeScript em `src/types/database.ts` batem com as colunas das views
- [ ] Frontend renderiza sem erros no console do browser

## Validacoes de Views SQL
- [ ] Rodar `SELECT * FROM v_acoes_vendedor WHERE ps_vendedor = 34 LIMIT 20` e verificar resultado
- [ ] Verificar ausencia de duplicatas por `(ps_vendedor, ps_cliente, ps_codfab)`
- [ ] Verificar que `comprou_com_outro = false` para todos os resultados retornados
- [ ] Verificar que `dias_sem_compra_fab > dias_limite_alerta` para todos os resultados
- [ ] Verificar que `meses_com_compra >= 2` para todos os resultados
- [ ] Verificar que `densidade` = `meses_com_compra / span_meses` (calcular manualmente para 2-3 casos)

## Validacoes de Negocio
- [ ] Conferido `docs/business_rules.md` para aderencia
- [ ] Nenhuma regra fiscal ou contabil inferida sem confirmacao
- [ ] Mudancas de regra registradas em `docs/business_rules.md` com data e motivacao

## Validacoes de Contrato
- [ ] Conferido `docs/data_contracts.md` antes e depois da mudanca
- [ ] Nomes de colunas nas views batem com os campos em `AcaoVendedor` (TypeScript)
- [ ] Nenhuma coluna removida de views sem atualizar o type correspondente

## Validacoes de Layout
- [ ] Conferido `docs/report_layouts.md`
- [ ] Colunas das views em ordem documentada

## Checklist de Deploy (Netlify)
- [ ] `npx next build` passa localmente
- [ ] Variaveis de ambiente configuradas no Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `.env.local` nao comitado (verificar `.gitignore`)
- [ ] `netlify.toml` presente e correto

## Evidencias Recomendadas
- Comando executado:
- Data/hora da validacao:
- Ambiente utilizado (local / Netlify preview):
- Resultado resumido:
- Risco residual identificado:
