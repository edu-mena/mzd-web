import { Search, Bell, ChevronDown, Menu } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientes, viaturas, processos, utilizadores } from '../../data/mock';
import { PERFIL_LABEL } from '../../types';
import { useUser } from '../../context/UserContext';

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  const results = query.length > 1
    ? [
        ...processos.filter((p) => p.numero.toLowerCase().includes(query.toLowerCase())).map((p) => ({ type: 'Processo', label: p.numero, to: `/processos/${p.id}` })),
        ...viaturas.filter((v) => v.matricula.toLowerCase().includes(query.toLowerCase())).map((v) => ({ type: 'Viatura', label: `${v.matricula} · ${v.marca} ${v.modelo}`, to: `/viaturas/${v.id}` })),
        ...clientes.filter((c) => c.nome.toLowerCase().includes(query.toLowerCase())).map((c) => ({ type: 'Cliente', label: c.nome, to: `/clientes/${c.id}` })),
      ].slice(0, 8)
    : [];

  return (
    <header className="no-print flex h-16 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 sm:gap-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="-ml-1 shrink-0 rounded-lg p-2 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      <div className="relative w-full min-w-0 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Pesquisar matrícula, cliente ou nº de processo…"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-mzd-red focus:bg-white focus:ring-1 focus:ring-mzd-red"
        />
        {open && results.length > 0 && (
          <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
            {results.map((r, i) => (
              <button
                key={i}
                onMouseDown={() => { navigate(r.to); setQuery(''); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50"
              >
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-mzd-gray">{r.type}</span>
                <span className="truncate font-medium text-mzd-black">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <button className="relative rounded-lg p-2 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-mzd-red" />
        </button>

        <div className="relative">
          <button
            onClick={() => setUserMenu((o) => !o)}
            onBlur={() => setTimeout(() => setUserMenu(false), 150)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1.5 hover:bg-zinc-100 sm:pr-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mzd-black text-xs font-bold text-white">
              {user.avatarIniciais}
            </span>
            <span className="hidden text-left sm:block">
              <p className="text-xs font-bold leading-tight text-mzd-black">{user.nome}</p>
              <p className="text-[11px] leading-tight text-mzd-gray">{PERFIL_LABEL[user.perfil]}</p>
            </span>
            <ChevronDown size={14} className="hidden text-mzd-gray sm:block" />
          </button>
          {userMenu && (
            <div className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
              <p className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold uppercase text-mzd-gray">Ver como (demo)</p>
              {utilizadores.map((u) => (
                <button
                  key={u.id}
                  onMouseDown={() => setUser(u)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-mzd-black">{u.avatarIniciais}</span>
                  <span>
                    <p className="font-medium leading-tight text-mzd-black">{u.nome}</p>
                    <p className="text-[11px] leading-tight text-mzd-gray">{PERFIL_LABEL[u.perfil]}</p>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
