# PRD — Canal do Vendedor Novacenter

## 1. Problema

Vendedores da Novacenter nao tem visibilidade sobre seu proprio desempenho, metas ou oportunidades de venda. Informacoes ficam dispersas no ERP e em planilhas. Nao existe um canal direto e personalizado para cada vendedor receber orientacoes baseadas em dados.

**Oportunidades perdidas:**
- Clientes que compravam e pararam de comprar (churn silencioso)
- Marcas/fabricantes com vendas abaixo da media historica
- Produtos similares que o vendedor nao oferece
- Mix de produtos estreito comparado a media da loja
- Clientes com potencial de upsell baseado no historico

## 2. Solucao

Portal web + mobile (PWA) onde cada vendedor acessa:
- **Suas metas e bonus** — clareza sobre o que precisa atingir
- **Seu desempenho** — como esta indo vs. metas e vs. pares
- **Insights acionaveis** — oportunidades escondidas nos dados

## 3. Usuarios

| Persona      | Necessidade Principal                          | Qtd Estimada |
|--------------|-----------------------------------------------|-------------|
| Vendedor     | Saber suas metas, bonus e onde agir           | ~30-40      |
| Coordenador  | Acompanhar equipe e direcionar esforcos       | 6           |
| Gerente      | Visao geral e configuracao de metas           | 2           |
| Proprietario | Definir metas, bonus e acompanhar resultados  | 1           |

## 4. Funcionalidades

### 4.1 Autenticacao e Perfil
- Login com email/senha (Supabase Auth)
- Vinculacao usuario <-> codigo vendedor no ERP
- Perfil com foto, loja, cargo
- Niveis de acesso: vendedor, coordenador, gerente, proprietario

### 4.2 Dashboard Pessoal
- **Faturamento do mes** vs. meta (gauge visual)
- **Margem media** vs. meta
- **Ticket medio** atual vs. historico
- **Ranking** posicao entre vendedores da loja
- **Evolucao** grafico de tendencia (ultimos 6-12 meses)
- **Comparativo** mes atual vs. mesmo mes ano anterior

### 4.3 Metas e Bonus
- Metas mensais definidas por gerencia (faturamento, margem, mix)
- Visualizacao clara do progresso (% atingido)
- Regras de bonus transparentes (faixas de atingimento)
- Projecao: "se mantiver esse ritmo, vai atingir X% da meta"
- Historico de metas e bonus anteriores

### 4.4 Insights — O Coracao do Sistema

#### 4.4.1 Clientes Inativos
- Clientes que compravam regularmente e pararam
- Segmentacao por tempo de inatividade (30, 60, 90+ dias)
- Valor historico do cliente (quanto comprava por mes)
- Ultimo produto comprado
- **Acao sugerida:** "Ligar para cliente X — comprava R$ Y/mes e nao compra ha Z dias"

#### 4.4.2 Marcas/Fabricantes Abaixo da Media
- Comparar vendas por fabricante do vendedor vs. media da loja
- Identificar fabricantes que o vendedor vende menos que os pares
- Tendencia: fabricantes em queda para aquele vendedor
- **Acao sugerida:** "Suas vendas de [Fabricante] cairam 30% — media da loja subiu 10%"

#### 4.4.3 Mix de Produtos
- Amplitude do mix vendido vs. mix disponivel
- Produtos que vendedores similares vendem mas este nao
- Categorias/familias de produto nao exploradas
- **Acao sugerida:** "Voce nao vendeu [Categoria] este mes — colegas venderam R$ X"

#### 4.4.4 Oportunidades de Upsell
- Clientes que compram produto A mas nao compram produto B (frequentemente vendidos juntos)
- Clientes que compram versoes mais baratas quando ha premium disponivel
- Cross-sell baseado em padroes de compra

#### 4.4.5 Tendencias e Alertas
- Queda de faturamento em relacao ao mes anterior
- Margem em declinio (vendendo mais barato)
- Concentracao de vendas em poucos clientes (risco)
- Produtos com estoque alto e venda baixa na loja

