import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('canal_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('canal_user');
      }
    }
    setLoading(false);

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const login = async (username, senha) => {
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('username', username)
        .eq('senha_hash', senha)
        .eq('ativo', true)
        .single();

      if (error || !data) {
        return { success: false, error: 'Usuário ou senha inválidos' };
      }

      setUser(data);
      localStorage.setItem('canal_user', JSON.stringify(data));
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('canal_user');
  };

  const alterarSenha = async (senhaAtual, novaSenha) => {
    if (!user) return { success: false, error: 'Não autenticado' };
    try {
      const { data: check } = await supabase
        .from('vendedores')
        .select('id')
        .eq('id', user.id)
        .eq('senha_hash', senhaAtual)
        .single();

      if (!check) return { success: false, error: 'Senha atual incorreta' };

      const { error } = await supabase
        .from('vendedores')
        .update({ senha_hash: novaSenha, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao alterar senha' };
    }
  };

  // Vendedor só vê a si mesmo; coordenador vê sua loja; gerente/proprietario veem tudo
  const nivelUsuario = () => user?.cargo || user?.nivel || '';

  const podeVerTodos = () => {
    if (!user) return false;
    const n = nivelUsuario();
    return n === 'gerente' || n === 'proprietario';
  };

  const podeVerLoja = () => {
    if (!user) return false;
    return nivelUsuario() === 'coordenador' || podeVerTodos();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, alterarSenha, podeVerTodos, podeVerLoja }}>
      {children}
    </AuthContext.Provider>
  );
}
