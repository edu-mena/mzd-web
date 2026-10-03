import clsx from 'clsx';

export type VarianteBotao = 'primario' | 'perigo' | 'secundario' | 'fantasma';
export type TamanhoBotao = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

const VARIANTES: Record<VarianteBotao, string> = {
  // Ação principal em tinta; o vermelho fica reservado para sinais e ações destrutivas/críticas.
  primario: 'bg-mzd-black text-white hover:bg-mzd-graphite',
  perigo: 'bg-mzd-red text-white hover:bg-mzd-redDark',
  secundario: 'bg-white text-mzd-black ring-1 ring-inset ring-linha-forte hover:bg-zinc-50 hover:ring-zinc-400',
  fantasma: 'text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black',
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-10 px-4 text-sm',
};

/** Classes de botão, para usar em <button>, <Link> ou <a>. */
export function botao(variante: VarianteBotao = 'primario', tamanho: TamanhoBotao = 'md', extra?: string) {
  return clsx(BASE, VARIANTES[variante], TAMANHOS[tamanho], extra);
}
