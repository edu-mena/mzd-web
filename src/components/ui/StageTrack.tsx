import clsx from 'clsx';
import type { EstadoProcesso } from '../../types';
import { ESTADOS_ORDEM, ESTADO_LABEL } from '../../types';
import { TOM_ESTADO } from '../../lib/estados';

const COR_ATUAL = {
  curso: 'bg-mzd-black',
  espera: 'bg-sinal-ambar',
  pronto: 'bg-sinal-verde',
  fechado: 'bg-zinc-400',
  cancelado: 'bg-zinc-300',
} as const;

/**
 * Régua de etapas: um segmento por etapa do percurso. As etapas feitas ficam a tinta,
 * a atual na cor do seu estado (ou vermelho se o prazo passou), as restantes vazias.
 */
export default function StageTrack({
  estado,
  estadoAnterior,
  atrasado,
  className,
}: {
  estado: EstadoProcesso;
  /** Para processos cancelados: a etapa onde pararam. */
  estadoAnterior?: EstadoProcesso;
  atrasado?: boolean;
  className?: string;
}) {
  const cancelado = estado === 'cancelado';
  const ref = cancelado ? estadoAnterior ?? 'recepcao' : estado;
  const idx = ESTADOS_ORDEM.indexOf(ref);
  const total = ESTADOS_ORDEM.length;
  const descricao = cancelado
    ? `Cancelado na etapa ${idx + 1} de ${total}`
    : `Etapa ${idx + 1} de ${total}: ${ESTADO_LABEL[estado]}${atrasado ? ' (atrasado)' : ''}`;

  return (
    <div className={clsx('flex items-center gap-[3px]', className)} role="img" aria-label={descricao} title={descricao}>
      {ESTADOS_ORDEM.map((e, i) => (
        <span
          key={e}
          className={clsx(
            'h-[5px] flex-1 rounded-[1px]',
            cancelado
              ? i <= idx ? 'bg-zinc-300' : 'bg-zinc-100'
              : i < idx
                ? 'bg-mzd-black'
                : i === idx
                  ? atrasado && estado !== 'entregue' ? 'bg-mzd-red' : COR_ATUAL[TOM_ESTADO[estado]]
                  : 'bg-zinc-200'
          )}
        />
      ))}
    </div>
  );
}
