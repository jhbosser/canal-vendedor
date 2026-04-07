# Business Rules — Canal do Vendedor Novacenter

## Objetivo
Centralizar regras de negocio oficiais para evitar interpretacoes diferentes entre views SQL, frontend e agentes de IA.

## Escopo Obrigatorio de Registro
Este documento deve sempre registrar:
- regras de calculo de insights;
- criterios de classificacao de perfil;
- regras de filtragem e score;
- premissas de negocio;
- decisoes importantes do projeto.

---

## Regras Ativas

### Dados de origem
- `vendas_detalhado` e `fabricantes` sao espelhos somente leitura do projeto app_gerencial_seek.
- Nunca alterar essas tabelas diretamente.
- Copia feita manualmente (CSV) ou via pipeline automatico (a implementar).
- Janela de dados: 13 meses (mes atual + 12 anteriores).

### Ancora de agrupamento
- Sempre agrupar por `ps_cliente` (codigo inteiro), nunca por `ps_nomcli` (nome pode variar no ERP).
- Nome exibido = `MAX(ps_nomcli)` dentro do grupo — pega o mais recente registrado.
- Mesma regra para `ps_vendedor` vs `ps_nm_vendedor`.

### Venda cruzada
- Vendedor pode trocar de loja no ERP para vender item de outra unidade.
- Gerencialmente: resultado fica na loja de ORIGEM do vendedor.
- Implicacao: metricas por vendedor consideram todas as empresas onde ele vendeu.

### E-Commerce (Loja 6)
- Estoque fisico na Loja 4 (Atacado).
- Faturamento pela Loja 6.
- Nao separar E-Commerce de outras lojas na analise de vendedor — seguir o vendedor.

### Classificacao de perfil do par cliente x fabricante (densidade)
- `span_meses` = meses entre o inicio da janela de dados (12 meses atras) e a ultima compra daquele par.
- `densidade` = `meses_com_compra` / `span_meses` (arredondado para 2 casas).
- Perfil:
  - `recorrente`: densidade >= 0.70
  - `intermitente`: densidade >= 0.40 e < 0.70
  - `esporadico`: densidade < 0.40
- Racional: mede "quando tinha oportunidade de comprar, com que frequencia comprava?"

### Classificacao de perfil do cliente (geral, por vendedor)
- Baseada em `meses_ativos` (meses distintos com compra nos ultimos 12m):
  - `recorrente`: >= 10 meses
  - `intermitente`: >= 4 meses
  - `esporadico`: < 4 meses
- Agrupado por `ps_vendedor` x `ps_cliente` (sem empresa).

### Regua de alerta por perfil do par
- `recorrente`: alerta se `dias_sem_compra_fab` > 45 dias
- `intermitente`: alerta se `dias_sem_compra_fab` > 90 dias
- `esporadico`: alerta se `dias_sem_compra_fab` > 180 dias

### Filtro de compra com outro vendedor
- Se o cliente comprou o mesmo fabricante com qualquer outro vendedor nos ultimos 60 dias, nao gerar insight para o vendedor original.
- Racional: o cliente nao parou de comprar, apenas comprou com outro vendedor.

### Minimo de historico para gerar insight
- So gerar insight para pares com `meses_com_compra >= 2`.
- Pares com apenas 1 mes de historico sao ignorados (sem padrao estabelecido).

### Score de prioridade
- `score = valor_medio_mes × mult_par × mult_cliente`
- Multiplicadores:
  - `recorrente` = 3
  - `intermitente` = 2
  - `esporadico` = 1
- Score maior = oportunidade de maior valor e maior regularidade historica.

### Comparativos
- Sempre contra mesmo periodo do ano anterior e mes anterior.
- Nunca comparar periodos de duracoes diferentes sem ajuste.

---

## Excecoes Operacionais
- Nome do cliente pode variar entre registros no ERP — usar codigo como ancora.
- Fabricante sem registro em `fabricantes` exibe `'Fab ' || ps_codfab` como fallback.

## Regras de Governanca
- Nao inferir regras fiscais, contabeis ou financeiras sem definicao explicita.
- Toda alteracao de regra deve ser registrada aqui antes da implementacao.
- Nao alterar logica de calculo sem revisar impacto nas views e no score.

---

## Historico de Decisoes

### 2026-03-31
- **Decisao:** Usar densidade pelo span (inicio dos dados → ultima compra) em vez do span primeira→ultima compra.
- **Motivacao:** Span primeira→ultima compra inflava artificialmente a densidade de pares com poucas compras concentradas. Ex: 2 compras em 3 meses = 67% mas no contexto do ano era 17%.
- **Impacto:** Mais pares classificados como esporadico ou intermitente; insights mais precisos.
- **Views afetadas:** `v_gaps_cliente_fabricante`, `v_acoes_vendedor`.

### 2026-03-31
- **Decisao:** Agrupar historico por `ps_vendedor, ps_cliente, ps_codfab` sem `ps_nomcli` no GROUP BY.
- **Motivacao:** Variacao de nome do cliente no ERP gerava duplicatas no resultado.
- **Impacto:** Elimina duplicatas; nome exibido via MAX(ps_nomcli).
- **Views afetadas:** `v_gaps_cliente_fabricante`, `v_clientes_perfil`.

### 2026-03-31
- **Decisao:** Classificar fabricante pelo perfil do PAR (densidade), nao pelo perfil global do fabricante.
- **Motivacao:** Perfil global classificava tudo como recorrente (algum cliente sempre compra). Perfil do par reflete o comportamento real daquele cliente com aquele fabricante.
- **Impacto:** Scores mais precisos; menos falsos positivos de alerta.
- **Views afetadas:** `v_gaps_cliente_fabricante`, `v_acoes_vendedor`.
