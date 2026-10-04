import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Download } from 'lucide-react';
import clsx from 'clsx';
import type { Comparacao } from '../../types';
import Button from '../../components/ui/Button';
import { formatarIndicador as formatar } from '../../lib/format';
import type { FormatoIndicador as Formato } from '../../lib/format';

/**
 * Indicador com a variação face ao período anterior. A cor diz se a mudança é boa ou má
 * (conforme `melhor`), sempre acompanhada de seta e sinal — nunca só a cor.
 */
export function Indicador({ label, valor, formato, melhor = 'mais', nota }: {
  label: string;
  valor: Comparacao;
  formato: Formato;
  melhor?: 'mais' | 'menos';
  nota?: string;
}) {
  const { atual, anterior } = valor;
  // Percentagens comparam-se em pontos percentuais; o resto em variação relativa. Sem base, não há comparação.
  const delta = atual === null || anterior === null ? null : formato === 'pct' ? atual - anterior : anterior ? ((atual - anterior) / anterior) * 100 : null;
  const mostrar = (v: number | null) => (v === null ? '—' : formatar(v, formato));
  const neutro = delta === null || Math.abs(delta) < 0.5;
  const bom = !neutro && (delta! > 0) === (melhor === 'mais');
  const texto = atual === null
    ? 'sem dados neste período'
    : delta === null
    ? 'sem dados no período anterior'
    : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(Math.round(delta * 10) / 10).toLocaleString('pt-PT')}${formato === 'pct' ? ' p.p.' : '%'} vs anterior`;
  const Seta = delta !== null && delta < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="rounded-lg border border-linha bg-superficie px-4 py-3.5">
      <p className="rotulo">{label}</p>
      <p className="mt-1.5 font-display text-[1.6rem] font-extrabold leading-none tabular-nums text-mzd-black [font-stretch:100%]">{mostrar(atual)}</p>
      <p className={clsx('mt-2 flex items-center gap-1 text-xs', neutro ? 'text-mzd-gray' : bom ? 'text-sinal-verde' : 'text-sinal-vermelho')}>
        {!neutro && <Seta size={13} strokeWidth={2.25} aria-hidden />}
        <span>{texto}</span>
      </p>
      <p className="num mt-0.5 text-[11px] text-zinc-400" title="Período anterior de igual duração">antes: {mostrar(anterior)}</p>
      {nota && <p className="mt-1 text-[11px] text-mzd-gray">{nota}</p>}
    </div>
  );
}

/** Cabeçalho de bloco com exportação para CSV. */
export function Bloco({ titulo, subtitulo, onExportar, children, className }: {
  titulo: string;
  subtitulo?: string;
  onExportar?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('rounded-lg border border-linha bg-superficie', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-linha px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-mzd-black">{titulo}</h3>
          {subtitulo && <p className="mt-0.5 text-xs text-mzd-gray">{subtitulo}</p>}
        </div>
        {onExportar && <Button variante="fantasma" tamanho="sm" icone={<Download size={13} />} onClick={onExportar}>CSV</Button>}
      </div>
      {children}
    </section>
  );
}

/** Barras horizontais simples (uma série, a tinta) para listas ordenadas. */
export function Barras({ itens, formato = 'n' }: { itens: { rotulo: string; valor: number; destaque?: boolean; detalhe?: string }[]; formato?: Formato }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-3 px-5 py-4">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-mzd-black">{i.rotulo}</span>
            <span className="num shrink-0 text-xs text-mzd-gray">{i.detalhe ?? formatar(i.valor, formato)}</span>
          </div>
          <div className="mt-1.5 h-[6px] rounded-[1px] bg-zinc-100" aria-hidden>
            <div className={clsx('h-full rounded-r-[3px]', i.destaque ? 'bg-mzd-red' : 'bg-mzd-black')} style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
