import { useState, useEffect, useRef } from 'react';

export default function FiltroDropdown({ label, opcoes, selecionados, onChange }) {
  const [aberto,  setAberto]  = useState(false);
  const [busca,   setBusca]   = useState('');
  const [temp,    setTemp]    = useState(selecionados);
  const ref = useRef(null);

  useEffect(() => {
    const onMouse = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const onKey   = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown',   onKey);
    };
  }, []);

  const abrir   = () => { setTemp(selecionados); setBusca(''); setAberto(true); };
  const aplicar = () => { onChange(temp); setAberto(false); };
  const cancelar = () => setAberto(false);
  const limpar   = () => setTemp([]);

  const toggle = (val) => setTemp(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val]);

  const filtradas = opcoes.filter(([, lbl]) =>
    lbl.toLowerCase().includes(busca.toLowerCase())
  );
  const selecionadasFirst = [
    ...filtradas.filter(([v]) => temp.includes(v)),
    ...filtradas.filter(([v]) => !temp.includes(v)),
  ];

  const nomeSelecionados = selecionados.length === 0
    ? null
    : selecionados.length === 1
      ? opcoes.find(([v]) => v === selecionados[0])?.[1] ?? selecionados[0]
      : `${selecionados.length} selecionado(s)`;

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <span className="text-gray-400 text-[12px] whitespace-nowrap">{label}:</span>
      <button
        onClick={aberto ? cancelar : abrir}
        className={`flex items-center gap-1 border rounded px-2 py-0.5 text-[12px] min-w-[110px] text-left ${selecionados.length > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-400'}`}>
        <span className="flex-1 truncate max-w-[140px]">{nomeSelecionados ?? 'Buscar...'}</span>
        {selecionados.length > 0 && (
          <span onClick={e => { e.stopPropagation(); onChange([]); }}
            className="text-blue-400 hover:text-blue-600 ml-1">×</span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg w-64">
          <div className="p-2 border-b flex items-center justify-between text-[11px]">
            <span className="text-gray-500">{temp.length} selecionado(s)</span>
            <button onClick={limpar} className="text-red-500 hover:text-red-700">Limpar</button>
          </div>
          <div className="p-2 border-b">
            <input autoFocus
              className="w-full border border-gray-200 rounded px-2 py-0.5 text-[12px] outline-none focus:border-blue-400"
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="overflow-y-auto max-h-52">
            {temp.length > 0 && busca === '' && (
              <div className="px-2 pt-1 pb-0.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Selecionados</div>
            )}
            {selecionadasFirst.map(([val, nom]) => (
              <label key={val}
                className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-[12px] text-gray-700">
                <input type="checkbox" checked={temp.includes(val)} onChange={() => toggle(val)}
                  className="accent-blue-600" />
                <span className="truncate">{nom}</span>
              </label>
            ))}
            {filtradas.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-gray-400">Nenhum resultado</div>
            )}
          </div>
          <div className="flex gap-2 p-2 border-t justify-end">
            <button onClick={cancelar}
              className="px-3 py-0.5 rounded border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={aplicar}
              className="px-3 py-0.5 rounded bg-blue-600 text-white text-[12px] hover:bg-blue-700">
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
