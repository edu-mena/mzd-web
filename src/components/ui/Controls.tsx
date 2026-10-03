import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative w-full max-w-sm', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-md border border-linha-forte bg-white pl-9 pr-8 text-sm outline-none placeholder:text-zinc-400 hover:border-zinc-400 focus:border-mzd-black focus:ring-1 focus:ring-mzd-black [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mzd-gray hover:text-mzd-black"
          aria-label="Limpar pesquisa"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Alternador de opções (ex.: Quadro / Lista). */
export function Segmented<T extends string>({
  value,
  onChange,
  opcoes,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string; icone?: ReactNode }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-linha-forte bg-white p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={value === o.valor}
          className={clsx(
            'flex h-8 items-center gap-1.5 rounded-[4px] px-3 text-xs font-semibold transition-colors',
            value === o.valor ? 'bg-mzd-black text-white' : 'text-mzd-gray hover:text-mzd-black'
          )}
        >
          {o.icone}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Aviso em linha (ex.: stock baixo, cliente sem consentimento). */
export function Aviso({ tom = 'ambar', children, icone }: { tom?: 'ambar' | 'vermelho' | 'neutro'; children: ReactNode; icone?: ReactNode }) {
  return (
    <div
      role={tom === 'vermelho' ? 'alert' : undefined}
      className={clsx(
        'flex items-start gap-2.5 rounded-md border-l-[3px] px-3.5 py-2.5 text-sm',
        tom === 'ambar' && 'border-sinal-ambar bg-sinal-ambar-fundo text-sinal-ambar',
        tom === 'vermelho' && 'border-mzd-red bg-sinal-vermelho-fundo text-sinal-vermelho',
        tom === 'neutro' && 'border-zinc-400 bg-zinc-100 text-mzd-black'
      )}
    >
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
