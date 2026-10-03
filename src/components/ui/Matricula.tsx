import clsx from 'clsx';

/** Matrícula desenhada como placa: identifica a viatura de relance em listas e quadros. */
export default function Matricula({ valor, tamanho = 'md', className }: { valor: string; tamanho?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-stretch overflow-hidden rounded-[3px] border-[1.5px] border-mzd-black bg-white align-middle leading-none text-mzd-black',
        className
      )}
    >
      <span
        className={clsx(
          'flex items-center bg-mzd-black font-display font-bold text-white',
          tamanho === 'lg' ? 'px-1.5 text-[9px]' : 'px-1 text-[7px]'
        )}
        aria-hidden
      >
        AO
      </span>
      <span
        className={clsx(
          'num font-semibold uppercase tracking-[0.06em]',
          tamanho === 'sm' && 'px-1.5 py-[3px] text-[11px]',
          tamanho === 'md' && 'px-1.5 py-1 text-[12.5px]',
          tamanho === 'lg' && 'px-2.5 py-1.5 text-lg'
        )}
      >
        {valor}
      </span>
    </span>
  );
}
