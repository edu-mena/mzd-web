import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Contentor com deslocação horizontal (tabelas largas em telemóvel). Quando o conteúdo não cabe,
 * passa a receber foco, para se poder deslizar com as setas do teclado.
 */
export default function RegiaoRolavel({ children, className, rotulo }: { children: ReactNode; className?: string; rotulo?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [rola, setRola] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setRola(el.scrollWidth > el.clientWidth + 1);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={caixa}
      className={clsx('overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mzd-black', className)}
      tabIndex={rola ? 0 : undefined}
      role={rola ? 'region' : undefined}
      aria-label={rola ? rotulo ?? 'Tabela (deslize para ver mais colunas)' : undefined}
    >
      {children}
    </div>
  );
}
