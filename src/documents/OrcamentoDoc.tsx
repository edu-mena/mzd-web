import type { ProcessoDetalhado } from '../types';
import DocumentShell, { Field, SectionTitle } from './DocumentShell';
import { formatAOA, formatDate } from '../lib/format';
import { calcularTotais } from '../lib/calculos';

export default function OrcamentoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const o = processo.orcamento;
  if (!o) return <p className="p-6 text-sm text-mzd-gray">Orçamento ainda não emitido.</p>;
  const { cliente, viatura } = processo;
  const totais = calcularTotais(o);

  return (
    <DocumentShell title="Orçamento / Fatura Pró-forma" subtitle={`Válido por ${o.validadeDias} dias`} numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="NIF" value={cliente.nif ?? '—'} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Data de emissão" value={o.enviadoEm ? formatDate(o.enviadoEm) : '—'} />
        <Field label="Validade" value={`${o.validadeDias} dias`} />
        <Field label="Estado" value={{ rascunho: 'Rascunho', enviado: 'Enviado ao cliente', aprovado: 'Aprovado', recusado: 'Recusado' }[o.estado]} />
      </div>

      <SectionTitle>Peças</SectionTitle>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd.</th>
            <th className="py-2 text-right">Preço Unit.</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {o.pecas.map((p, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{p.descricao}</td>
              <td className="py-2 text-right">{p.quantidade}</td>
              <td className="py-2 text-right">{formatAOA(p.precoUnitario)}</td>
              <td className="py-2 text-right font-medium">{formatAOA(p.quantidade * p.precoUnitario)}</td>
            </tr>
          ))}
          {o.pecas.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-mzd-gray">Sem peças</td></tr>}
        </tbody>
      </table>

      <SectionTitle>Mão de Obra</SectionTitle>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Serviço</th>
            <th className="py-2 text-right">Horas</th>
            <th className="py-2 text-right">Valor/Hora</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {o.maoObra.map((m, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{m.descricao}</td>
              <td className="py-2 text-right">{m.horas}h</td>
              <td className="py-2 text-right">{formatAOA(m.valorHora)}</td>
              <td className="py-2 text-right font-medium">{formatAOA(m.horas * m.valorHora)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-mzd-gray">Subtotal Peças</span><span>{formatAOA(totais.pecas)}</span></div>
        <div className="flex justify-between"><span className="text-mzd-gray">Subtotal Mão de Obra</span><span>{formatAOA(totais.maoObra)}</span></div>
        {totais.desconto > 0 && <div className="flex justify-between"><span className="text-mzd-gray">Desconto ({o.desconto!.percentagem}%)</span><span>−{formatAOA(totais.desconto)}</span></div>}
        <div className="flex justify-between"><span className="text-mzd-gray">IVA ({o.taxaIva}%)</span><span>{formatAOA(totais.iva)}</span></div>
        <div className="flex justify-between border-t border-mzd-black pt-1.5 text-base font-extrabold"><span>Total</span><span>{formatAOA(totais.total)}</span></div>
      </div>

      <SectionTitle>Condições de Pagamento</SectionTitle>
      <p className="text-sm text-mzd-gray">{o.condicoesPagamento}</p>
    </DocumentShell>
  );
}
