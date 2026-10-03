import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { ToastContext } from './toast-context';
import type { TipoToast } from './toast-context';

interface ToastItem { id: number; message: string; tipo: TipoToast; }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tipo: TipoToast = 'sucesso') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-2 rounded-lg bg-mzd-black px-4 py-3 text-sm font-medium text-white shadow-xl"
          >
            {t.tipo === 'erro'
              ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />}
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
              className="ml-2 shrink-0 text-zinc-400 hover:text-white"
              aria-label="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
