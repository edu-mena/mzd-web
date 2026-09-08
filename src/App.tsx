import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { ToastProvider } from './components/ui/Toast';
import { UserProvider } from './context/UserContext';

import Dashboard from './pages/Dashboard';
import Processos from './pages/Processos';
import ProcessoDetail from './pages/ProcessoDetail';
import Clientes from './pages/Clientes';
import ClienteDetail from './pages/ClienteDetail';
import Viaturas from './pages/Viaturas';
import ViaturaDetail from './pages/ViaturaDetail';
import Agenda from './pages/Agenda';
import Pecas from './pages/Pecas';
import Faturacao from './pages/Faturacao';
import Relatorios from './pages/Relatorios';
import Equipa from './pages/Equipa';
import Definicoes from './pages/Definicoes';
import Ajuda from './pages/Ajuda';

export default function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/processos" element={<Processos />} />
              <Route path="/processos/:id" element={<ProcessoDetail />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetail />} />
              <Route path="/viaturas" element={<Viaturas />} />
              <Route path="/viaturas/:id" element={<ViaturaDetail />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/pecas" element={<Pecas />} />
              <Route path="/faturacao" element={<Faturacao />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/equipa" element={<Equipa />} />
              <Route path="/definicoes" element={<Definicoes />} />
              <Route path="/ajuda" element={<Ajuda />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </UserProvider>
  );
}
