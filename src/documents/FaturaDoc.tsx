import type { ProcessoDetalhado } from '../types';
import { FORMA_PAGAMENTO_LABEL } from '../types';
import DocumentShell, { Field, SectionTitle } from './DocumentShell';
import { formatAOA, formatDate } from '../lib/format';
import { calcularTotais, saldoEmAberto, valorPago } from '../lib/calculos';
import { useConfiguracao } from '../api/hooks';

export default function FaturaDoc({ processo }: { processo: ProcessoDetalhado }) {
  const { cliente, viatura, fatura: fat, orcamento: o } = processo;
  const { data: config } = useConfiguracao();
  if (!fat || !o) return <p className="p-6 text-sm text-mzd-gray">A fatura é emitida quando a viatura passa o controlo de qualidade.</p>;

  // Linhas faturadas: orçamento aprovado + trabalhos adicionais aprovados.
  const blocos = [o, ...(processo.orcamentosAdicionais ?? []).filter((a) => a.estado === 'aprovado')];
  const pecas = blocos.flatMap((b) => b.pecas);
  const maoObra = blocos.flatMap((b) => b.maoObra);
  const totaisBlocos = blocos.map((b) => calcularTotais(b));
  const totais = {
    desconto: totaisBlocos.reduce((s, t) => s + t.desconto, 0),
    subtotal: totaisBlocos.reduce((s, t) => s + t.subtotal, 0),
    iva: totaisBlocos.reduce((s, t) => s + t.iva, 0),
  };
  const pago = valorPago(fat);
  const saldo = saldoEmAberto(fat);

  return (
    <DocumentShell title="Fatura / Recibo" numero={fat.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="NIF do cliente" value={cliente.nif ?? 'Consumidor final'} />
        <Field label="Data de emissão" value={formatDate(fat.data)} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Processo" value={processo.numero} />
        <Field label="Estado" value={saldo === 0 ? 'Pago' : pago > 0 ? 'Parcialmente pago' : 'Por pagar'} />
      </div>

      <SectionTitle>Descrição</SectionTitle>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd./Horas</th>
            <th className="py-2 text-right">Preço Unit.</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {pecas.map((p, i) => (
            <tr key={`p${i}`} className="border-b border-zinc-100">
              <td className="py-2">{p.descricao}</td>
              <td className="py-2 text-right">{p.quantidade}</td>
              <td className="py-2 text-right">{formatAOA(p.precoUnitario)}</td>
              <td className="py-2 text-right font-medium">{formatAOA(p.quantidade * p.precoUnitario)}</td>
            </tr>
          ))}
          {maoObra.map((m, i) => (
            <tr key={`m${i}`} className="border-b border-zinc-100">
              <td className="py-2">{m.descricao}</td>
              <td className="py-2 text-right">{m.horas}h</td>
              <td className="py-2 text-right">{formatAOA(m.valorHora)}</td>
              <td className="py-2 text-right font-medium">{formatAOA(m.horas * m.valorHora)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6 ml-auto w-full max-w-72 space-y-1 text-sm">
        {totais.desconto > 0 && (
          <>
            <div className="flex justify-between"><span className="text-mzd-gray">Valor bruto</span><span>{formatAOA(totais.subtotal + totais.desconto)}</span></div>
            <div className="flex justify-between"><span className="text-mzd-gray">Desconto ({o.desconto!.percentagem}%)</span><span>−{formatAOA(totais.desconto)}</span></div>
          </>
        )}
        <div className="flex justify-between"><span className="text-mzd-gray">Total ilíquido</span><span>{formatAOA(totais.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-mzd-gray">IVA ({o.taxaIva}%)</span><span>{formatAOA(totais.iva)}</span></div>
        <div className="flex justify-between border-t border-mzd-black pt-1.5 text-base font-extrabold"><span>Total</span><span>{formatAOA(fat.valorTotal)}</span></div>
      </div>

      <SectionTitle>Pagamentos</SectionTitle>
      <table className="mb-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Recibo</th>
            <th className="py-2">Data</th>
            <th className="py-2">Forma</th>
            <th className="py-2">Referência</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {fat.pagamentos.map((pg) => (
            <tr key={pg.id} className={`border-b border-zinc-100 ${pg.anulado ? 'text-mzd-gray line-through' : ''}`}>
              <td className="num py-2">{pg.numeroRecibo}</td>
              <td className="py-2">{formatDate(pg.data)}</td>
              <td className="py-2">{FORMA_PAGAMENTO_LABEL[pg.forma]}</td>
              <td className="py-2 text-mzd-gray">{pg.anulado ? `Anulado: ${pg.anulado.motivo}` : pg.referencia ?? '—'}</td>
              <td className="py-2 text-right font-medium">{formatAOA(pg.valor)}</td>
            </tr>
          ))}
          {fat.pagamentos.length === 0 && (
            <tr><td colSpan={5} className="py-3 text-center text-mzd-gray">Sem pagamentos registados.</td></tr>
          )}
        </tbody>
      </table>
      <div className="mb-6 ml-auto w-full max-w-72 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-mzd-gray">Total pago</span><span>{formatAOA(pago)}</span></div>
        <div className="flex justify-between font-bold"><span>Saldo em aberto</span><span className={saldo > 0 ? 'text-mzd-red' : ''}>{formatAOA(saldo)}</span></div>
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
        garantia, contacte a {config?.empresa.nome ?? 'oficina'} através do número {config?.empresa.telefone} ou {config?.empresa.email},
        apresentando este documento.
      </p>
    </DocumentShell>
  );
}
