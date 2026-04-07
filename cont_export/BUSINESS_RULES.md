# Business Rules — Canal do Vendedor Novacenter

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

---

## Logica de Insights — Portfolio de Clientes

### Fonte de dados
- Tabela `vendas_detalhado` — janela de 13 meses
- Tabela `fabricantes` — cadastro de fabricantes (espelho do gerencial)
- Tabela `clientes_tabela` — tabela de preco do cliente (espelho do gerencial)
- Materialized view `mv_clientes_portfolio` — resultado pre-computado, refresh apos cada sync

### Ancora de agrupamento
- `ps_cliente` (codigo numerico) — nunca `ps_nomcli` (pode variar no ERP)

### Filtro de pares validos
- So aparecem pares cliente x fabricante com `meses_compra_fab >= 2` (minimo 2 meses distintos de compra)
- Cliente 31954 (balcao) excluido permanentemente

### Gap atual
- **Nivel cliente:** dias desde a ultima compra do cliente (qualquer fabricante, qualquer loja)
- **Nivel fabricante:** dias desde a ultima compra do cliente naquele fabricante especifico

### Gap medio
- Media dos intervalos entre compras consecutivas (LEAD window function)
- **Nivel cliente:** calculado sobre datas distintas de compra do cliente (qualquer fabricante)
- **Nivel fabricante:** calculado sobre datas distintas de compra do par cliente x fabricante
- Mais robusto que maior gap: uma ausencia longa nao eleva permanentemente o limiar

### Status do cliente
- **Ativo:** gap_atual_cliente <= 30 dias
- **Em risco:** gap_atual_cliente entre 31 e 60 dias
- **Inativo:** gap_atual_cliente > 60 dias

### Nivel de alerta do par (fabricante)
- **🔴 Recorde:** gap_atual_fab > gap_medio_fab
- **⚠️ Proximo:** gap_atual_fab > gap_medio_fab * 0.75
- **✅ Normal:** gap_atual_fab <= gap_medio_fab * 0.75

### Span de meses
- **Nivel cliente (span_meses):** da primeira compra na janela de 13 meses ate HOJE
- **Nivel fabricante (span_meses_fab):** da primeira compra do par na janela ate HOJE
- Calculado como diferenca de anos*12 + meses, minimo 1

### Volume total
- Soma de `valor_liq` do cliente (todas as marcas) nos ultimos 13 meses

### Valor medio mensal (valor_medio_mes)
- `SUM(valor_liq) / COUNT(DISTINCT meses)` para o par cliente x fabricante
- Representa quanto o cliente gasta por mes QUANDO compra aquele fabricante

### Potencial
- Soma de `valor_medio_mes` dos fabricantes com nivel 🔴 ou ⚠️
- Representa o faturamento mensal em risco para aquele cliente

### % Executado (pct_executado)
- **Por fabricante:** `valor comprado nos ultimos gap_medio_fab dias / valor esperado no periodo * 100`
  - Valor esperado = `valor_medio_mes * gap_medio_fab / 30`
  - Se o cliente comprou o esperado ou mais: >= 100% (verde)
  - Se comprou entre 50% e 99%: laranja
  - Se comprou menos de 50%: vermelho
- **Agregado do cliente:** soma dos realizados / soma dos esperados de todos os fabricantes
  - Cada fabricante e medido contra sua propria janela de tempo (gap_medio_fab individual)
  - Comparavel entre clientes: ambos medem % de execucao do potencial esperado, respeitando o ritmo de cada um
  - Se auto-corrige com o tempo: gap_medio recalculado a cada sync sobre os ultimos 13 meses

### Limitacoes conhecidas do % Executado
1. **Sensibilidade de corte:** a janela e exata (gap_medio_fab dias). Com 1 dia alem do gap o valor_no_gap vai a zero — o % cai abruptamente mesmo que o cliente esteja essencialmente no padrao. Isso e tecnicamente correto mas pode parecer agressivo visualmente.
2. **% agregado pode ser dominado por fabricante com janela longa:** um fab com gap_medio alto (ex: 200d) pode ter compra dentro da janela mesmo que o cliente esteja atrasado no geral, puxando o agregado para cima e mascarando fabs com 0%. O % por fabricante individual e mais util para priorizar acoes.

### Preenchimento verde no Mapa (% realizado)
- Todas as bolhas (recorde, proximo, normal) recebem preenchimento verde proporcional ao % realizado
- **Com filtro de fabricante:** cor e verde medem o mesmo par. Se esta vermelho, gap_atual > gap_medio e a janela nao captura a ultima compra — verde = 0% garantido. Consistente.
- **Sem filtro de fabricante:** cor mede ritmo geral do cliente; verde mede execucao somada de todos os fabs com janelas individuais. Bolha vermelha com verde e possivel e correto — cliente atrasado no ciclo geral mas com alguns relacionamentos especificos ainda executados (fabs de ciclo longo).

### Modo fabricante filtrado na tela Portfolio e Mapa
Quando um ou mais fabricantes estao selecionados no filtro:
- A linha do cliente (Portfolio) e a bolha (Mapa) exibem dados do par com maior gap_atual (fabricante "representativo")
- Status, gap atual, gap medio, compras e % exec refletem o fabricante filtrado
- Ordenacao tambem usa o fabricante representativo
- Contadores do cabecalho (novos recordes, proximos do recorde) refletem o fabricante filtrado
- Sem filtro: tudo e empresa-wide do cliente

### Modo cliente filtrado no Mapa
Quando um ou mais clientes estao selecionados no filtro do Mapa:
- O grafico exibe uma bolha por fabricante do(s) cliente(s) selecionado(s) (visao de portfolio do cliente)
- Cada bolha representa o par cliente x fabricante: gap, potencial e % exec sao do par
- Tooltip mostra o fabricante como titulo e o cliente como subtitulo
- Subtitle do grafico conta "N fabricantes" em vez de "N clientes"
- Duplo clique numa bolha de cliente entra nesse modo (limpa filtro de fabricante, seleciona o cliente)
- Duplo clique numa bolha de fabricante filtra somente aquele fabricante

### Vendedores 12m
- Array de `ps_vendedor` que atenderam o cliente nos ultimos 12 meses (empresa toda, qualquer loja)
- Usado no filtro de vendedor da tela de Portfolio e Mapa

### Tabela de preco
- Codigo e nome da tabela do cliente (da tabela `clientes_tabela`)
- Usado no filtro de tabela da tela de Portfolio

---

## Filtros da Tela Portfolio

| Filtro | Logica | Obs |
|---|---|---|
| Vendedor | Clientes cujo array `vendedores_12m` contem o vendedor selecionado | Janela: ultimos 12 meses |
| Cliente | Filtra diretamente por ps_cliente; no Mapa ativa o modo cliente filtrado (bolhas por fabricante) | OR entre multiplos |
| Fabricante | Clientes com o fabricante na carteira (meses_compra_fab >= 2); restringe tambem os fabricantes visiveis dentro do cliente e o calculo de potencial | OR entre multiplos |
| Tabela | Clientes com a tabela de preco selecionada | Atributo do cliente |
| Rec. min. | Meses distintos de compra do cliente >= valor; piso real e 2 (garantido pelo SQL); filtro so age a partir de 3 | Nivel cliente |
| Media/mes min. | Clientes com ao menos um fabricante com valor_medio_mes >= valor (com ou sem filtro de fabricante) | Filtra pela relevancia da relacao individual com o fabricante |

Todos os filtros sao AND entre si. Dentro de cada dropdown, multiplas selecoes sao OR.
