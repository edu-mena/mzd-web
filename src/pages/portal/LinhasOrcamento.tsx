import { formatAOA } from '../../lib/format';
import { totalDe } from '../../lib/portal';
import type { LinhasPortal } from '../../lib/portal';

/** Linhas de um orçamento como o cliente as lê: o que se faz e quanto custa, sem jargão interno. */
export default function LinhasOrcamento({ orcamento: o }: { orcamento: LinhasPortal }) {
  const t = totalDe(o);
  const linha = (descricao: string, detalhe: string, valor: number, k: string) => (
    <li key={k} className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[14px] text-mzd-black">{descricao}</span>
        <span className="num block text-[11.5px] text-mzd-gray">{detalhe}</span>
      </span>
      <span className="num shrink-0 text-[13.5px] text-mzd-black">{formatAOA(valor)}</span>
    </li>
  );
  return (
    <div>
      {o.pecas.length > 0 && (
        <>
          <p className="rotulo mt-1">Peças</p>
          <ul className="divide-y divide-linha/70">
            {o.pecas.map((p, i) => linha(p.descricao, `${p.quantidade} × ${formatAOA(p.precoUnitario)}`, p.quantidade * p.precoUnitario, `p${i}`))}
          </ul>
        </>
      )}
      {o.maoObra.length > 0 && (
        <>
          <p className="rotulo mt-4">Mão de obra</p>
          <ul className="divide-y divide-linha/70">
            {o.maoObra.map((m, i) => linha(m.descricao, `${m.horas} h × ${formatAOA(m.valorHora)}`, m.horas * m.valorHora, `m${i}`))}
          </ul>
        </>
      )}
      <dl className="mt-3 space-y-1 border-t border-mzd-black pt-3 text-[13px]">
        {t.desconto > 0 && (
          <div className="flex justify-between text-sinal-verde"><dt>Desconto ({o.descontoPct}%)</dt><dd className="num">−{formatAOA(t.desconto)}</dd></div>
        )}
        <div className="flex justify-between text-mzd-gray"><dt>Subtotal</dt><dd className="num">{formatAOA(t.subtotal)}</dd></div>
        <div className="flex justify-between text-mzd-gray"><dt>{o.isencaoIva ? 'IVA (isento)' : `IVA (${o.taxaIva}%)`}</dt><dd className="num">{formatAOA(t.iva)}</dd></div>
        <div className="flex items-baseline justify-between pt-1">
          <dt className="font-display text-[15px] font-extrabold text-mzd-black">Total</dt>
          <dd className="font-display text-xl font-extrabold text-mzd-black">{formatAOA(t.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
