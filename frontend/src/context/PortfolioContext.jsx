import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── helpers exportados (usados em Insights e Mapa) ──────────────────────────

export function nivelAlerta(gapAtual, maiorGap) {
  if (!maiorGap || maiorGap === 0) return 'sem_historico';
  if (gapAtual > maiorGap)         return 'recorde';
  if (gapAtual > maiorGap * 0.75)  return 'proximo';
  return 'normal';
}

function agruparPorCliente(dados) {
  const map = new Map();

  for (const row of dados) {
    const k = row.ps_cliente;
    if (!map.has(k)) {
      map.set(k, {
        ps_cliente:      row.ps_cliente,
        ps_nomcli:       row.ps_nomcli,
        gap_atual:       row.gap_atual_cliente,
        gap_medio:       row.gap_medio_cliente,
        meses_compra:    row.meses_compra_cliente,
        span_meses:      row.span_meses,
        primeira_compra: row.primeira_compra,
        ultima_compra:   row.ultima_compra,
        volume_total:    row.volume_total,
        vendedores_12m:   row.vendedores_12m || [],
        cod_tabela:      row.cod_tabela,
        nom_tabela:      row.nom_tabela,
        fabricantes:     [],
      });
    }
    map.get(k).fabricantes.push({
      ps_codfab:       row.ps_codfab,
      nome_fabricante: row.nome_fabricante,
      gap_atual:       row.gap_atual_fab,
      gap_medio:       row.gap_medio_fab,
      meses_compra:    row.meses_compra_fab,
      span_meses:      row.span_meses_fab,
      valor_medio_mes: row.valor_medio_mes,
      valor_total_fab: Number(row.valor_total_fab) || 0,
      valor_no_gap:    Number(row.valor_no_gap) || 0,
      pct_executado:   row.pct_executado != null ? Number(row.pct_executado) : null,
      ultima_compra:   row.ultima_compra_fab,
    });
  }

  for (const c of map.values()) {
    c.fabricantes.sort((a, b) => {
      const na = nivelAlerta(a.gap_atual, a.gap_medio);
      const nb = nivelAlerta(b.gap_atual, b.gap_medio);
      const prioridade = { recorde: 0, proximo: 1, sem_historico: 2, normal: 3 };
      if (prioridade[na] !== prioridade[nb]) return prioridade[na] - prioridade[nb];
      return (b.gap_atual || 0) - (a.gap_atual || 0);
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = nivelAlerta(a.gap_atual, a.gap_medio);
    const nb = nivelAlerta(b.gap_atual, b.gap_medio);
    const prioridade = { recorde: 0, proximo: 1, sem_historico: 2, normal: 3 };
    if (prioridade[na] !== prioridade[nb]) return prioridade[na] - prioridade[nb];
    return (b.gap_atual || 0) - (a.gap_atual || 0);
  });
}

// ─── Context ─────────────────────────────────────────────────────────────────

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [dados,          setDados]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [filtros,        setFiltros]        = useState({
    vendedores:  [],
    clientes:    [],
    fabricantes: [],
    tabelas:     [],
    recorrencia: 2,
    volume:      0,
  });
  const [vendedoresNomes, setVendedoresNomes] = useState(new Map());

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const PAGE = 1000;
      let todos = [];
      let from  = 0;
      while (true) {
        const { data, error: err } = await supabase
          .from('mv_clientes_portfolio')
          .select('*')
          .range(from, from + PAGE - 1);
        if (err) throw err;
        todos = todos.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      setDados(todos);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }

    try {
      const { data: vends } = await supabase
        .from('v_vendedores')
        .select('ps_vendedor,ps_nm_vendedor');
      if (vends) {
        const nomes = new Map();
        for (const v of vends) {
          if (v.ps_nm_vendedor) nomes.set(v.ps_vendedor, v.ps_nm_vendedor);
        }
        setVendedoresNomes(nomes);
      }
    } catch {
      // nomes são opcionais, ignora falha
    }
  };

  const opcoesVendedores = useMemo(() => {
    const map = new Map();
    for (const row of dados) {
      for (const v of (row.vendedores_12m || [])) {
        if (!map.has(v)) map.set(v, vendedoresNomes.get(v) || `Vendedor ${v}`);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados, vendedoresNomes]);

  const opcoesClientes = useMemo(() => {
    const map = new Map();
    for (const row of dados) {
      if (row.ps_cliente && row.ps_nomcli) map.set(row.ps_cliente, row.ps_nomcli);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados]);

  const opcoesFabricantes = useMemo(() => {
    const map = new Map();
    for (const row of dados) {
      if (row.ps_codfab && row.nome_fabricante) map.set(row.ps_codfab, row.nome_fabricante);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados]);

  const opcoesTabelas = useMemo(() => {
    const map = new Map();
    for (const row of dados) {
      if (row.cod_tabela && row.nom_tabela && row.nom_tabela !== '—') {
        map.set(row.cod_tabela, row.nom_tabela);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados]);

  // clientesFiltrados: agrupado + filtros aplicados (sem ordenação — cada página ordena como quer)
  const clientesFiltrados = useMemo(() => {
    let lista = agruparPorCliente(dados);

    if (filtros.vendedores.length > 0) {
      const set = new Set(filtros.vendedores);
      lista = lista.filter(c => c.vendedores_12m.some(v => set.has(v)));
    }
    if (filtros.clientes.length > 0) {
      const set = new Set(filtros.clientes);
      lista = lista.filter(c => set.has(c.ps_cliente));
    }
    if (filtros.fabricantes.length > 0) {
      const set = new Set(filtros.fabricantes);
      lista = lista
        .filter(c => c.fabricantes.some(f => set.has(f.ps_codfab)))
        .map(c => ({ ...c, fabricantes: c.fabricantes.filter(f => set.has(f.ps_codfab)) }));
    }
    if (filtros.tabelas.length > 0) {
      const set = new Set(filtros.tabelas);
      lista = lista.filter(c => set.has(c.cod_tabela));
    }
    if (filtros.recorrencia > 2) {
      lista = lista.filter(c => c.meses_compra >= filtros.recorrencia);
    }
    if (filtros.volume > 0) {
      // Com ou sem fabricante filtrado: pelo menos um fab com valor_medio_mes >= threshold
      lista = lista.filter(c =>
        c.fabricantes.some(f => (Number(f.valor_medio_mes) || 0) >= filtros.volume)
      );
    }

    return lista;
  }, [dados, filtros]);

  return (
    <PortfolioContext.Provider value={{
      dados, loading, error, carregar,
      filtros, setFiltros,
      vendedoresNomes,
      opcoesVendedores, opcoesClientes, opcoesFabricantes, opcoesTabelas,
      clientesFiltrados,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export const usePortfolio = () => useContext(PortfolioContext);
