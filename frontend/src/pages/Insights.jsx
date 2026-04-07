import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { Lightbulb, ChevronRight, ChevronDown, RefreshCw, AlertTriangle, Filter, X } from 'lucide-react';
import { usePortfolio, nivelAlerta } from '../context/PortfolioContext';
import FiltroDropdown from '../components/FiltroDropdown';

// ─── helpers de renderização ──────────────────────────────────────────────────

function fmtBRL(v) {
  if (!v || v === 0) return '—';
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function diasStr(d) {
  if (d == null) return '—';
  return `${d}d`;
}

function pctExecCor(pct) {
  if (pct == null) return 'text-gray-300';
  if (pct >= 100)  return 'text-green-600';
  if (pct >= 50)   return 'text-orange-500';
  return 'text-red-500';
}

const ALERTA_COLOR = {
  recorde:       'text-red-600',
  proximo:       'text-orange-500',
  normal:        'text-gray-600',
  sem_historico: 'text-gray-400',
};

const ALERTA_ICON = {
  recorde:       '',
  proximo:       '',
  normal:        '',
  sem_historico: '',
};

// ─── Linha fabricante ─────────────────────────────────────────────────────────

const LinhaFabricante = memo(function LinhaFabricante({ fab, idx, focused }) {
  const nivel = nivelAlerta(fab.gap_atual, fab.gap_medio);
  const cor   = ALERTA_COLOR[nivel];
  const bg    = focused ? 'bg-blue-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

  return (
    <tr className={bg} data-foco={focused ? 'true' : undefined}>
      <td className="px-2 py-0.5 w-8" />
      <td className="w-20" />
      <td className="px-2 py-0.5 pl-4 text-gray-700 whitespace-nowrap">
        <span className="text-gray-300 mr-1.5 text-[11px]">→</span>
        {fab.nome_fabricante}
      </td>
      <td className="px-2 py-0.5 text-center text-[11px]">
        {ALERTA_ICON[nivel]}
      </td>
      <td className={`px-2 py-0.5 text-right tabular-nums font-medium ${cor}`}>
        {diasStr(fab.gap_atual)}
      </td>
      <td className="px-2 py-0.5 text-right tabular-nums text-gray-400">
        {fab.gap_medio > 0 ? diasStr(fab.gap_medio) : '—'}
      </td>
      <td className="px-2 py-0.5 text-right tabular-nums text-gray-500">
        {fab.meses_compra}
        <span className="text-[11px]">/{fab.span_meses}m</span>
      </td>
      <td className="px-2 py-0.5 text-right tabular-nums text-gray-600">
        {fmtBRL(fab.valor_medio_mes)}
      </td>
      <td className={`px-2 py-0.5 text-right tabular-nums font-medium ${pctExecCor(fab.pct_executado)}`}>
        {fab.pct_executado != null ? `${fab.pct_executado}%` : '—'}
      </td>
    </tr>
  );
});

// ─── Linha cliente ────────────────────────────────────────────────────────────

const LinhaCliente = memo(function LinhaCliente({ cliente, expanded, onToggle, rowIndex, focused, focoFab, ordem, fabricanteFiltrado }) {
  const repr = fabricanteFiltrado && cliente.fabricantes.length > 0
    ? cliente.fabricantes.reduce((a, b) => (a.gap_atual || 0) >= (b.gap_atual || 0) ? a : b)
    : null;

  const gapAtual    = repr ? repr.gap_atual    : cliente.gap_atual;
  const gapMedio    = repr ? repr.gap_medio    : cliente.gap_medio;
  const mesesCompra = repr ? repr.meses_compra : cliente.meses_compra;
  const spanMeses   = repr ? repr.span_meses   : cliente.span_meses;

  const nivel = nivelAlerta(gapAtual, gapMedio);
  const cor   = ALERTA_COLOR[nivel];

  const dias   = gapAtual;
  const atv    = dias <= 30 ? 'ativo' : dias <= 60 ? 'em risco' : 'inativo';
  const atvCor = dias <= 30 ? 'text-green-600' : dias <= 60 ? 'text-orange-500' : 'text-gray-400';

  const refMes = cliente.fabricantes
    .filter(f => { const n = nivelAlerta(f.gap_atual, f.gap_medio); return n === 'recorde' || n === 'proximo'; })
    .reduce((s, f) => s + (f.valor_medio_mes || 0), 0);

  const totalEsperado  = cliente.fabricantes.reduce((s, f) => {
    if (!f.gap_medio || !f.valor_medio_mes) return s;
    return s + (Number(f.valor_medio_mes) * f.gap_medio / 30);
  }, 0);
  const totalRealizado = cliente.fabricantes.reduce((s, f) => s + (f.valor_no_gap || 0), 0);
  const pctAgregado    = totalEsperado > 0 ? Math.round(totalRealizado / totalEsperado * 100) : null;

  const bgRow = focused
    ? 'bg-blue-100'
    : expanded ? 'bg-blue-50'
    : rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';

  return (
    <>
      <tr
        className={`${bgRow} cursor-pointer hover:bg-blue-50 border-b border-gray-100`}
        onClick={onToggle}
        data-foco={focused ? 'true' : undefined}
      >
        <td className="px-2 py-0.5 w-8 text-gray-400">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
        <td className="px-2 py-0.5 tabular-nums text-gray-500 w-20">
          {cliente.ps_cliente}
        </td>
        <td className="px-2 py-0.5 font-medium text-gray-800 whitespace-nowrap">
          {cliente.ps_nomcli}
        </td>
        <td className={`px-2 py-0.5 text-center ${atvCor}`}>{atv}</td>
        <td className={`px-2 py-0.5 text-right tabular-nums font-medium ${cor}`}>
          {diasStr(gapAtual)}
          <span className="ml-1 text-[10px]">{ALERTA_ICON[nivel]}</span>
        </td>
        <td className="px-2 py-0.5 text-right tabular-nums text-gray-400">
          {gapMedio > 0 ? diasStr(gapMedio) : '—'}
        </td>
        <td className="px-2 py-0.5 text-right tabular-nums text-gray-500">
          {mesesCompra}
          <span className="text-[11px]">/{spanMeses}m</span>
        </td>
        <td className={`px-2 py-0.5 text-right tabular-nums font-bold ${refMes > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
          {refMes > 0 ? fmtBRL(refMes) : '—'}
        </td>
        <td className={`px-2 py-0.5 text-right tabular-nums font-medium ${pctExecCor(pctAgregado)}`}>
          {pctAgregado != null ? `${pctAgregado}%` : '—'}
        </td>
      </tr>

      {expanded && (() => {
        const { col, dir } = ordem;
        const mult = dir === 'asc' ? 1 : -1;
        const fabs = [...cliente.fabricantes].sort((a, b) => {
          if (col === 'gap_atual')    return mult * ((a.gap_atual    || 0) - (b.gap_atual    || 0));
          if (col === 'gap_medio')    return mult * ((a.gap_medio    || 0) - (b.gap_medio    || 0));
          if (col === 'meses_compra') return mult * ((a.meses_compra || 0) - (b.meses_compra || 0));
          if (col === 'ref_mes')      return mult * ((a.valor_medio_mes || 0) - (b.valor_medio_mes || 0));
          if (col === 'pct_exec')     return mult * ((a.pct_executado ?? -1) - (b.pct_executado ?? -1));
          if (col === 'nome')         return mult * a.nome_fabricante.localeCompare(b.nome_fabricante);
          return 0;
        });
        return fabs.map((fab, i) => (
          <LinhaFabricante
            key={fab.ps_codfab}
            fab={fab}
            idx={i}
            focused={focoFab === i}
          />
        ));
      })()}
    </>
  );
});

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Insights() {
  const {
    loading, error, carregar,
    filtros, setFiltros,
    opcoesVendedores, opcoesFabricantes, opcoesTabelas,
    clientesFiltrados,
  } = usePortfolio();

  const [expandidos, setExpandidos] = useState(new Set());
  const [foco,       setFoco]       = useState({ c: 0, f: null });
  const [ordem,      setOrdem]      = useState({ col: 'gap_atual', dir: 'desc' });
  const scrollRef = useRef(null);

  // Ordenação sobre clientesFiltrados (que já vem filtrado do context)
  const clientes = useMemo(() => {
    const lista = [...clientesFiltrados];
    const { col, dir } = ordem;
    const mult = dir === 'asc' ? 1 : -1;

    if (col === 'ref_mes') {
      const rm = new Map(lista.map(c => [c.ps_cliente, c.fabricantes
        .filter(f => { const n = nivelAlerta(f.gap_atual, f.gap_medio); return n === 'recorde' || n === 'proximo'; })
        .reduce((s, f) => s + (f.valor_medio_mes || 0), 0)]));
      return lista.sort((a, b) => mult * ((rm.get(a.ps_cliente) || 0) - (rm.get(b.ps_cliente) || 0)));
    }
    if (col === 'pct_exec') {
      const pm = new Map(lista.map(c => {
        const esp  = c.fabricantes.reduce((s, f) => s + (Number(f.valor_medio_mes) * (f.gap_medio || 0) / 30), 0);
        const real = c.fabricantes.reduce((s, f) => s + (f.valor_no_gap || 0), 0);
        return [c.ps_cliente, esp > 0 ? Math.round(real / esp * 100) : -1];
      }));
      return lista.sort((a, b) => mult * ((pm.get(a.ps_cliente) || 0) - (pm.get(b.ps_cliente) || 0)));
    }

    const fabAtivo = filtros.fabricantes.length > 0;
    const reprOf = (c) => fabAtivo && c.fabricantes.length > 0
      ? c.fabricantes.reduce((a, b) => (a.gap_atual || 0) >= (b.gap_atual || 0) ? a : b)
      : null;

    return lista.sort((a, b) => {
      const ra = reprOf(a), rb = reprOf(b);
      if (col === 'gap_atual')    return mult * ((ra ? ra.gap_atual    : a.gap_atual    || 0) - (rb ? rb.gap_atual    : b.gap_atual    || 0));
      if (col === 'gap_medio')    return mult * ((ra ? ra.gap_medio    : a.gap_medio    || 0) - (rb ? rb.gap_medio    : b.gap_medio    || 0));
      if (col === 'meses_compra') return mult * ((ra ? ra.meses_compra : a.meses_compra || 0) - (rb ? rb.meses_compra : b.meses_compra || 0));
      if (col === 'nome')         return mult * a.ps_nomcli.localeCompare(b.ps_nomcli);
      return 0;
    });
  }, [clientesFiltrados, ordem, filtros.fabricantes]);

  const sortBy = (col) => setOrdem(prev =>
    prev.col === col
      ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: 'desc' }
  );

  const SortIcon = ({ col }) => {
    if (ordem.col !== col) return <span className="ml-0.5 text-gray-300">↕</span>;
    return <span className="ml-0.5">{ordem.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  const nivelCliente = useCallback((c) => {
    if (filtros.fabricantes.length > 0 && c.fabricantes.length > 0) {
      const repr = c.fabricantes.reduce((a, b) => (a.gap_atual || 0) >= (b.gap_atual || 0) ? a : b);
      return nivelAlerta(repr.gap_atual, repr.gap_medio);
    }
    return nivelAlerta(c.gap_atual, c.gap_medio);
  }, [filtros.fabricantes]);

  const totalRecordes = useMemo(() =>
    clientes.filter(c => nivelCliente(c) === 'recorde').length,
  [clientes, nivelCliente]);

  const totalProximos = useMemo(() =>
    clientes.filter(c => nivelCliente(c) === 'proximo').length,
  [clientes, nivelCliente]);

  const toggle = useCallback((k) => setExpandidos(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  }), []);

  const toggleTodos = useCallback(() => {
    setExpandidos(prev =>
      prev.size >= clientes.length
        ? new Set()
        : new Set(clientes.map(c => c.ps_cliente))
    );
  }, [clientes]);

  const focoRef       = useRef(foco);
  const clientesRef   = useRef(clientes);
  const expandidosRef = useRef(expandidos);
  focoRef.current       = foco;
  clientesRef.current   = clientes;
  expandidosRef.current = expandidos;

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-foco="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [foco]);

  useEffect(() => {
    const onKey = (e) => {
      const clientes   = clientesRef.current;
      const expandidos = expandidosRef.current;
      if (!clientes.length) return;
      const { c, f } = focoRef.current;
      const cliente    = clientes[c];
      if (!cliente) return;
      const isExpanded = expandidos.has(cliente.ps_cliente);
      const nFabs      = cliente.fabricantes.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (f === null) {
          if (isExpanded && nFabs > 0) setFoco({ c, f: 0 });
          else if (c < clientes.length - 1) setFoco({ c: c + 1, f: null });
        } else {
          if (f < nFabs - 1) setFoco({ c, f: f + 1 });
          else if (c < clientes.length - 1) setFoco({ c: c + 1, f: null });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (f === null) {
          if (c > 0) {
            const prev = clientes[c - 1];
            const prevExpanded = expandidos.has(prev.ps_cliente);
            if (prevExpanded && prev.fabricantes.length > 0) {
              setFoco({ c: c - 1, f: prev.fabricantes.length - 1 });
            } else {
              setFoco({ c: c - 1, f: null });
            }
          }
        } else {
          if (f > 0) setFoco({ c, f: f - 1 });
          else setFoco({ c, f: null });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (f === null) {
          const k = cliente.ps_cliente;
          setExpandidos(prev => { const n = new Set(prev); n.add(k); return n; });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (f === null) {
          const k = cliente.ps_cliente;
          setExpandidos(prev => { const n = new Set(prev); n.delete(k); return n; });
        } else {
          setFoco({ c, f: null });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fabricanteFiltrado = filtros.fabricantes.length > 0;

  const LinhaClienteRow = useCallback(({ cliente, idx, expanded, focused, focoFab, ordem, setFoco, toggle, fabricanteFiltrado }) => (
    <LinhaCliente
      cliente={cliente}
      expanded={expanded}
      onToggle={() => { setFoco({ c: idx, f: null }); toggle(cliente.ps_cliente); }}
      rowIndex={idx}
      focused={focused}
      focoFab={focoFab}
      ordem={ordem}
      fabricanteFiltrado={fabricanteFiltrado}
    />
  ), []);

  // ─── loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
        <p className="text-sm">Computando dados de portfolio...</p>
        <p className="text-xs text-gray-300">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-red-600">
        <AlertTriangle size={28} />
        <p className="font-medium">Erro ao carregar dados</p>
        <p className="text-sm text-gray-500 max-w-md text-center">{error}</p>
        <button onClick={carregar}
          className="mt-2 px-4 py-2 bg-[#1e3a5f] text-white rounded text-sm flex items-center gap-2">
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 bg-gray-50 h-full flex flex-col">

      {/* Título */}
      <div className="mb-4 flex-none">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Lightbulb size={22} className="text-blue-600" />
          Portfolio de Clientes
        </h1>
        <p className="text-sm text-gray-500">
          {clientes.length} clientes
          {totalRecordes > 0 && (
            <> · <span className="text-red-600 font-medium">{totalRecordes} novos recordes</span></>
          )}
          {totalProximos > 0 && (
            <> · <span className="text-orange-500">{totalProximos} próximos do recorde</span></>
          )}
        </p>
      </div>

      {/* Filtros inline fixos */}
      <div className="flex-none bg-white border-b px-3 py-2 flex items-center gap-3 text-[12px] flex-wrap">
        <span className="text-gray-400 flex items-center gap-1 text-[11px] font-medium whitespace-nowrap">
          <Filter size={11} /> Filtros:
        </span>
        <FiltroDropdown
          label="Vendedor"
          opcoes={opcoesVendedores}
          selecionados={filtros.vendedores}
          onChange={v => setFiltros(p => ({ ...p, vendedores: v }))}
        />
        <FiltroDropdown
          label="Fabricante"
          opcoes={opcoesFabricantes}
          selecionados={filtros.fabricantes}
          onChange={v => setFiltros(p => ({ ...p, fabricantes: v }))}
        />
        <FiltroDropdown
          label="Tabela"
          opcoes={opcoesTabelas}
          selecionados={filtros.tabelas}
          onChange={v => setFiltros(p => ({ ...p, tabelas: v }))}
        />
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-[12px] whitespace-nowrap">Rec. mín.:</span>
          <input type="number" min="2" max="13"
            className="border border-gray-200 rounded px-2 py-0.5 w-14 text-[12px] outline-none focus:border-blue-400"
            value={filtros.recorrencia}
            onChange={e => setFiltros(p => ({ ...p, recorrencia: Math.max(2, Number(e.target.value) || 2) }))} />
          <span className="text-gray-400 text-[11px]">m</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-[12px] whitespace-nowrap">Média/mês mín.:</span>
          <input type="number" min="0"
            className="border border-gray-200 rounded px-2 py-0.5 w-20 text-[12px] outline-none focus:border-blue-400"
            value={filtros.volume || ''}
            placeholder="0"
            onChange={e => setFiltros(p => ({ ...p, volume: Number(e.target.value) || 0 }))} />
          <span className="text-gray-400 text-[11px]">R$</span>
        </div>
        {(filtros.vendedores.length > 0 || filtros.clientes.length > 0 || filtros.fabricantes.length > 0 || filtros.tabelas.length > 0 || filtros.recorrencia > 2 || filtros.volume > 0) && (
          <button
            onClick={() => setFiltros({ vendedores: [], clientes: [], fabricantes: [], tabelas: [], recorrencia: 2, volume: 0 })}
            className="ml-auto flex items-center gap-1 text-red-500 hover:text-red-700 text-[11px]">
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Legenda + controles */}
      <div className="flex-none bg-white border-b pb-2 pt-2 px-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="text-red-500 font-medium">Recorde</span><span> — acima da média histórica</span>
        <span className="text-orange-500 font-medium">Próximo</span><span> — acima de 75%</span>
        <span className="text-gray-500 font-medium">Normal</span><span> — dentro da média</span>
        <div className="ml-auto flex items-center gap-3">
          <span>{clientes.length} clientes</span>
          <button onClick={toggleTodos}
            className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
            {expandidos.size >= clientes.length ? 'Recolher' : 'Expandir tudo'}
          </button>
          <button onClick={carregar} className="text-gray-400 hover:text-gray-600" title="Atualizar">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tabela */}
      {clientes.length === 0 ? (
        <div className="bg-white text-center py-16 text-gray-400 text-sm">
          Nenhum dado disponível.
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 bg-white overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="text-gray-500 border-b bg-white sticky top-0 z-10">
              <tr className="whitespace-nowrap">
                <th className="px-2 py-1 font-normal w-8" />
                <th className="px-2 py-1 font-normal text-left w-20">Cód</th>
                <th className="px-2 py-1 font-normal text-left cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('nome')}>
                  Cliente<SortIcon col="nome" />
                </th>
                <th className="px-2 py-1 font-normal text-center w-20">Status</th>
                <th className="px-2 py-1 font-normal text-right w-24 cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('gap_atual')}>
                  Gap atual<SortIcon col="gap_atual" />
                </th>
                <th className="px-2 py-1 font-normal text-right w-24 cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('gap_medio')}>
                  Gap médio<SortIcon col="gap_medio" />
                </th>
                <th className="px-2 py-1 font-normal text-right w-24 cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('meses_compra')}>
                  Compras<SortIcon col="meses_compra" />
                </th>
                <th className="px-2 py-1 font-normal text-right w-28 cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('ref_mes')}>
                  Potencial<SortIcon col="ref_mes" />
                </th>
                <th className="px-2 py-1 font-normal text-right w-20 cursor-pointer select-none hover:text-gray-700" onClick={() => sortBy('pct_exec')}>
                  Exec.<SortIcon col="pct_exec" />
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {clientes.map((c, i) => (
                <LinhaClienteRow
                  key={c.ps_cliente}
                  cliente={c}
                  idx={i}
                  expanded={expandidos.has(c.ps_cliente)}
                  focused={foco.c === i && foco.f === null}
                  focoFab={foco.c === i ? foco.f : null}
                  ordem={ordem}
                  setFoco={setFoco}
                  toggle={toggle}
                  fabricanteFiltrado={fabricanteFiltrado}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
