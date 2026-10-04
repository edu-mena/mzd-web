import { Search, ChevronDown, Menu, LogOut, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_MODE } from '../../api/client';
import { PERFIL_LABEL } from '../../types';
import { useAuth } from '../../auth/useAuth';
import PaletaComandos from './PaletaComandos';
import CentroNotificacoes from './CentroNotificacoes';

const ehMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [paleta, setPaleta] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const botaoMenu = useRef<HTMLButtonElement>(null);

  // Menu do utilizador: fecha com Escape (devolvendo o foco ao botão) ou com um clique fora; setas mudam de opção.
  useEffect(() => {
    if (!userMenu) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: MouseEvent) => { if (!menu.current?.parentElement?.contains(e.target as Node)) setUserMenu(false); };
    const tecla = (e: KeyboardEvent) => {
      const itens = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = itens.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') { setUserMenu(false); botaoMenu.current?.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); itens[(i + 1) % itens.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); itens[(i - 1 + itens.length) % itens.length]?.focus(); }
      else if (e.key === 'Tab') setUserMenu(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [userMenu]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Ctrl+K / ⌘K abre a pesquisa global em qualquer página; "/" também, se não estiver a escrever.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const aEscrever = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaleta((v) => !v);
      } else if (e.key === '/' && !aEscrever) {
        e.preventDefault();
        setPaleta(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;

  return (
    <header className="no-print flex h-16 shrink-0 items-center gap-2 border-b border-linha bg-superficie px-4 sm:gap-4 sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="-ml-1 shrink-0 rounded-lg p-2 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        onClick={() => setPaleta(true)}
        aria-label="Pesquisa global"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-10 w-full min-w-0 max-w-md items-center gap-2.5 rounded-md border border-linha bg-papel/60 px-3 text-left text-sm text-mzd-gray transition hover:border-linha-forte"
      >
        <Search size={16} className="shrink-0 text-mzd-gray" />
        <span className="flex-1 truncate">Pesquisar matrícula, cliente ou nº de processo…</span>
        <kbd className="num hidden shrink-0 rounded border border-linha bg-white px-1.5 py-0.5 text-[10.5px] text-mzd-gray sm:inline">{ehMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        {API_MODE === 'mock' && (
          <span className="rotulo hidden rounded border border-dashed border-sinal-ambar px-2 py-1 !text-sinal-ambar md:inline" title="Os dados ficam guardados apenas neste navegador">
            Demonstração
          </span>
        )}

        <CentroNotificacoes />

        <div className="relative">
          <button
            ref={botaoMenu}
            onClick={() => setUserMenu((o) => !o)}
            aria-label={`Conta de ${user.nome}`}
            aria-haspopup="menu"
            aria-expanded={userMenu}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1.5 hover:bg-zinc-100 sm:pr-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mzd-black font-display text-[11px] font-bold text-white">
              {user.avatarIniciais}
            </span>
            <span className="hidden text-left sm:block">
              <p className="text-xs font-bold leading-tight text-mzd-black">{user.nome}</p>
              <p className="text-[11px] leading-tight text-mzd-gray">{PERFIL_LABEL[user.perfil]}</p>
            </span>
            <ChevronDown size={14} className="hidden text-mzd-gray sm:block" />
          </button>
          {userMenu && (
            <div ref={menu} role="menu" aria-label="Conta" className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-lg border border-linha bg-white shadow-flutuante">
              <div className="border-b border-zinc-100 px-3 py-2.5">
                <p className="text-sm font-semibold text-mzd-black">{user.nome}</p>
                <p className="truncate text-xs text-mzd-gray">{user.email}</p>
              </div>
              <button
                role="menuitem"
                onClick={() => { setUserMenu(false); navigate('/alterar-senha'); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-mzd-black hover:bg-zinc-50"
              >
                <KeyRound size={15} /> Alterar palavra-passe
              </button>
              <button
                role="menuitem"
                onClick={async () => { setUserMenu(false); await logout(); navigate('/login', { replace: true }); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-mzd-black hover:bg-zinc-50"
              >
                <LogOut size={15} /> Terminar sessão
              </button>
            </div>
          )}
        </div>
      </div>

      <PaletaComandos open={paleta} onClose={() => setPaleta(false)} />
    </header>
  );
}
