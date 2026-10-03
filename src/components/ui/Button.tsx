import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { botao } from './botao';
import type { TamanhoBotao, VarianteBotao } from './botao';

export default function Button({
  variante = 'primario',
  tamanho = 'md',
  carregando,
  icone,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
  icone?: ReactNode;
}) {
  return (
    <button type={type} disabled={disabled || carregando} className={botao(variante, tamanho, className)} {...rest}>
      {carregando ? <Loader2 size={tamanho === 'sm' ? 13 : 15} className="animate-spin" /> : icone}
      {children}
    </button>
  );
}
