import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogo } from './useDialogo';

/**
 * Painel lateral para formulários longos (diagnóstico, orçamento, controlo de qualidade).
 * Ocupa o ecrã inteiro em telemóvel e tablet em retrato.
 */
export default function Drawer({
  open,
  onClose,
  titulo,
  subtitulo,
  children,
  rodape,
  largura = 'md',
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: 'md' | 'lg';
}) {
  const tituloId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useDialogo(open, onClose, caixa);

  if (!open) return null;
  // Portal para o <body>: o diálogo nunca fica preso dentro de um contentor com overflow ou transform.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-mzd-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-[100dvh] w-full ${largura === 'lg' ? 'md:max-w-3xl' : 'md:max-w-xl'} flex-col border-l border-linha bg-papel shadow-flutuante outline-none [animation:entrada-lado_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-linha bg-superficie px-5 py-4">
          <div className="min-w-0">
            <h2 id={tituloId} className="text-lg font-extrabold text-mzd-black">{titulo}</h2>
            {subtitulo && <div className="mt-0.5 text-[13px] text-mzd-gray">{subtitulo}</div>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-linha bg-superficie px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
