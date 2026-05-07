import { useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 10000;

const STATUS_LABELS = {
  pending: { label: 'Na fila', cor: 'text-amber-600', icon: Clock },
  running: { label: 'Executando', cor: 'text-blue-600', icon: Loader2 },
  done:    { label: 'Concluído', cor: 'text-green-700', icon: CheckCircle2 },
  error:   { label: 'Erro', cor: 'text-red-600', icon: XCircle },
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuracao(seg) {
  if (seg == null) return '';
  if (seg < 60) return `${seg}s`;
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  return `${min}m ${s}s`;
}

export default function Dados() {
  const { user } = useAuth();
  const [execucoes, setExecucoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disparando, setDisparando] = useState(false);
  const [error, setError] = useState('');

  const carregarExecucoes = async () => {
    const { data, error: err } = await supabase
      .from('sync_executions')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(20);
    if (err) {
      setError(err.message);
    } else {
      setExecucoes(data || []);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarExecucoes();
    const id = setInterval(carregarExecucoes, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const ultima = execucoes.find((e) => e.status === 'done');
  const emAndamento = execucoes.find((e) => e.status === 'running' || e.status === 'pending');

  const handleAtualizar = async () => {
    if (disparando || emAndamento) return;
    setDisparando(true);
    setError('');
    const { error: err } = await supabase.rpc('trigger_sync', {
      p_tipo: 'manual',
      p_criado_por: user?.username || user?.nome || 'desconhecido',
    });
    if (err) {
      setError(err.message);
    } else {
      await carregarExecucoes();
    }
    setDisparando(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Database size={24} className="text-blue-600" />
          Dados
        </h1>
        <p className="text-sm text-gray-500">
          Sincronização do Seek com o Supabase. Roda automaticamente às 03h e 12h.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-5 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Última atualização</p>
            <p className="text-lg font-semibold text-gray-800 mt-0.5">
              {ultima ? formatDateTime(ultima.finished_at || ultima.criado_em) : '—'}
            </p>
            {ultima && (
              <p className="text-xs text-gray-500 mt-0.5">
                {ultima.tipo === 'agendado' ? 'Agendado' : 'Manual'}
                {ultima.duracao_seg != null && ` · duração ${formatDuracao(ultima.duracao_seg)}`}
              </p>
            )}
          </div>

          <button
            onClick={handleAtualizar}
            disabled={disparando || !!emAndamento}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded text-sm font-medium hover:bg-[#2d5a87] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emAndamento ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {emAndamento.status === 'running' ? 'Executando...' : 'Na fila...'}
              </>
            ) : (
              <>
                <RefreshCw size={16} className={disparando ? 'animate-spin' : ''} />
                Atualizar agora
              </>
            )}
          </button>
        </div>

        {emAndamento && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            Sincronização {emAndamento.status === 'running' ? 'em andamento' : 'na fila'}
            {emAndamento.criado_por && ` (disparado por ${emAndamento.criado_por})`}.
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Últimas execuções</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : execucoes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhuma execução registrada ainda.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-gray-500 border-b bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Status</th>
                <th className="text-left px-4 py-2 font-normal">Tipo</th>
                <th className="text-left px-4 py-2 font-normal">Disparado por</th>
                <th className="text-left px-4 py-2 font-normal">Início</th>
                <th className="text-left px-4 py-2 font-normal">Fim</th>
                <th className="text-right px-4 py-2 font-normal">Duração</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {execucoes.map((e) => {
                const s = STATUS_LABELS[e.status] || STATUS_LABELS.pending;
                const Icon = s.icon;
                const animate = e.status === 'running' ? 'animate-spin' : '';
                return (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1.5 ${s.cor}`}>
                        <Icon size={14} className={animate} />
                        {s.label}
                      </span>
                      {e.status === 'error' && e.erro && (
                        <span title={e.erro} className="ml-1 text-xs text-gray-400 cursor-help">(?)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 capitalize text-gray-600">{e.tipo}</td>
                    <td className="px-4 py-2 text-gray-600">{e.criado_por || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(e.started_at || e.criado_em)}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(e.finished_at)}</td>
                    <td className="px-4 py-2 text-right text-gray-600 tabular-nums">
                      {formatDuracao(e.duracao_seg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Agendamento automático às 03h e 12h (horário de Brasília). Para forçar, use "Atualizar agora".
      </p>
    </div>
  );
}
