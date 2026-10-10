import type { ProcessoDetalhado } from '../types';
import { METODO_APROVACAO_LABEL } from '../types';
import DocumentShell, { CoordenadasPagamento, Field, LinhaIva, NotaIsencao, SectionTitle, SignatureLine } from './DocumentShell';
import { formatAOA, formatDate, formatDateTime, formatDia } from '../lib/format';
import { calcularTotais, valorAceitacao } from '../lib/calculos';
import { aceitarAte } from '../lib/parqueamento';

export default function OrcamentoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const o = processo.orcamento;
  if (!o) return <p className="p-6 text-sm text-mzd-gray">Orçamento ainda não emitido.</p>;
  const { cliente, viatura, autorizacao: a } = processo;
  const totais = calcularTotais(o);
  const c = o.condicoes;
  const aceitacao = valorAceitacao(o);
  const ate = aceitarAte(o);
  const parqueamento = `${formatAOA(c.parqueamentoDia)} por dia${o.taxaIva > 0 ? ' (+ IVA)' : ''}`;

  return (
    <DocumentShell title="Orçamento / Fatura Pró-forma" subtitle={ate ? `Aceitar até ${formatDia(ate)}` : `Válido ${o.validadeDias} dias a contar do envio`} numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="NIF" value={cliente.nif ?? '—'} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Data de emissão" value={o.enviadoEm ? formatDate(o.enviadoEm) : '—'} />
        <Field label="Aceitar até" value={ate ? formatDia(ate) : `${o.validadeDias} dias após o envio`} />
        <Field label="Estado" value={{ rascunho: 'Rascunho', enviado: 'À espera da aceitação', aprovado: 'Aceite', recusado: 'Recusado' }[o.estado]} />
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

      <div className="ml-auto w-full max-w-72 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-mzd-gray">Subtotal Peças</span><span>{formatAOA(totais.pecas)}</span></div>
        <div className="flex justify-between"><span className="text-mzd-gray">Subtotal Mão de Obra</span><span>{formatAOA(totais.maoObra)}</span></div>
        {totais.desconto > 0 && <div className="flex justify-between"><span className="text-mzd-gray">Desconto ({o.desconto!.percentagem}%)</span><span>−{formatAOA(totais.desconto)}</span></div>}
        <LinhaIva taxa={o.taxaIva} isencao={o.isencaoIva} valor={formatAOA(totais.iva)} />
        <div className="flex justify-between border-t border-mzd-black pt-1.5 text-base font-extrabold"><span>Total</span><span>{formatAOA(totais.total)}</span></div>
      </div>
      <NotaIsencao isencao={o.isencaoIva} />

      <section className="mt-6 break-inside-avoid">
        <SectionTitle>Condições de Pagamento</SectionTitle>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-2">Na aceitação do orçamento</td>
              <td className="py-2 text-mzd-gray">{[c.pecasAceitacaoPct > 0 && `${c.pecasAceitacaoPct}% das peças`, c.maoObraAceitacaoPct > 0 && `${c.maoObraAceitacaoPct}% da mão de obra`].filter(Boolean).join(' + ') || '—'}</td>
              <td className="py-2 text-right font-semibold">{formatAOA(aceitacao)}</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2">No levantamento da viatura</td>
              <td className="py-2 text-mzd-gray">{[c.pecasAceitacaoPct < 100 && `${100 - c.pecasAceitacaoPct}% das peças`, c.maoObraAceitacaoPct < 100 && `${100 - c.maoObraAceitacaoPct}% da mão de obra`].filter(Boolean).join(' + ') || '—'}</td>
              <td className="py-2 text-right font-semibold">{formatAOA(Math.max(0, totais.total - aceitacao))}</td>
            </tr>
          </tbody>
        </table>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[12.5px] leading-snug text-mzd-graphite">
          <li>A encomenda das peças e a reparação começam depois do pagamento da aceitação.</li>
          <li>
            O orçamento pode ser aceite {ate ? <>até <strong>{formatDia(ate)}</strong></> : <>nos {o.validadeDias} dias seguintes ao envio</>}.
            Sem resposta nesse prazo, a viatura fica em parqueamento a {parqueamento}, até à decisão.
          </li>
          <li>Quando a viatura estiver pronta, avisamos e tem {c.diasUteisLevantamento} dias úteis para a levantar. Depois disso, aplica-se parqueamento a {parqueamento}.</li>
          <li>Trabalhos adicionais encontrados durante a reparação só são feitos com nova aceitação.</li>
        </ul>
      </section>

      <CoordenadasPagamento referencia={processo.numero} />

      <section className="mt-6 break-inside-avoid">
        <SectionTitle>Aceitação</SectionTitle>
        {a ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm">
            Aceite por <strong>{a.autorizadoPor}</strong> em {formatDateTime(a.data)} ({METODO_APROVACAO_LABEL[a.metodo].toLowerCase()}).
          </p>
        ) : (
          <>
            <p className="text-sm text-mzd-graphite">
              Pode aceitar no link pessoal que lhe enviámos por WhatsApp ou email, responder ACEITO a essa mensagem, ou assinar abaixo e entregar-nos esta folha.
            </p>
            <p className="mt-3 text-sm font-semibold">Aceito o diagnóstico, o orçamento e as condições acima descritas.</p>
            <div className="mt-2 grid grid-cols-[2fr_1fr] gap-10">
              <SignatureLine label="Nome legível e assinatura do cliente" />
              <SignatureLine label="Data" />
            </div>
          </>
        )}
      </section>
    </DocumentShell>
  );
}
