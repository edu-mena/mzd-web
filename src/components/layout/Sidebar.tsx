import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Car, Users, Wrench, CalendarDays, Package, CreditCard,
  BarChart3, UsersRound, Settings, HelpCircle, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { processos } from '../../data/mock';

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

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const ativos = processos.filter((p) => p.estado !== 'entregue').length;

  return (
    <aside
      className={clsx(
        'no-print flex h-screen shrink-0 flex-col bg-mzd-black text-white transition-all duration-200',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mzd-red to-mzd-redDark font-black text-white">
          M
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-extrabold tracking-tight">GRUPO MZD</p>
            <p className="truncate text-[10px] font-medium text-zinc-400">Carros e Motores</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <NavSection items={primary} collapsed={collapsed} ativos={ativos} />
        {!collapsed && <p className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gestão</p>}
        {collapsed && <div className="my-3 border-t border-white/10" />}
        <NavSection items={secondary} collapsed={collapsed} />
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <NavSection items={footerLinks} collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && 'Recolher'}
        </button>
      </div>
    </aside>
  );
}

function NavSection({
  items,
  collapsed,
  ativos,
}: {
  items: { to: string; label: string; icon: any; end?: boolean; badgeAtivos?: boolean }[];
  collapsed: boolean;
  ativos?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, end, badgeAtivos }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-mzd-red text-white' : 'text-zinc-300 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && badgeAtivos && ativos ? (
              <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">{ativos}</span>
            ) : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
