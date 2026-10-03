import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';

export type TomIndicador = 'neutro' | 'alerta' | 'aviso' | 'ok';

const TOM: Record<TomIndicador, { barra: string; valor: string }> = {
  neutro: { barra: 'bg-transparent', valor: 'text-mzd-black' },
  alerta: { barra: 'bg-mzd-red', valor: 'text-sinal-vermelho' },
  aviso: { barra: 'bg-sinal-ambar', valor: 'text-mzd-black' },
  ok: { barra: 'bg-sinal-verde', valor: 'text-mzd-black' },
};

/**
 * Indicador numérico. Com `to`, o número abre a lista que o explica (ex.: processos atrasados).
 * O tom só muda quando o valor pede atenção — um indicador a zero fica neutro.
 */
export default function StatTile({
  label,
  value,
  hint,
  tom = 'neutro',
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  tom?: TomIndicador;
  to?: string;
}) {
  const t = TOM[tom];
  const conteudo = (
    <>
      <span className={clsx('absolute inset-y-0 left-0 w-[3px]', t.barra)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span className="rotulo">{label}</span>
        {to && <ArrowUpRight size={14} className="shrink-0 text-zinc-400 transition-colors group-hover:text-mzd-black" aria-hidden />}
      </div>
      <p className={clsx('mt-2 font-display text-[28px] font-extrabold leading-none tabular-nums [font-stretch:100%]', t.valor)}>{value}</p>
      {hint && <p className="mt-2 text-xs leading-snug text-mzd-gray">{hint}</p>}
    </>
  );
  const classe = 'group relative block overflow-hidden rounded-lg border border-linha bg-superficie px-4 py-3.5';
  return to ? (
    <Link to={to} className={clsx(classe, 'transition-colors hover:border-linha-forte')}>{conteudo}</Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