### 4.5 Comunicacao Direcionada
- Notificacoes push (PWA)
- Feed de insights novos (atualizado diariamente)
- Mensagens da gerencia para vendedores especificos ou grupos
- Alertas de metas (50%, 75%, 90% atingido)

### 4.6 Visao do Coordenador
- Dashboard da loja (soma de todos vendedores)
- Ranking de vendedores da loja
- Insights agregados por loja
- Capacidade de enviar mensagens para vendedores

### 4.7 Visao do Gerente/Proprietario
- Dashboard consolidado (todas as lojas)
- Configuracao de metas mensais por vendedor/loja
- Configuracao de regras de bonus
- Envio de comunicados gerais
- Painel de administracao de usuarios

## 5. Insights — Detalhamento Tecnico

### Fontes de Dados por Insight

| Insight               | Tabelas Principais                                    |
|-----------------------|------------------------------------------------------|
| Clientes inativos     | `vendas_detalhado`, `clientes_tabela`                |
| Marcas abaixo media   | `vendas_detalhado`, `fabricantes`, `estatisticas_demanda` |
| Mix de produtos       | `vendas_detalhado`, `produtos`, `estoque`            |
| Oportunidades upsell  | `vendas_detalhado`, `similares`, `produtos`          |
| Tendencias/alertas    | `vendas_por_mes`, `estatisticas_demanda`, `estoque`  |

### Logica de Calculo (exemplos)

**Cliente inativo:**
```sql
-- Clientes que compraram nos ultimos 12 meses mas nao nos ultimos 60 dias
SELECT cliente, vendedor,
       MAX(data_venda) as ultima_compra,
       AVG(valor_total) as ticket_medio,
       COUNT(*) as total_compras
FROM vendas_detalhado
WHERE vendedor = :vendedor_id
GROUP BY cliente, vendedor
HAVING MAX(data_venda) < NOW() - INTERVAL '60 days'
   AND MAX(data_venda) > NOW() - INTERVAL '12 months'
ORDER BY AVG(valor_total) DESC
```

**Fabricante abaixo da media:**
```sql
-- Vendas do vendedor por fabricante vs. media da loja
WITH vendedor_fab AS (
  SELECT fabricante, SUM(valor_total) as total_vendedor
  FROM vendas_detalhado
  WHERE vendedor = :vendedor_id AND data_venda >= :inicio_mes
  GROUP BY fabricante
),
loja_fab AS (
  SELECT fabricante, AVG(total_vendedor) as media_loja
  FROM (
    SELECT vendedor, fabricante, SUM(valor_total) as total_vendedor
    FROM vendas_detalhado
    WHERE empresa = :loja_id AND data_venda >= :inicio_mes
    GROUP BY vendedor, fabricante
  ) sub
  GROUP BY fabricante
)
SELECT l.fabricante,
       COALESCE(v.total_vendedor, 0) as meu_total,
       l.media_loja,
       COALESCE(v.total_vendedor, 0) - l.media_loja as diferenca
FROM loja_fab l
LEFT JOIN vendedor_fab v ON l.fabricante = v.fabricante
WHERE COALESCE(v.total_vendedor, 0) < l.media_loja * 0.7
ORDER BY l.media_loja DESC
```

## 6. Tabelas Novas no Supabase

Tabelas que precisam ser criadas (nao existem no projeto gerencial):

### `vendedores`
Perfil do vendedor vinculado ao Auth.
| Coluna         | Tipo      | Descricao                        |
|----------------|-----------|----------------------------------|
| id             | uuid (PK) | Ref Supabase Auth                |
| codigo_erp     | text      | Codigo do vendedor no Seek       |
| nome           | text      | Nome completo                    |
| loja_id        | int       | Loja de origem                   |
| cargo          | enum      | vendedor, coordenador, gerente, proprietario |
| ativo          | boolean   | Status                           |
| foto_url       | text      | URL da foto                      |

