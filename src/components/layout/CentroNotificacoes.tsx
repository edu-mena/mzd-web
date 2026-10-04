import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { useMarcarNotificacoes, useNotificacoes } from '../../api/hooks';
import type { Notificacao } from '../../types';
import { haQuanto } from '../../lib/datas';

/** Avisos internos para a equipa (viatura atribuída, desconto para aprovar, peças chegaram, ...). */
export default function CentroNotificacoes() {
  const { data: notificacoes = [] } = useNotificacoes();
  const marcar = useMarcarNotificacoes();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const caixa = useRef<HTMLDivElement>(null);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  function abrir(n: Notificacao) {
    if (!n.lida) marcar.mutate([n.id]);
    setAberto(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => { setAgora(Date.now()); setAberto((v) => !v); }}
        aria-label={naoLidas ? `Notificações (${naoLidas} por ler)` : 'Notificações'}
        aria-expanded={aberto}
        className="relative rounded-lg p-2 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black"
      >
        <Bell size={19} strokeWidth={1.75} />
        {naoLidas > 0 && (
          <span className="num absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-superficie bg-mzd-red px-1 text-[9.5px] font-bold leading-none text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-lg border border-linha bg-white shadow-flutuante sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[23rem]"
        >
          <div className="flex items-center justify-between border-b border-linha px-4 py-2.5">
            <p className="text-[13px] font-bold text-mzd-black">Notificações</p>
            {naoLidas > 0 && (
              <button type="button" onClick={() => marcar.mutate(undefined)} className="flex items-center gap-1 text-xs font-semibold text-mzd-gray hover:text-mzd-black">
                <CheckCheck size={13} /> Marcar todas como lidas
              </button>
            )}
          </div>
          {notificacoes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-mzd-gray">Sem notificações.</p>
          ) : (
            <ul className="max-h-[min(28rem,70dvh)] divide-y divide-linha/70 overflow-y-auto">
              {notificacoes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => abrir(n)} className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-zinc-50', n.lida && 'opacity-70')}>
                    <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.lida ? 'bg-transparent' : 'bg-mzd-red')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block text-[13px] text-mzd-black', !n.lida && 'font-semibold')}>{n.titulo}</span>
                      <span className="block truncate text-xs text-mzd-gray">{n.texto}</span>
                      <span className="num mt-0.5 block text-[11px] text-mzd-gray">{haQuanto(n.data, agora)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
