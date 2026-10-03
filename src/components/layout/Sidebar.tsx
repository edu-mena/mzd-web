import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Car, CarFront, Users, Wrench, CalendarDays, Package, CreditCard,
  BarChart3, UsersRound, Settings, HelpCircle, ChevronsLeft, ChevronsRight, X, MessagesSquare,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { usePendentesComunicacao, useProcessos } from '../../api/hooks';
import { useAuth } from '../../auth/useAuth';
import type { Permissao } from '../../auth/permissions';
import { estaAtivo } from '../../types';
import iconMzd from '../../assets/icon.png';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permissao?: Permissao;
  end?: boolean;
  /** Contador ao lado do nome: processos em curso ou clientes por avisar. */
  contador?: 'ativos' | 'avisar';
}

const primary: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, permissao: 'painel.ver', end: true },
  { to: '/processos', label: 'Processos', icon: Car, permissao: 'processos.ver', contador: 'ativos' },
  { to: '/oficina', label: 'Oficina', icon: Wrench, permissao: 'processos.atribuir' },
  { to: '/clientes', label: 'Clientes', icon: Users, permissao: 'clientes.ver' },
  { to: '/viaturas', label: 'Viaturas', icon: CarFront, permissao: 'viaturas.ver' },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, permissao: 'agenda.ver' },
  { to: '/pecas', label: 'Peças & Stock', icon: Package, permissao: 'pecas.ver' },
  { to: '/comunicacoes', label: 'Comunicações', icon: MessagesSquare, permissao: 'mensagens.enviar', contador: 'avisar' },
  { to: '/faturacao', label: 'Financeiro', icon: CreditCard, permissao: 'faturacao.ver' },
];

const secondary: NavItem[] = [
  { to: '/relatorios', label: 'Relatórios & KPIs', icon: BarChart3, permissao: 'relatorios.ver' },
  { to: '/equipa', label: 'Equipa', icon: UsersRound, permissao: 'equipa.ver' },
];

const footerLinks: NavItem[] = [
  { to: '/definicoes', label: 'Definições', icon: Settings, permissao: 'definicoes.gerir' },
  { to: '/ajuda', label: 'Ajuda / Suporte', icon: HelpCircle },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { can } = useAuth();
  const { data: processos } = useProcessos();
  const { data: pendentes } = usePendentesComunicacao({ enabled: can('mensagens.enviar') });
  const contadores = { ativos: processos?.filter((p) => estaAtivo(p.estado)).length, avisar: pendentes?.length };
  const visiveis = (items: NavItem[]) => items.filter((i) => !i.permissao || can(i.permissao));
  const gestao = visiveis(secondary);

  // Recolher só se aplica em ecrã grande; na gaveta móvel mostra-se sempre expandida.
  const compact = collapsed && !mobileOpen;

  return (
    <>
      {/* Fundo escurecido — apenas em ecrã pequeno com a gaveta aberta */}
      <div
        className={clsx(
          'no-print fixed inset-0 z-40 bg-mzd-black/40 transition-opacity lg:hidden',
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
          compact ? 'w-64 lg:w-[68px]' : 'w-60'
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
          <img
            src={iconMzd}
            alt="MZD"
            className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5"
          />
          {!compact && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-[13px] font-extrabold tracking-wide [font-stretch:120%]">MZD</p>
              <p className="truncate text-[10.5px] font-medium text-zinc-400">Carros e Motores · Oficina</p>
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
          <NavSection items={visiveis(primary)} compact={compact} contadores={contadores} onNavigate={onClose} />
          {gestao.length > 0 && (
            <>
              {!compact && <p className="rotulo mb-1.5 mt-6 px-3 !text-zinc-500">Gestão</p>}
              {compact && <div className="my-3 border-t border-white/10" />}
              <NavSection items={gestao} compact={compact} onNavigate={onClose} />
            </>
          )}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <NavSection items={visiveis(footerLinks)} compact={compact} onNavigate={onClose} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-1 hidden w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white lg:flex"
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
  contadores,
  onNavigate,
}: {
  items: NavItem[];
  compact: boolean;
  contadores?: Partial<Record<NonNullable<NavItem['contador']>, number>>;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, end, contador }) => {
        const n = contador ? contadores?.[contador] : undefined;
        return (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            title={compact ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-white/[0.08] text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-mzd-red'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            {!compact && <span className="truncate">{label}</span>}
            {!compact && n ? (
              <span className={clsx('num ml-auto text-[11px] font-medium', contador === 'avisar' ? 'rounded bg-mzd-red px-1.5 text-white' : 'text-zinc-400')}>{n}</span>
            ) : null}
          </NavLink>
        </li>
        );
      })}
    </ul>
  );
}
