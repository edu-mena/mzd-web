import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { ToastProvider } from './components/ui/Toast';
import AuthProvider from './auth/AuthProvider';
import { RequireAuth, RequirePermission } from './auth/guards';
import { EcraCarregamento } from './components/ui/Estados';
import type { Permissao } from './auth/permissions';

// Cada página é carregada só quando é aberta, para o primeiro carregamento ser rápido.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Processos = lazy(() => import('./pages/Processos'));
const ProcessoDetail = lazy(() => import('./pages/ProcessoDetail'));
const NovoProcesso = lazy(() => import('./pages/NovoProcesso'));
const Clientes = lazy(() => import('./pages/Clientes'));
const ClienteDetail = lazy(() => import('./pages/ClienteDetail'));
const Viaturas = lazy(() => import('./pages/Viaturas'));
const ViaturaDetail = lazy(() => import('./pages/ViaturaDetail'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Oficina = lazy(() => import('./pages/Oficina'));
const Pecas = lazy(() => import('./pages/Pecas'));
const Faturacao = lazy(() => import('./pages/Faturacao'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Equipa = lazy(() => import('./pages/Equipa'));
const Definicoes = lazy(() => import('./pages/Definicoes'));
const Ajuda = lazy(() => import('./pages/Ajuda'));
const NaoEncontrada = lazy(() => import('./pages/NaoEncontrada'));

const protegida = (permissao: Permissao, pagina: ReactNode) => (
  <RequirePermission permissao={permissao}>{pagina}</RequirePermission>
);

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<EcraCarregamento />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={protegida('painel.ver', <Dashboard />)} />
                <Route path="/processos" element={protegida('processos.ver', <Processos />)} />
                <Route path="/processos/novo" element={protegida('processos.criar', <NovoProcesso />)} />
                <Route path="/processos/:id" element={protegida('processos.ver', <ProcessoDetail />)} />
                <Route path="/clientes" element={protegida('clientes.ver', <Clientes />)} />
                <Route path="/clientes/:id" element={protegida('clientes.ver', <ClienteDetail />)} />
                <Route path="/viaturas" element={protegida('viaturas.ver', <Viaturas />)} />
                <Route path="/viaturas/:id" element={protegida('viaturas.ver', <ViaturaDetail />)} />
                <Route path="/oficina" element={protegida('processos.atribuir', <Oficina />)} />
                <Route path="/agenda" element={protegida('agenda.ver', <Agenda />)} />
                <Route path="/pecas" element={protegida('pecas.ver', <Pecas />)} />
                <Route path="/faturacao" element={protegida('faturacao.ver', <Faturacao />)} />
                <Route path="/relatorios" element={protegida('relatorios.ver', <Relatorios />)} />
                <Route path="/equipa" element={protegida('equipa.ver', <Equipa />)} />
                <Route path="/definicoes" element={protegida('definicoes.gerir', <Definicoes />)} />
                <Route path="/ajuda" element={<Ajuda />} />
                <Route path="*" element={<NaoEncontrada />} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
