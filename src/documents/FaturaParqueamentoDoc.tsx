import type { FaturaParqueamento, ProcessoDetalhado } from '../types';
import { FORMA_PAGAMENTO_LABEL, MOTIVO_PARQUEAMENTO_LABEL } from '../types';
import DocumentShell, { CoordenadasPagamento, Field, LinhaIva, NotaIsencao, SectionTitle } from './DocumentShell';
import { formatAOA, formatDate, formatDia } from '../lib/format';
import { saldoEmAberto, valorPago } from '../lib/calculos';

/** Fatura do parqueamento: dias em que a viatura ficou na oficina por demora do cliente. */
export default function FaturaParqueamentoDoc({ processo, fatura: fat }: { processo: ProcessoDetalhado; fatura: FaturaParqueamento }) {
  const { cliente, viatura } = processo;
  const subtotal = fat.periodos.reduce((t, x) => t + x.dias, 0) * fat.valorDia;
  const pago = valorPago(fat);
  const saldo = saldoEmAberto(fat);

  return (
    <DocumentShell title="Fatura — Parqueamento" numero={fat.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="NIF do cliente" value={cliente.nif ?? 'Consumidor final'} />
        <Field label="Data de emissão" value={formatDate(fat.data)} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Processo" value={processo.numero} />
        <Field label="Estado" value={saldo === 0 ? 'Pago' : pago > 0 ? 'Parcialmente pago' : 'Por pagar'} />
      </div>

      <SectionTitle>Parqueamento</SectionTitle>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Motivo</th>
            <th className="py-2">Período</th>
            <th className="py-2 text-right">Dias</th>
            <th className="py-2 text-right">Valor/dia</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {fat.periodos.map((x) => (
            <tr key={`${x.motivo}${x.de}`} className="border-b border-zinc-100">
              <td className="py-2">{MOTIVO_PARQUEAMENTO_LABEL[x.motivo]}</td>
              <td className="num py-2">{formatDia(x.de)} a {formatDia(x.ate)}</td>
              <td className="py-2 text-right">{x.dias}</td>
              <td className="py-2 text-right">{formatAOA(fat.valorDia)}</td>
              <td className="py-2 text-right font-medium">{formatAOA(x.dias * fat.valorDia)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6 ml-auto w-full max-w-72 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-mzd-gray">Total ilíquido</span><span>{formatAOA(subtotal)}</span></div>
        <LinhaIva taxa={fat.taxaIva} isencao={fat.isencaoIva} valor={formatAOA(fat.valorTotal - subtotal)} />
        <div className="flex justify-between border-t border-mzd-black pt-1.5 text-base font-extrabold"><span>Total</span><span>{formatAOA(fat.valorTotal)}</span></div>
        <NotaIsencao isencao={fat.isencaoIva} />
      </div>

      <SectionTitle>Pagamentos</SectionTitle>
      <table className="mb-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Recibo</th>
            <th className="py-2">Data</th>
            <th className="py-2">Forma</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {fat.pagamentos.map((pg) => (
            <tr key={pg.id} className={`border-b border-zinc-100 ${pg.anulado ? 'text-mzd-gray line-through' : ''}`}>
              <td className="num py-2">{pg.numeroRecibo}</td>
              <td className="py-2">{formatDate(pg.data)}</td>
              <td className="py-2">{FORMA_PAGAMENTO_LABEL[pg.forma]}</td>
              <td className="py-2 text-right font-medium">{formatAOA(pg.valor)}</td>
            </tr>
          ))}
          {fat.pagamentos.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-mzd-gray">Sem pagamentos registados.</td></tr>}
        </tbody>
      </table>
      <div className="ml-auto w-full max-w-72 space-y-1 text-sm">
        <div className="flex justify-between font-bold"><span>Saldo em aberto</span><span className={saldo > 0 ? 'text-mzd-red' : ''}>{formatAOA(saldo)}</span></div>
      </div>

      <CoordenadasPagamento referencia={fat.numero} />
      <p className="mt-4 text-xs text-mzd-gray">
        Parqueamento cobrado por dia, conforme as condições do orçamento: depois da validade do orçamento sem resposta e depois do prazo para levantar a viatura pronta.
      </p>
    </DocumentShell>
  );
}
