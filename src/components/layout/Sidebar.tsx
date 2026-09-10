import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Car, Users, Wrench, CalendarDays, Package, CreditCard,
  BarChart3, UsersRound, Settings, HelpCircle, ChevronsLeft, ChevronsRight, X,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { processos } from '../../data/mock';
import iconMzd from '../../assets/icon.png';

const primary = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/processos', label: 'Processos', icon: Car, badgeAtivos: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/viaturas', label: 'Viaturas', icon: Wrench },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/pecas', label: 'Peças & Stock', icon: Package },
  { to: '/faturacao', label: 'Faturação', icon: CreditCard },
];

const secondary = [
  { to: '/relatorios', label: 'Relatórios & KPIs', icon: BarChart3 },
  { to: '/equipa', label: 'Equipa', icon: UsersRound },
];

const footerLinks = [
  { to: '/definicoes', label: 'Definições', icon: Settings },
  { to: '/ajuda', label: 'Ajuda / Suporte', icon: HelpCircle },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const ativos = processos.filter((p) => p.estado !== 'entregue').length;

  // Recolher só se aplica em ecrã grande; na gaveta móvel mostra-se sempre expandida.
  const compact = collapsed && !mobileOpen;

  return (
    <>
      {/* Fundo escurecido — apenas em ecrã pequeno com a gaveta aberta */}
      <div
        className={clsx(
          'no-print fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={clsx(
          'no-print fixed inset-y-0 left-0 z-50 flex h-[100dvh] shrink-0 flex-col bg-mzd-black text-white transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          compact ? 'w-64 lg:w-[72px]' : 'w-64'
        )}
      >
        <div className="flex items-center gap-2.5 px-4 py-5">
          <img
            src={iconMzd}
            alt="MZD"
            className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
          />
          {!compact && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold tracking-tight">GRUPO MZD</p>
              <p className="truncate text-[10px] font-medium text-zinc-400">Carros e Motores</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <NavSection items={primary} compact={compact} ativos={ativos} onNavigate={onClose} />
          {!compact && <p className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gestão</p>}
          {compact && <div className="my-3 border-t border-white/10" />}
          <NavSection items={secondary} compact={compact} onNavigate={onClose} />
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <NavSection items={footerLinks} compact={compact} onNavigate={onClose} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-1 hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white lg:flex"
          >
            {compact ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!compact && 'Recolher'}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({
  items,
  compact,
  ativos,
  onNavigate,
}: {
  items: { to: string; label: string; icon: any; end?: boolean; badgeAtivos?: boolean }[];
  compact: boolean;
  ativos?: number;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, end, badgeAtivos }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            title={compact ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-mzd-red text-white' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!compact && <span className="truncate">{label}</span>}
            {!compact && badgeAtivos && ativos ? (
              <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">{ativos}</span>
            ) : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
