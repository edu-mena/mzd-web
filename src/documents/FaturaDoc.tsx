import type { Processo } from '../types';
import { getCliente, getViatura } from '../data/mock';
import DocumentShell, { Field, SectionTitle } from './DocumentShell';
import { formatAOA, formatDate, orcamentoTotal } from '../lib/format';

const PAGAMENTO_LABEL: Record<string, string> = { numerario: 'Numerário', transferencia: 'Transferência Bancária', tpa: 'TPA', multicaixa: 'Multicaixa Express' };

export default function FaturaDoc({ processo }: { processo: Processo }) {
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const fat = processo.fatura;
  const total = fat?.valorTotal ?? orcamentoTotal(processo.orcamento);

  return (
    <DocumentShell title="Fatura / Recibo" numero={fat?.numero ?? processo.numero}>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="NIF" value={cliente.nif} />
        <Field label="Data" value={fat ? formatDate(fat.data) : '—'} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Forma de pagamento" value={fat ? PAGAMENTO_LABEL[fat.formaPagamento] : '—'} />
        <Field label="Estado" value={fat?.pago ? 'Pago' : 'Saldo em aberto'} />
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg bg-zinc-50 p-4">
        <span className="text-sm font-semibold text-mzd-gray">Valor Total</span>
        <span className="text-xl font-extrabold text-mzd-black">{formatAOA(total)}</span>
      </div>

      <SectionTitle>Termo de Garantia</SectionTitle>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Item</th>
            <th className="py-2">Tipo</th>
            <th className="py-2 text-right">Prazo de Garantia</th>
          </tr>
        </thead>
        <tbody>
          {(processo.garantias ?? []).map((g, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{g.item}</td>
              <td className="py-2 text-mzd-gray">{g.tipo === 'peca' ? 'Peças' : 'Mão de Obra'}</td>
              <td className="py-2 text-right font-medium">{g.prazoMeses} meses</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-mzd-gray">
        A garantia é invalidada em caso de intervenção por terceiros não autorizados, uso indevido ou negligência. Para acionar a
        garantia, contacte a MZD Carros e Motores através do número +244 923 000 000 ou geral@mzdcarros.ao, apresentando este documento.
      </p>
    </DocumentShell>
  );
}
