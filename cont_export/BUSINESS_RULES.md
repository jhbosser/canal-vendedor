# Business Rules — Insights Vendas Novacenter

## Estrutura da Empresa
- 6 lojas ativas no Espirito Santo, todas Lucro Real
- ~25.000 SKUs (autopecas caminhao, onibus, automoveis, carretas)
- Canais: balcao, televendas, Mercado Livre (~25% faturamento)

## Regras de Venda
1. **Venda cruzada:** vendedor pode trocar de loja no ERP para vender item de outra unidade
   - Fiscal: resultado na loja que faturou
   - Gerencial: resultado na loja de origem do vendedor
   - Implicacao: ao mostrar metricas por vendedor, considerar a loja de ORIGEM do vendedor, nao a loja de faturamento

2. **E-Commerce (Loja 6 / Enova):**
   - Estoque fisico fica na Loja 4 (Atacado)
   - Transferencia para Loja 6 antes do faturamento
   - Faturamento e emissao de NF pela Loja 6
   - Coordenador: Weiglas

3. **Atacado (Loja 4):**
   - Centro de estoque principal
   - Incentivo fiscal Compete Atacadista
   - Abastece tambem a Loja 6

## Regras de Metricas
1. **Faturamento:** valor total das vendas no periodo
2. **Margem:** diferenca entre valor de venda e custo (% e valor absoluto)
3. **Custo:** custo medio ponderado dos produtos vendidos
4. **Demanda:** calculada com base em 12 meses anteriores (medias, medianas, desvios)
5. **Comparativos:** sempre contra mesmo periodo do ano anterior e mes anterior

## Hierarquia de Acesso
| Nivel           | Visao                                      |
|-----------------|-------------------------------------------|
| Vendedor        | Proprias vendas e metas                    |
| Coordenador     | Vendas da sua loja + vendedores da loja    |
| Gerente geral   | Todas as lojas e vendedores                |
| Proprietario    | Visao completa + configuracoes             |

## Restricoes Fiscais
- Nao inferir regras fiscais, CSTs ou campos de NF
- Incentivos Compete (Lojas 4 e 6) dependem de termo assinado — nao calcular ou exibir detalhes fiscais sem confirmacao
- Separar sempre o que e fato do que e inferencia
