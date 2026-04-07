import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PortfolioProvider } from './context/PortfolioContext';
import Header from './components/Header';
import Login from './pages/Login';
import Mapa from './pages/Mapa';
import EmConstrucao from './pages/EmConstrucao';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Carregando...
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <ScrollToTop />
      <Header />
      <main className="flex-1 overflow-auto" id="main-scroll">
        <Routes>
          <Route path="/"      element={<Navigate to="/mapa" replace />} />
          <Route path="/mapa"  element={<Mapa />} />
          <Route path="/metas" element={<EmConstrucao titulo="Metas" />} />
          <Route path="/bonus" element={<EmConstrucao titulo="Bônus" />} />
          <Route path="*"      element={<Navigate to="/mapa" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortfolioProvider>
          <AppRoutes />
        </PortfolioProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
