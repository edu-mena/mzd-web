import clsx from 'clsx';
import type { EstadoProcesso } from '../../types';
import { ESTADO_LABEL } from '../../types';
import { TOM_ESTADO } from '../../lib/estados';
import type { TomEstado } from '../../lib/estados';

const ESTILO: Record<TomEstado, { chip: string; marca: string }> = {
  curso: { chip: 'bg-zinc-100 text-mzd-black', marca: 'bg-mzd-black' },
  espera: { chip: 'bg-sinal-ambar-fundo text-sinal-ambar', marca: 'bg-sinal-ambar' },
  pronto: { chip: 'bg-sinal-verde-fundo text-sinal-verde', marca: 'bg-sinal-verde' },
  fechado: { chip: 'text-mzd-gray ring-1 ring-inset ring-linha', marca: 'bg-zinc-400' },
  cancelado: { chip: 'text-mzd-gray line-through decoration-zinc-400 ring-1 ring-inset ring-linha', marca: 'bg-zinc-300' },
};

export default function StatusBadge({ estado, className }: { estado: EstadoProcesso; className?: string }) {
  const e = ESTILO[TOM_ESTADO[estado]];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-[3px] text-[11.5px] font-semibold',
        e.chip,
        className
      )}
    >
      <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-[1px]', e.marca)} aria-hidden />
      {ESTADO_LABEL[estado]}
    </span>
  );
}
