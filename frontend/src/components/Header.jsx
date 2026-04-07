import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BarChart2,
  User,
  LogOut,
  ChevronDown,
  Key,
  Users,
  Plus,
  ArrowLeft,
  Pencil,
} from 'lucide-react';

const navItems = [
  { name: 'Mapa', to: '/mapa', icon: BarChart2 },
];

const PERFIS = [
  { value: 'vendedor',     label: 'Usuário' },
  { value: 'proprietario', label: 'Administrador' },
];

const FORM_VAZIO = { nome: '', username: '', senha: '', cargo: 'vendedor', ativo: true };

export default function Header() {
  const { user, logout, alterarSenha, podeVerTodos } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [senhaSuccess, setSenhaSuccess] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // Gerenciar usuários
  const [showGerenciar, setShowGerenciar] = useState(false);
  const [gerModo, setGerModo] = useState('lista'); // 'lista' | 'form'
  const [gerUsuarios, setGerUsuarios] = useState([]);
  const [gerLoading, setGerLoading] = useState(false);
  const [gerError, setGerError] = useState('');
  const [gerForm, setGerForm] = useState(FORM_VAZIO);
  const [gerEditId, setGerEditId] = useState(null);
  const [gerSalvando, setGerSalvando] = useState(false);
  const [gerSucesso, setGerSucesso] = useState(false);

  // Cmd/Ctrl + ArrowLeft/Right para navegar entre abas
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const currentIndex = navItems.findIndex((item) => location.pathname === item.to);
      if (currentIndex === -1) return;

      e.preventDefault();
      if (e.key === 'ArrowRight') {
        navigate(navItems[(currentIndex + 1) % navItems.length].to);
      } else {
        navigate(navItems[(currentIndex - 1 + navItems.length) % navItems.length].to);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname, navigate]);

  const abrirGerenciar = async () => {
    setShowUserMenu(false);
    setGerModo('lista');
    setGerError('');
    setGerSucesso(false);
    setShowGerenciar(true);
    setGerLoading(true);
    const { data, error } = await supabase
      .from('vendedores')
      .select('id,nome,username,cargo,ativo')
      .order('nome');
    setGerLoading(false);
    if (error) setGerError(error.message);
    else setGerUsuarios(data || []);
  };

  const abrirNovo = () => {
    setGerForm(FORM_VAZIO);
    setGerEditId(null);
    setGerError('');
    setGerSucesso(false);
    setGerModo('form');
  };

  const abrirEditar = (u) => {
    setGerForm({ nome: u.nome, username: u.username, senha: '', cargo: u.cargo || 'vendedor', ativo: u.ativo });
    setGerEditId(u.id);
    setGerError('');
    setGerSucesso(false);
    setGerModo('form');
  };

  const salvarUsuario = async (e) => {
    e.preventDefault();
    setGerError('');
    if (!gerForm.nome.trim() || !gerForm.username.trim()) {
      setGerError('Nome e usuário são obrigatórios');
      return;
    }
    if (!gerEditId && !gerForm.senha) {
      setGerError('Senha obrigatória para novo usuário');
      return;
    }
    setGerSalvando(true);
    try {
      if (gerEditId) {
        const upd = {
          nome: gerForm.nome.trim(),
          username: gerForm.username.trim(),
          cargo: gerForm.cargo,
          ativo: gerForm.ativo,
        };
        if (gerForm.senha) upd.senha_hash = gerForm.senha;
        const { error } = await supabase.from('vendedores').update(upd).eq('id', gerEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendedores').insert({
          nome: gerForm.nome.trim(),
          username: gerForm.username.trim(),
          senha_hash: gerForm.senha,
          cargo: gerForm.cargo,
          ativo: true,
        });
        if (error) throw error;
      }
      setGerSucesso(true);
      setTimeout(async () => {
        setGerSucesso(false);
        setGerModo('lista');
        setGerLoading(true);
        const { data } = await supabase.from('vendedores').select('id,nome,username,cargo,ativo').order('nome');
        setGerLoading(false);
        setGerUsuarios(data || []);
      }, 1000);
    } catch (err) {
      setGerError(err.message);
    } finally {
      setGerSalvando(false);
    }
  };

  const abrirModalSenha = () => {
    setShowUserMenu(false);
    setShowSenhaModal(true);
    setSenhaError('');
    setSenhaSuccess(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmaSenha('');
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setSenhaError('');
    setSenhaSuccess(false);

    if (novaSenha !== confirmaSenha) {
      setSenhaError('As senhas não coincidem');
      return;
    }
    if (novaSenha.length < 3) {
      setSenhaError('A nova senha deve ter pelo menos 3 caracteres');
      return;
    }

    setSalvandoSenha(true);
    const result = await alterarSenha(senhaAtual, novaSenha);
    setSalvandoSenha(false);

    if (result.success) {
      setSenhaSuccess(true);
      setTimeout(() => {
        setShowSenhaModal(false);
        setSenhaSuccess(false);
      }, 1500);
    } else {
      setSenhaError(result.error);
    }
  };

  return (
    <header className="w-full">
      <div className="bg-[#1e3a5f] flex items-center h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-6 shrink-0">
          <img src="/logo-novacenter.png" alt="NovaCenter" className="h-10 w-auto object-contain" />
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon size={16} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <User size={14} />
            {user?.nome || 'Usuário'}
            <ChevronDown size={14} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg py-1 min-w-[180px] z-50">
              {podeVerTodos() && (
                <button
                  onClick={abrirGerenciar}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Users size={14} />
                  Gerenciar Usuários
                </button>
              )}
              <button
                onClick={abrirModalSenha}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Key size={14} />
                Alterar Senha
              </button>
              <button
                onClick={logout}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Alterar Senha */}
      {showSenhaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Alterar Senha</h3>
            <form onSubmit={handleAlterarSenha} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              {senhaError && <p className="text-red-600 text-sm">{senhaError}</p>}
              {senhaSuccess && <p className="text-green-600 text-sm">Senha alterada com sucesso!</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSenhaModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoSenha}
                  className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] disabled:opacity-50"
                >
                  {salvandoSenha ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}

      {/* Modal Gerenciar Usuários */}
      {showGerenciar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              {gerModo === 'lista' ? (
                <>
                  <h3 className="text-base font-semibold">Gerenciar Usuários</h3>
                  <button
                    onClick={abrirNovo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-sm rounded-lg hover:bg-[#2d5a87]"
                  >
                    <Plus size={14} />
                    Novo Usuário
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGerModo('lista')} className="text-gray-400 hover:text-gray-600">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-base font-semibold">
                      {gerEditId ? 'Editar Usuário' : 'Novo Usuário'}
                    </h3>
                  </div>
                  <div />
                </>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {gerModo === 'lista' ? (
                gerLoading ? (
                  <div className="flex justify-center py-8 text-gray-400 text-sm">Carregando...</div>
                ) : gerError ? (
                  <div className="text-red-500 text-sm py-4">{gerError}</div>
                ) : gerUsuarios.length === 0 ? (
                  <div className="text-gray-400 text-sm py-4 text-center">Nenhum usuário encontrado.</div>
                ) : (
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide">
                        <th className="pb-2 font-medium">Nome</th>
                        <th className="pb-2 font-medium">Usuário</th>
                        <th className="pb-2 font-medium">Perfil</th>
                        <th className="pb-2 font-medium text-center">Ativo</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gerUsuarios.map((u) => {
                        const isAdm = u.cargo === 'proprietario' || u.cargo === 'gerente';
                        return (
                        <tr key={u.id} className="border-t border-gray-100">
                          <td className="py-2 pr-3 text-gray-800 font-medium">{u.nome}</td>
                          <td className="py-2 pr-3 text-gray-500">{u.username}</td>
                          <td className="py-2 pr-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${isAdm ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                              {isAdm ? 'Administrador' : 'Usuário'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {u.ativo ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => abrirEditar(u)}
                              className="text-gray-400 hover:text-blue-600 p-1 rounded"
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                <form onSubmit={salvarUsuario} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <input
                        type="text"
                        value={gerForm.nome}
                        onChange={(e) => setGerForm(f => ({ ...f, nome: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (login)</label>
                      <input
                        type="text"
                        value={gerForm.username}
                        onChange={(e) => setGerForm(f => ({ ...f, username: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha{gerEditId && <span className="text-gray-400 font-normal"> (deixe em branco para manter)</span>}
                      </label>
                      <input
                        type="password"
                        value={gerForm.senha}
                        onChange={(e) => setGerForm(f => ({ ...f, senha: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required={!gerEditId}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                      <select
                        value={gerForm.cargo}
                        onChange={(e) => setGerForm(f => ({ ...f, cargo: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    {gerEditId && (
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="ger-ativo"
                          checked={gerForm.ativo}
                          onChange={(e) => setGerForm(f => ({ ...f, ativo: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <label htmlFor="ger-ativo" className="text-sm font-medium text-gray-700">Usuário ativo</label>
                      </div>
                    )}
                  </div>

                  {gerError && <p className="text-red-600 text-sm">{gerError}</p>}
                  {gerSucesso && <p className="text-green-600 text-sm">Salvo com sucesso!</p>}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setGerModo('lista')}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={gerSalvando}
                      className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a87] disabled:opacity-50 text-sm"
                    >
                      {gerSalvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer com fechar */}
            {gerModo === 'lista' && (
              <div className="px-6 py-3 border-t flex justify-end">
                <button
                  onClick={() => setShowGerenciar(false)}
                  className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
