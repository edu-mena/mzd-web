import { lazy } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from './useAuth';
import type { Permissao } from './permissions';
import { EcraCarregamento } from '../components/ui/Estados';

const Site = lazy(() => import('../pages/Site'));

/**
 * Só deixa passar utilizadores com sessão iniciada. Sem sessão, a página inicial é o site público
 * e as restantes levam ao login (voltando depois à página pedida).
 */
export function RequireAuth() {
  const { user, carregando } = useAuth();
  const location = useLocation();
  if (carregando) return <EcraCarregamento />;
  if (!user && location.pathname === '/') return <Site />;
  if (!user) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />;
  // Palavra-passe temporária: nada mais funciona até ser trocada (o servidor também o garante).
  if (user.mudarSenha && location.pathname !== '/alterar-senha') return <Navigate to="/alterar-senha" replace />;
  return <Outlet />;
}

/** Protege uma página por permissão. */
export function RequirePermission({ permissao, children }: { permissao: Permissao; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permissao)) return <SemAcesso />;
  return <>{children}</>;
}

export function SemAcesso() {
  return (
    <div className="pagina mx-auto max-w-md py-20 text-center">
      <ShieldOff size={26} strokeWidth={1.75} className="mx-auto text-mzd-gray" />
      <h1 className="mt-3 text-xl font-extrabold text-mzd-black">Sem acesso a esta área</h1>
      <p className="mt-1 text-sm text-mzd-gray">
        O seu perfil não tem permissão para ver esta página. Se precisar de acesso, fale com a Direção ou com o administrador do sistema.
      </p>
    </div>
  );
}