### `metas`
Metas mensais por vendedor.
| Coluna         | Tipo      | Descricao                        |
|----------------|-----------|----------------------------------|
| id             | uuid (PK) | Identificador                    |
| vendedor_id    | uuid (FK) | Ref vendedores                   |
| mes            | date      | Mes de referencia (primeiro dia) |
| tipo           | enum      | faturamento, margem, mix         |
| valor_meta     | numeric   | Valor alvo                       |
| criado_por     | uuid (FK) | Quem definiu a meta              |

### `bonus_regras`
Regras de bonus vigentes.
| Coluna         | Tipo      | Descricao                        |
|----------------|-----------|----------------------------------|
| id             | uuid (PK) | Identificador                    |
| nome           | text      | Nome da regra                    |
| descricao      | text      | Descricao para o vendedor        |
| tipo_meta      | enum      | faturamento, margem, mix         |
| faixa_min      | numeric   | % minimo de atingimento          |
| faixa_max      | numeric   | % maximo de atingimento          |
| valor_bonus    | numeric   | Valor do bonus na faixa          |
| vigencia_inicio| date      | Inicio da vigencia               |
| vigencia_fim   | date      | Fim da vigencia                  |

### `insights`
Insights gerados automaticamente.
| Coluna         | Tipo      | Descricao                        |
|----------------|-----------|----------------------------------|
| id             | uuid (PK) | Identificador                    |
| vendedor_id    | uuid (FK) | Destinatario                     |
| tipo           | enum      | cliente_inativo, marca_abaixo, mix, upsell, alerta |
| titulo         | text      | Titulo curto                     |
| descricao      | text      | Descricao detalhada              |
| dados          | jsonb     | Dados estruturados do insight    |
| prioridade     | int       | 1 (alta) a 5 (baixa)            |
| lido           | boolean   | Se o vendedor ja viu             |
| criado_em      | timestamp | Data de geracao                  |

### `mensagens`
Comunicacao da gerencia para vendedores.
| Coluna         | Tipo      | Descricao                        |
|----------------|-----------|----------------------------------|
| id             | uuid (PK) | Identificador                    |
| remetente_id   | uuid (FK) | Quem enviou                      |
| destinatario_id| uuid (FK) | Vendedor especifico (null = broadcast) |
| loja_id        | int       | Loja especifica (null = todas)   |
| titulo         | text      | Titulo                           |
| conteudo       | text      | Corpo da mensagem                |
| criado_em      | timestamp | Data de envio                    |

## 7. Prioridade de Implementacao

### Fase 1 — MVP (semanas 1-3)
- [ ] Setup do projeto (Next.js + Supabase + Tailwind)
- [ ] Autenticacao (login/senha)
- [ ] Tabela `vendedores` + vinculacao Auth <-> ERP
- [ ] Dashboard pessoal basico (faturamento, margem, ranking)
- [ ] RLS por vendedor

### Fase 2 — Metas e Insights (semanas 4-6)
- [ ] Tabelas `metas` e `bonus_regras`
- [ ] Tela de metas com progresso visual
- [ ] Insight: clientes inativos
- [ ] Insight: marcas abaixo da media
- [ ] Feed de insights

### Fase 3 — Insights Avancados (semanas 7-9)
- [ ] Insight: mix de produtos
- [ ] Insight: oportunidades de upsell
- [ ] Insight: tendencias e alertas
- [ ] Notificacoes push (PWA)

### Fase 4 — Gestao (semanas 10-12)
- [ ] Visao do coordenador
- [ ] Visao do gerente/proprietario
- [ ] Configuracao de metas pela gerencia
- [ ] Comunicacao direcionada (mensagens)
- [ ] Painel administrativo

## 8. Metricas de Sucesso
- Adocao: % de vendedores que acessam semanalmente
- Engajamento: insights visualizados / insights gerados
- Impacto: aumento no faturamento medio por vendedor apos adocao
- Reativacao: % de clientes inativos contatados apos insight
- NPS: satisfacao dos vendedores com o portal
