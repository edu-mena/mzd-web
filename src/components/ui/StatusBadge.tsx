import type { EstadoProcesso } from '../../types';
import { ESTADO_LABEL } from '../../types';
import clsx from 'clsx';

const ESTADO_STYLE: Record<EstadoProcesso, string> = {
  recepcao: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  diagnostico: 'bg-blue-50 text-blue-700 ring-blue-200',
  aguarda_aprovacao_diagnostico: 'bg-amber-50 text-amber-700 ring-amber-200',
  orcamento_emitido: 'bg-violet-50 text-violet-700 ring-violet-200',
  aguarda_autorizacao: 'bg-amber-50 text-amber-700 ring-amber-200',
  em_reparacao: 'bg-sky-50 text-sky-700 ring-sky-200',
  controlo_qualidade: 'bg-orange-50 text-orange-700 ring-orange-200',
  pronta_entrega: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  entregue: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
};

export default function StatusBadge({ estado, className }: { estado: EstadoProcesso; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        ESTADO_STYLE[estado],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ESTADO_LABEL[estado]}
    </span>
  );
}
