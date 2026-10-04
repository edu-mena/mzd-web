import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// Últimos elementos focados: um campo com autofoco dentro do diálogo apanha o foco antes de o diálogo
// saber quem o abriu, por isso guarda-se um pequeno histórico para devolver o foco ao sítio certo.
const historico: HTMLElement[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    historico.unshift(e.target);
    historico.length = Math.min(historico.length, 8);
  });
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento acessível comum a modais e gavetas: fecha com Esc, mantém o foco dentro,
 * bloqueia o scroll da página por trás e devolve o foco ao elemento anterior ao fechar.
 */
export function useDialogo(open: boolean, onClose: () => void, caixa: RefObject<HTMLElement | null>) {
  const fechar = useRef(onClose);
  useEffect(() => {
    fechar.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const el = caixa.current;
    const anterior = el?.contains(document.activeElement)
      ? historico.find((x) => x.isConnected && !el.contains(x)) ?? null
      : (document.activeElement as HTMLElement | null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>('[autofocus], input, select, textarea') ?? el).focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar.current();
        return;
      }
      if (e.key !== 'Tab' || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.offsetParent !== null);
      if (itens.length === 0) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [open, caixa]);
}
