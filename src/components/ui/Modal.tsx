import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogo } from './useDialogo';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const tituloId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useDialogo(open, onClose, caixa);

  if (!open) return null;
  // Portal para o <body>: o diálogo nunca fica preso dentro de um contentor com overflow ou transform.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-mzd-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} animate-entrada flex-col rounded-t-xl border border-linha bg-white shadow-flutuante outline-none sm:max-h-[85vh] sm:rounded-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-linha px-5 py-3.5">
          <h3 id={tituloId} className="text-[15px] font-bold text-mzd-black">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-linha bg-zinc-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
