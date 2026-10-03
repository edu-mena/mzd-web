import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import clsx from 'clsx';

const CONTROLO =
  'w-full rounded-md border border-linha-forte bg-white px-3 text-sm text-mzd-black outline-none transition-colors ' +
  'placeholder:text-zinc-400 hover:border-zinc-400 focus:border-mzd-black focus:ring-1 focus:ring-mzd-black ' +
  'aria-[invalid=true]:border-sinal-vermelho aria-[invalid=true]:focus:ring-sinal-vermelho disabled:bg-zinc-50 disabled:text-mzd-gray';

/**
 * Campo com rótulo, ajuda e erro. O controlo é passado como função para receber o id
 * e os atributos de acessibilidade corretos.
 */
export function Field({
  label,
  hint,
  erro,
  className,
  children,
}: {
  label: string;
  hint?: string;
  erro?: string;
  className?: string;
  children: (a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = erro || hint ? `${id}-desc` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-mzd-black">{label}</label>
      {children({ id, 'aria-invalid': !!erro, 'aria-describedby': descId })}
      {erro ? (
        <p id={descId} className="mt-1 text-xs text-sinal-vermelho">{erro}</p>
      ) : hint ? (
        <p id={descId} className="mt-1 text-xs text-mzd-gray">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input className={clsx(CONTROLO, 'h-10', className)} {...props} />;
}

/** Por omissão ocupa a largura toda; passe uma classe de largura (ex.: "w-56") para a fixar. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> }) {
  const temLargura = /(^|\s)(sm:|md:)?w-/.test(className ?? '');
  return <select className={clsx(CONTROLO.replace('w-full ', ''), 'h-10 pr-8', !temLargura && 'w-full', className)} {...props} />;
}

/** Grupo de opções em botões (escolha única) — mais rápido que um select em tablets. */
export function Escolha<T extends string>({
  label,
  valor,
  onChange,
  opcoes,
  className,
}: {
  label: string;
  valor: T | undefined;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string; descricao?: string; tom?: 'neutro' | 'ok' | 'aviso' | 'alerta' }[];
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={className}>
      <legend id={id} className="mb-1.5 block text-xs font-semibold text-mzd-black">{label}</legend>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => {
          const ativo = valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onChange(o.valor)}
              className={clsx(
                'min-h-9 rounded-md border px-3 py-1.5 text-left text-[13px] font-semibold transition-colors',
                !ativo && 'border-linha-forte bg-white text-mzd-black hover:border-zinc-400',
                ativo && (!o.tom || o.tom === 'neutro') && 'border-mzd-black bg-mzd-black text-white',
                ativo && o.tom === 'ok' && 'border-sinal-verde bg-sinal-verde text-white',
                ativo && o.tom === 'aviso' && 'border-sinal-ambar bg-sinal-ambar text-white',
                ativo && o.tom === 'alerta' && 'border-mzd-red bg-mzd-red text-white'
              )}
            >
              {o.label}
              {o.descricao && <span className={clsx('block text-[11px] font-normal', ativo ? 'text-white/80' : 'text-mzd-gray')}>{o.descricao}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5 text-[13.5px] text-mzd-black', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-zinc-400 bg-white bg-center bg-no-repeat transition-colors checked:border-mzd-black checked:bg-mzd-black checked:bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M3.5%208.5l3%203%206-7%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%222.2%22/%3E%3C/svg%3E')] disabled:cursor-not-allowed"
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea className={clsx(CONTROLO, 'py-2', className)} {...props} />;
}
