import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BarChart2, RefreshCw, AlertTriangle, Filter, X } from 'lucide-react';
import { usePortfolio, nivelAlerta } from '../context/PortfolioContext';
import FiltroDropdown from '../components/FiltroDropdown';
import { supabase } from '../lib/supabase';

function fmtBRL(v) {
  if (!v || v === 0) return '—';
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

const CORES = {
  recorde:       '#ef4444',
  proximo:       '#f59e0b',
  normal:        '#3b82f6',
  sem_historico: '#9ca3af',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ tooltip }) {
  const { x, y, client, svgWidth, svgHeight } = tooltip;
  const nivel = client.nivel;
  const corTexto = nivel === 'recorde' ? 'text-red-600' : nivel === 'proximo' ? 'text-orange-500' : 'text-blue-600';
  const dias   = client.gapAtual;
  const status = dias <= 30 ? 'Ativo' : dias <= 60 ? 'Em risco' : 'Inativo';
  const ciclo  = client.gapMedio > 0 ? Math.round(client.gapAtual / client.gapMedio * 100) : null;
  const pct = client.pctAgregado;
  const pctCor = pct == null ? 'text-gray-400' : pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-orange-500' : 'text-red-500';
  const modeFab = client.nome_fabricante != null; // client-filter mode: bolha por fabricante

  const W = 220, H = 200;
  const left = x + 14 + W > (svgWidth || 800) ? x - W - 8 : x + 14;
  const top  = y + 14 + H > (svgHeight || 500) ? y - H - 8 : y + 14;

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-[12px] pointer-events-none"
      style={{ left, top, minWidth: W }}
    >
      {modeFab ? (
        <>
          <div className="font-semibold text-gray-800 mb-0.5 leading-tight">{client.nome_fabricante}</div>
          <div className="text-gray-400 text-[11px] mb-2">{client.ps_nomcli}</div>
        </>
      ) : (
        <>
          <div className="font-semibold text-gray-800 mb-0.5 leading-tight">{client.ps_nomcli}</div>
          <div className="text-gray-400 text-[11px] mb-2">#{client.ps_cliente}</div>
        </>
      )}
      <div className="space-y-0.5 text-gray-600">
        <Row label="Status"      value={status} />
        <Row label="Gap atual"   value={<span className={corTexto}>{client.gapAtual}d</span>} />
        <Row label="Gap médio"   value={`${client.gapMedio}d`} />
        <Row label="% ciclo"     value={ciclo != null ? `${ciclo}%` : '—'} />
        <Row label="Compras"     value={`${client.meses_compra}/${client.span_meses}m`} />
        <Row label="Potencial"   value={<span className="text-blue-700 font-medium">{fmtBRL(client.potencial)}</span>} />
        <Row label="% realizado" value={<span className={pctCor}>{pct != null ? `${pct}%` : '—'}</span>} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── AjudaFiltros ─────────────────────────────────────────────────────────────

function AjudaFiltros({ filtros, opcoesVendedores, opcoesClientes, opcoesFabricantes, opcoesTabelas }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onMouse = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, []);

  function nomeLista(codigos, opcoes) {
    return codigos.map(c => opcoes.find(([v]) => v === c)?.[1] ?? c);
  }
  function listar(nomes) {
    if (nomes.length === 1) return `"${nomes[0]}"`;
    if (nomes.length === 2) return `"${nomes[0]}" e "${nomes[1]}"`;
    return `"${nomes[0]}" e mais ${nomes.length - 1}`;
  }

  const linhas = [];

  if (filtros.vendedores.length > 0) {
    const nomes = nomeLista(filtros.vendedores, opcoesVendedores);
    const complemento = filtros.fabricantes.length > 0
      ? ' Não significa que vendeu a marca filtrada.'
      : '';
    linhas.push(`O vendedor ${listar(nomes)} fez alguma venda para esses clientes nos últimos 12 meses — em qualquer marca.${complemento}`);
  }
  if (filtros.clientes.length > 0) {
    const nomesComCod = filtros.clientes.map(c => {
      const nome = opcoesClientes.find(([v]) => v === c)?.[1] ?? `Cliente ${c}`;
      return `#${c} ${nome}`;
    });
    const listarComCod = (arr) => arr.length === 1 ? `"${arr[0]}"` : arr.length === 2 ? `"${arr[0]}" e "${arr[1]}"` : `"${arr[0]}" e mais ${arr.length - 1}`;
    linhas.push(`Você selecionou o cliente ${listarComCod(nomesComCod)}. Cada bolha representa uma marca que ele compra.`);
  }
  if (filtros.fabricantes.length > 0) {
    const nomes = nomeLista(filtros.fabricantes, opcoesFabricantes);
    linhas.push(`Esses clientes têm histórico de compra de ${listar(nomes)} — pelo menos 2 meses de compra no último ano, independente de qual vendedor fechou.`);
  }
  if (filtros.tabelas.length > 0) {
    const nomes = nomeLista(filtros.tabelas, opcoesTabelas);
    linhas.push(`Tabela de preço: ${listar(nomes)}.`);
  }
  if (filtros.recorrencia > 2) {
    linhas.push(`Compraram em pelo menos ${filtros.recorrencia} meses diferentes no último ano.`);
  }
  const modoCliente = filtros.clientes.length === 1;
  const modoClienteMulti = filtros.clientes.length > 1;

  if (filtros.volume > 0) {
    const sujeito = modoCliente ? 'Este cliente' : 'Cada cliente';
    if (filtros.fabricantes.length > 0) {
      linhas.push(`${sujeito} gasta em média pelo menos R$ ${filtros.volume.toLocaleString('pt-BR')} por mês nessa marca quando compra — calculado só nos meses em que houve compra dessa marca.`);
    } else if (modoCliente) {
      linhas.push(`Exibe apenas as marcas em que este cliente gasta em média pelo menos R$ ${filtros.volume.toLocaleString('pt-BR')} por mês quando compra. Marcas abaixo desse valor não aparecem. O valor é por marca individual, calculado só nos meses com compra.`);
    } else {
      linhas.push(`${sujeito} gasta em média pelo menos R$ ${filtros.volume.toLocaleString('pt-BR')} por mês em pelo menos uma das marcas que compra — o valor é por marca individual, não o total de todas as marcas somadas. Calculado só nos meses com compra.`);
    }
  }

  const semFiltro = linhas.length === 0;

  const txtPotencial = modoCliente
    ? 'Potencial = soma do valor médio mensal das marcas em vermelho e amarelo deste cliente. É o quanto ele costuma gastar nessas marcas quando está comprando normalmente.'
    : 'Potencial = soma do valor médio mensal de cada cliente nas marcas em vermelho e amarelo. É o quanto esses clientes costumam gastar nessas marcas quando estão comprando normalmente.';

  const txtExec = modoCliente
    ? '% Exec. = do valor que era esperado nesse período, quanto foi efetivamente comprado. 100% = comprou o valor esperado no intervalo histórico dele. Abaixo de 100% = comprou menos do que o ritmo dele sugeria.'
    : '% Exec. = do valor que era esperado de todos os clientes nesse período, quanto foi efetivamente comprado. 100% = todos compraram no ritmo histórico. Abaixo de 100% = compraram menos do que o esperado.';

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 text-[10px] font-bold flex items-center justify-center leading-none"
        title="Como interpretar este cenário"
      >?</button>
      {aberto && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[12px] text-gray-600 w-80 leading-relaxed">
          <p className="font-semibold text-gray-700 mb-1.5">Como interpretar este cenário</p>
          {semFiltro ? (
            <p>Todos os clientes com pelo menos 2 meses de compra por marca no último ano. Sem filtros ativos.</p>
          ) : (
            <ul className="space-y-1.5 list-disc list-inside">
              {linhas.map((l, i) => <li key={i}>{l}</li>)}
              {linhas.length > 1 && <li className="text-gray-400">Todos os critérios acima precisam ser verdadeiros ao mesmo tempo.</li>}
            </ul>
          )}
          <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] space-y-1.5">
            <p className="font-semibold text-gray-600">Lendo o gráfico</p>
            {modoCliente ? (
              <>
                <p className="text-gray-400">Cada bolha é uma <span className="font-medium text-gray-500">marca</span> que este cliente compra. O eixo horizontal mostra há quantos dias ele não compra essa marca. O eixo vertical mostra qual é o intervalo normal de compra dela.</p>
                <p className="text-gray-400"><span className="font-medium text-gray-500">Tamanho da bolha</span> = quanto este cliente gasta por mês nessa marca quando compra.</p>
              </>
            ) : (
              <>
                <p className="text-gray-400">Cada bolha é um <span className="font-medium text-gray-500">cliente</span>. O eixo horizontal mostra há quantos dias ele não compra. O eixo vertical mostra qual é o intervalo normal de compra dele.</p>
                <p className="text-gray-400"><span className="font-medium text-gray-500">Tamanho da bolha</span> = soma do valor médio mensal nas marcas em que está atrasado (vermelho + amarelo). Quanto maior, mais relevante é agir.</p>
              </>
            )}
            <p className="text-gray-400"><span className="font-medium text-red-500">Vermelho</span> = já passou do intervalo histórico — atrasado. <span className="font-medium text-amber-500">Amarelo</span> = se aproximando do limite. <span className="font-medium text-blue-500">Azul</span> = dentro do ritmo normal.</p>
            <p className="text-gray-400"><span className="font-medium text-gray-500">Potencial</span> = {txtPotencial.replace('Potencial = ', '')}</p>
            <p className="text-gray-400"><span className="font-medium text-gray-500">% Exec.</span> = {txtExec.replace('% Exec. = ', '')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TabelaMensal ─────────────────────────────────────────────────────────────

function fmtMes(yyyymm) {
  const [y, m] = yyyymm.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[Number(m) - 1]}/${String(y).slice(2)}`;
}

function TabelaMensal({ rows, meses, nomeFab }) {
  // Totais por mês
  const totaisMes = useMemo(() => {
    const t = {};
    for (const mes of meses) {
      t[mes] = rows.reduce((s, r) => s + (r.mesesMap[mes] || 0), 0);
    }
    return t;
  }, [rows, meses]);

  const totalGeral = rows.reduce((s, r) => s + r.total, 0);

  const thBase = 'px-3 py-1.5 text-[11px] font-medium text-gray-500 whitespace-nowrap border-b border-gray-100';
  const thTot  = 'px-3 py-1.5 text-[11px] font-medium text-gray-500 whitespace-nowrap';
  const tdBase = 'px-3 py-1 text-[11px] text-right whitespace-nowrap border-b border-gray-100';
  const sepTotal = 'border-r-2 border-gray-300';

  return (
    <table className="w-full border-separate border-spacing-0 text-[11px]">
      <thead className="bg-gray-50 sticky top-0 z-10">
        {/* Linha de totais */}
        <tr className="bg-blue-50">
          <th className={`${thTot} text-left sticky left-0 bg-blue-50 w-12`}>Cód</th>
          <th className={`${thTot} text-left sticky left-12 bg-blue-50 min-w-[160px]`}>Fabricante</th>
          <th className={`${thTot} text-right bg-blue-50 w-24 ${sepTotal}`}>{fmtBRL(totalGeral)}</th>
          {meses.map(m => (
            <th key={m} className={`${thTot} text-right bg-blue-50 w-20`}>
              {totaisMes[m] > 0 ? <span className="text-blue-700">{fmtBRL(totaisMes[m])}</span> : <span className="text-gray-300">—</span>}
            </th>
          ))}
        </tr>
        {/* Cabeçalho de meses */}
        <tr>
          <th className={`${thBase} text-left sticky left-0 bg-gray-50`}></th>
          <th className={`${thBase} text-left sticky left-12 bg-gray-50`}></th>
          <th className={`${thBase} text-right ${sepTotal}`}>Total</th>
          {meses.map(m => (
            <th key={m} className={`${thBase} text-right`}>{fmtMes(m)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const bg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
          return (
            <tr key={row.codfab} className={`${bg} hover:bg-blue-50`}>
              <td className={`${tdBase} text-left text-gray-400 sticky left-0 ${bg}`}>{row.codfab}</td>
              <td className={`${tdBase} text-left text-gray-700 sticky left-12 ${bg} font-medium`}>{nomeFab(row.codfab)}</td>
              <td className={`${tdBase} text-gray-700 font-medium ${sepTotal}`}>{fmtBRL(row.total)}</td>
              {meses.map(m => {
                const v = row.mesesMap[m] || 0;
                return (
                  <td key={m} className={tdBase}>
                    {v > 0 ? <span className="text-gray-600">{fmtBRL(v)}</span> : <span className="text-gray-200">—</span>}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Mapa ─────────────────────────────────────────────────────────────────────

export default function Mapa() {
  const {
    clientesFiltrados, filtros, setFiltros,
    opcoesVendedores, opcoesClientes, opcoesFabricantes, opcoesTabelas,
    loading, error, carregar,
  } = usePortfolio();

  const wrapperRef  = useRef(null);
  const svgRef      = useRef(null);
  const simRef      = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [ocultarRealizados, setOcultarRealizados] = useState(false);
  const [resizeKey, setResizeKey] = useState(0);

  const fabricanteFiltrado = filtros.fabricantes.length > 0;

  // ─── Tabela mensal (modo cliente filtrado) ────────────────────────────────
  const [tabelaDados,   setTabelaDados]   = useState(null);
  const [tabelaLoading, setTabelaLoading] = useState(false);

  // Últimos 13 meses no formato YYYY-MM
  const meses13 = useMemo(() => {
    const result = [];
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
  }, []);

  useEffect(() => {
    if (filtros.clientes.length === 0) { setTabelaDados(null); return; }
    let cancelled = false;
    setTabelaLoading(true);
    const desde = `${meses13[0]}-01`;
    supabase
      .from('vendas_detalhado')
      .select('ps_codfab, ps_dt_saida, valor_liq')
      .in('ps_cliente', filtros.clientes)
      .gte('ps_dt_saida', desde)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setTabelaDados([]); setTabelaLoading(false); return; }
        const map = new Map();
        for (const row of (data || [])) {
          const mes = row.ps_dt_saida.slice(0, 7);
          if (!meses13.includes(mes)) continue;
          if (!map.has(row.ps_codfab)) map.set(row.ps_codfab, {});
          const fd = map.get(row.ps_codfab);
          fd[mes] = (fd[mes] || 0) + Number(row.valor_liq || 0);
        }
        const rows = Array.from(map.entries())
          .map(([codfab, mesesMap]) => ({
            codfab,
            mesesMap,
            total: Object.values(mesesMap).reduce((s, v) => s + v, 0),
          }))
          .sort((a, b) => b.total - a.total);
        setTabelaDados(rows);
        setTabelaLoading(false);
      });
    return () => { cancelled = true; };
  }, [filtros.clientes, meses13]);

  // Re-renderiza o gráfico ao redimensionar a janela
  useEffect(() => {
    const onResize = () => setResizeKey(k => k + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clienteFiltrado = filtros.clientes.length > 0;

  // Dados base (todos os clientes válidos, sem filtro de ocultarRealizados)
  const chartDataBase = useMemo(() => {
    // Modo fabricante: cliente(s) selecionado(s) → uma bolha por fabricante
    if (clienteFiltrado) {
      return clientesFiltrados.flatMap(c =>
        c.fabricantes
          .filter(f => f.gap_atual > 0 && f.gap_medio > 0
            && (filtros.volume <= 0 || (Number(f.valor_medio_mes) || 0) >= filtros.volume)
          )
          .map(f => ({
            // identificadores
            id:            `${c.ps_cliente}-${f.ps_codfab}`,
            ps_cliente:    c.ps_cliente,
            ps_nomcli:     c.ps_nomcli,
            ps_codfab:     f.ps_codfab,
            nome_fabricante: f.nome_fabricante,
            // métricas do par
            gapAtual:      f.gap_atual,
            gapMedio:      f.gap_medio,
            meses_compra:  f.meses_compra,
            span_meses:    f.span_meses,
            valor_medio_mes: Number(f.valor_medio_mes) || 0,
            pctAgregado:   f.pct_executado,
            potencial:     Number(f.valor_medio_mes) || 0,
            nivel:         nivelAlerta(f.gap_atual, f.gap_medio),
            fabricantes:   [f], // compatibilidade com cálculos de totais
          }))
      );
    }

    // Modo cliente (padrão)
    return clientesFiltrados
      .map(c => {
        const repr = fabricanteFiltrado && c.fabricantes.length > 0
          ? c.fabricantes.reduce((a, b) => (a.gap_atual || 0) >= (b.gap_atual || 0) ? a : b)
          : null;

        const gapAtual = repr ? repr.gap_atual : c.gap_atual;
        const gapMedio = repr ? repr.gap_medio : c.gap_medio;

        const potencial = c.fabricantes
          .filter(f => { const n = nivelAlerta(f.gap_atual, f.gap_medio); return n === 'recorde' || n === 'proximo'; })
          .reduce((s, f) => s + (Number(f.valor_medio_mes) || 0), 0);

        const totalEsperado = c.fabricantes.reduce((s, f) => {
          if (!f.gap_medio || !f.valor_medio_mes) return s;
          return s + (Number(f.valor_medio_mes) * f.gap_medio / 30);
        }, 0);
        const totalRealizado = c.fabricantes.reduce((s, f) => s + (f.valor_no_gap || 0), 0);
        const pctAgregado = totalEsperado > 0 ? Math.round(totalRealizado / totalEsperado * 100) : null;
        const nivel = nivelAlerta(gapAtual, gapMedio);

        return { ...c, gapAtual, gapMedio, potencial, pctAgregado, nivel };
      })
      .filter(d => d.gapAtual != null && d.gapAtual > 0 && d.gapMedio != null && d.gapMedio > 0);
  }, [clientesFiltrados, fabricanteFiltrado, clienteFiltrado]);

  // chartData: dados visíveis no gráfico (respeita ocultarRealizados)
  const chartData = useMemo(() =>
    ocultarRealizados
      ? chartDataBase.filter(d => d.pctAgregado == null || d.pctAgregado < 100)
      : chartDataBase,
  [chartDataBase, ocultarRealizados]);

  // ─── D3 render ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !chartData.length) return;

    // Parar simulação anterior
    if (simRef.current) simRef.current.stop();

    const totalWidth  = svgEl.clientWidth  || 800;
    const totalHeight = svgEl.clientHeight || 500;
    const margin = { top: 24, right: 32, bottom: 52, left: 62 };
    const width  = totalWidth  - margin.left - margin.right;
    const height = totalHeight - margin.top  - margin.bottom;
    if (width <= 0 || height <= 0) return;

    // Escalas
    const xScale = d3.scaleLog().domain([1, 400]).range([0, width]).clamp(true);
    const yScale = d3.scaleLog().domain([1, 400]).range([height, 0]).clamp(true);
    const maxPot = Math.max(1, d3.max(chartData, d => d.potencial) || 1);
    const rScale = d3.scaleSqrt().domain([0, maxPot]).range([5, 36]).clamp(true);

    // Limpar SVG
    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl)
      .attr('width', totalWidth)
      .attr('height', totalHeight);

    // Defs
    const defs = svg.append('defs');

    // Clip da área do gráfico (bolhas não escapam dos eixos)
    defs.append('clipPath').attr('id', 'mapa-chart-clip')
      .append('rect').attr('width', width).attr('height', height);

    // Grupo de margem (eixos ficam aqui, fora do zoom)
    const mg = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grupo de conteúdo com clip
    const clipG  = mg.append('g').attr('clip-path', 'url(#mapa-chart-clip)');
    const innerG = clipG.append('g');

    // ── Zonas de fundo (bandas verticais por gap_atual) ─────────────────────
    const zones = [
      { x1: 1,  x2: 30,  color: '#86efac', label: 'Ativo',    labelColor: '#15803d' },
      { x1: 30, x2: 60,  color: '#fcd34d', label: 'Em risco', labelColor: '#92400e' },
      { x1: 60, x2: 400, color: '#cbd5e1', label: 'Inativo',  labelColor: '#475569' },
    ];
    zones.forEach(({ x1, x2, color, label, labelColor }) => {
      const zx = xScale(x1);
      const zw = xScale(x2) - xScale(x1);
      innerG.append('rect')
        .attr('x', zx)
        .attr('y', 0)
        .attr('width', zw)
        .attr('height', height)
        .attr('fill', color)
        .attr('opacity', 0.5);
      // Rótulo centralizado no topo da zona (só se largura suficiente)
      if (zw > 30) {
        innerG.append('text')
          .attr('x', zx + zw / 2)
          .attr('y', 13)
          .attr('text-anchor', 'middle')
          .attr('font-size', 10)
          .attr('fill', labelColor)
          .attr('opacity', 0.8)
          .attr('pointer-events', 'none')
          .text(label);
      }
      // Linha de divisão no início de cada zona (exceto a primeira)
      if (x1 > 1) {
        innerG.append('line')
          .attr('x1', zx).attr('y1', 0)
          .attr('x2', zx).attr('y2', height)
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1)
          .attr('opacity', 0.4)
          .attr('pointer-events', 'none');
      }
    });

    // ── Linha diagonal gap_atual = gap_medio ─────────────────────────────────
    innerG.append('line')
      .attr('x1', xScale(1))   .attr('y1', yScale(1))
      .attr('x2', xScale(400)) .attr('y2', yScale(400))
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '5,4')
      .attr('opacity', 0.55);

    // ── Nós da simulação ─────────────────────────────────────────────────────
    const nodes = chartData.map(d => ({
      ...d,
      r:  rScale(d.potencial),
      tx: xScale(Math.max(1, d.gapAtual)),
      ty: yScale(Math.max(1, d.gapMedio)),
    }));

    // ClipPaths para o preenchimento verde (bolhas normais/azuis)
    nodes.forEach(d => {
      if (!d.pctAgregado || d.pctAgregado <= 0) return;
      const pct = Math.min(100, d.pctAgregado);
      const r   = d.r;
      const uid = d.id ?? d.ps_cliente;
      // rect que cobre a fração inferior da bolha
      defs.append('clipPath').attr('id', `gfill-${uid}`)
        .append('rect')
        .attr('x', -r)
        .attr('width', 2 * r)
        .attr('y', r * (1 - 2 * pct / 100))
        .attr('height', 2 * r * pct / 100);
    });

    // ── Simulação de forças ──────────────────────────────────────────────────
    const sim = d3.forceSimulation(nodes)
      .force('x',       d3.forceX(d => d.tx).strength(0.45))
      .force('y',       d3.forceY(d => d.ty).strength(0.45))
      .force('collide', d3.forceCollide(d => d.r + 1.5).strength(0.85))
      .stop();
    simRef.current = sim;

    // Aquecimento síncrono (posições iniciais já boas antes de renderizar)
    for (let i = 0; i < 200; i++) sim.tick();

    // ── Bolhas ───────────────────────────────────────────────────────────────
    const nodeGs = innerG.selectAll('.bubble')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'bubble')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer');

    // Círculo base (cor por nível)
    nodeGs.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => CORES[d.nivel] ?? '#9ca3af')
      .attr('stroke', d => {
        const c = d3.color(CORES[d.nivel] ?? '#9ca3af');
        return c ? c.darker(0.6).toString() : '#555';
      })
      .attr('stroke-width', 1)
      .attr('opacity', 0.82);

    // Preenchimento verde (somente bolhas azuis/normais com pct > 0)
    nodeGs.filter(d => (d.pctAgregado ?? 0) > 0)
      .append('circle')
      .attr('r', d => d.r)
      .attr('fill', '#22c55e')
      .attr('opacity', 0.65)
      .attr('clip-path', d => `url(#gfill-${d.id ?? d.ps_cliente})`);

    // Tooltip + double-click para selecionar cliente ou fabricante
    nodeGs
      .on('mousemove', (event, d) => {
        const [mx, my] = d3.pointer(event, svgEl);
        setTooltip({ x: mx, y: my, client: d, svgWidth: totalWidth, svgHeight: totalHeight });
      })
      .on('mouseleave', () => setTooltip(null))
      .on('dblclick', (event, d) => {
        event.preventDefault();
        setTooltip(null);
        if (d.ps_codfab != null) {
          // Modo cliente-filtrado: bolha é um fabricante → filtra somente esse fabricante
          setFiltros(p => ({ ...p, fabricantes: [d.ps_codfab] }));
        } else {
          // Modo normal: bolha é um cliente → drilla para ver fabricantes desse cliente
          setFiltros(p => ({ ...p, clientes: [d.ps_cliente], fabricantes: [] }));
        }
      });

    // ── Eixos ────────────────────────────────────────────────────────────────
    const xAxisG = mg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => `${d}d`));

    const yAxisG = mg.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d}d`));

    // Label eixo X
    mg.append('text')
      .attr('x', width / 2).attr('y', height + 44)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('fill', '#6b7280')
      .text('Gap atual — dias desde a última compra →');

    // Label eixo Y
    mg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -48)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('fill', '#6b7280')
      .text('← Gap médio — ritmo histórico de compra');

    // Estilo dos eixos
    [xAxisG, yAxisG].forEach(ax => {
      ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af');
      ax.selectAll('line').attr('stroke', '#e5e7eb');
      ax.select('.domain').attr('stroke', '#e5e7eb');
    });

    // ── Continua simulação com rAF ────────────────────────────────────────────
    let rafId;
    const tick = () => {
      if (sim.alpha() < sim.alphaMin()) return;
      sim.tick();
      nodeGs.attr('transform', d => `translate(${d.x},${d.y})`);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      sim.stop();
      cancelAnimationFrame(rafId);
    };
  }, [chartData, resizeKey]);

  // ─── Estados de loading / erro ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
        <p className="text-sm">Carregando dados...</p>
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

  const temFiltros = filtros.vendedores.length > 0 || filtros.clientes.length > 0 ||
    filtros.fabricantes.length > 0 || filtros.tabelas.length > 0 ||
    filtros.recorrencia > 2 || filtros.volume > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 bg-gray-50 h-full flex flex-col">

      {/* Título */}
      <div className="mb-3 flex-none flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 size={22} className="text-blue-600" />
            Mapa de Portfolio
          </h1>
          <p className="text-sm text-gray-500">
            {clienteFiltrado
              ? `${chartData.length} fabricantes`
              : `${chartData.length} clientes`}
            {' '}· Abaixo da diagonal = recorde de ausência
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <label className="flex items-center gap-2 text-[12px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ocultarRealizados}
              onChange={e => setOcultarRealizados(e.target.checked)}
              className="accent-blue-600"
            />
            Ocultar 100% realizados
          </label>
          <button onClick={carregar} className="text-gray-400 hover:text-gray-600" title="Atualizar">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Filtros */}
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
          label="Cliente"
          opcoes={opcoesClientes}
          selecionados={filtros.clientes}
          onChange={v => setFiltros(p => ({ ...p, clientes: v }))}
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
        <AjudaFiltros
          filtros={filtros}
          opcoesVendedores={opcoesVendedores}
          opcoesClientes={opcoesClientes}
          opcoesFabricantes={opcoesFabricantes}
          opcoesTabelas={opcoesTabelas}
        />
        {temFiltros && (
          <button
            onClick={() => setFiltros({ vendedores: [], clientes: [], fabricantes: [], tabelas: [], recorrencia: 2, volume: 0 })}
            className="ml-auto flex items-center gap-1 text-red-500 hover:text-red-700 text-[11px]">
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Área scrollável: legenda (sticky) + gráfico + tabela */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* Legenda — sticky dentro do scroll */}
      <div className="sticky top-0 z-20 bg-white border-b pb-2 pt-1.5 px-3 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 opacity-85" />
          Recorde
          <span className="text-red-500 font-medium">{chartDataBase.filter(d => d.nivel === 'recorde').length}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400 opacity-85" />
          Próximo
          <span className="text-amber-500 font-medium">{chartDataBase.filter(d => d.nivel === 'proximo').length}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 opacity-85" />
          Normal
          <span className="text-blue-500 font-medium">{chartDataBase.filter(d => d.nivel === 'normal').length}</span>
          <span className="text-green-600 ml-0.5">(verde = % realizado)</span>
        </span>
        {(() => {
          const totalPot  = clienteFiltrado
            ? chartDataBase.filter(d => d.nivel === 'recorde' || d.nivel === 'proximo').reduce((s, d) => s + (d.potencial || 0), 0)
            : chartDataBase.reduce((s, d) => s + (d.potencial || 0), 0);
          const totalReal = chartDataBase.reduce((s, d) => s + d.fabricantes.reduce((a, f) => a + (f.valor_no_gap || 0), 0), 0);
          const totalEsp  = chartDataBase.reduce((s, d) => s + d.fabricantes.reduce((a, f) => {
            if (!f.gap_medio || !f.valor_medio_mes) return a;
            return a + (Number(f.valor_medio_mes) * f.gap_medio / 30);
          }, 0), 0);
          const pctTotal  = totalEsp > 0 ? Math.round(totalReal / totalEsp * 100) : null;
          const pctCor    = pctTotal == null ? 'text-gray-400' : pctTotal >= 100 ? 'text-green-600' : pctTotal >= 50 ? 'text-orange-500' : 'text-red-500';
          return (
            <span className="ml-4 flex items-center gap-3 text-gray-400 border-l pl-4">
              <span>Potencial <span className="text-blue-600 font-medium">{fmtBRL(totalPot)}</span></span>
              {pctTotal != null && <span>Exec. <span className={`font-medium ${pctCor}`}>{pctTotal}%</span></span>}
            </span>
          );
        })()}
        <span className="ml-auto text-gray-400">Tamanho = potencial &nbsp;·&nbsp; Eixos em escala logarítmica</span>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <div className="h-[520px] bg-white flex items-center justify-center text-gray-400 text-sm border-x border-gray-100">
          Nenhum cliente disponível com os filtros atuais.
        </div>
      ) : (
        <div ref={wrapperRef} className="h-[520px] bg-white relative border-x border-gray-100 overflow-hidden">
          <svg ref={svgRef} className="w-full h-full" />
          {tooltip && <Tooltip tooltip={tooltip} />}
        </div>
      )}

      {/* Tabela mensal — visível apenas no modo cliente filtrado */}
      {clienteFiltrado && (
        <div className="bg-white border-x border-b border-gray-100 overflow-x-auto">
          {tabelaLoading ? (
            <div className="flex items-center justify-center h-20 text-gray-400 text-sm gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              Carregando vendas...
            </div>
          ) : !tabelaDados || tabelaDados.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
              Nenhuma venda encontrada no período.
            </div>
          ) : (
            <TabelaMensal
              rows={tabelaDados}
              meses={meses13}
              nomeFab={codfab => opcoesFabricantes.find(([v]) => v === codfab)?.[1] ?? `Fab ${codfab}`}
            />
          )}
        </div>
      )}

      </div>{/* fim área scrollável */}
    </div>
  );
}
