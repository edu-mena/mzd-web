import type { ProcessoDetalhado } from '../types';
import { METODO_APROVACAO_LABEL } from '../types';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatAOA, formatDate, formatDateTime } from '../lib/format';
import { calcularTotais } from '../lib/calculos';

export default function AutorizacaoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const a = processo.autorizacao;
  const { cliente, viatura } = processo;
  const total = a?.valorTotal ?? calcularTotais(processo.orcamento).total;
  const adicionais = (processo.orcamentosAdicionais ?? []).filter((x) => x.decisao);

  return (
    <DocumentShell title="Declaração de Autorização de Reparação" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Valor total do orçamento (c/ IVA)" value={formatAOA(total)} />
      </div>

      <SectionTitle>Declaração</SectionTitle>
      <p className="mb-5 rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed">
        Eu, <strong>{a?.autorizadoPor ?? '______________________________'}</strong>, na qualidade de proprietário/responsável pela viatura com matrícula{' '}
        <strong>{viatura.matricula}</strong>, declaro ter tomado conhecimento do diagnóstico e do orçamento apresentados pela MZD Carros e Motores,
        no valor total de <strong>{formatAOA(total)}</strong> (IVA incluído), e <strong>autorizo</strong> a requisição das peças necessárias
        e o início da reparação conforme os termos acordados. Qualquer trabalho adicional será sujeito a nova aprovação.
      </p>

      <SectionTitle>Validação da Autorização</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Método" value={a ? METODO_APROVACAO_LABEL[a.metodo] : 'Pendente'} />
        <Field label="Data/hora" value={a ? formatDateTime(a.data) : '—'} />
        <Field label="Autorizado por" value={a?.autorizadoPor ?? '—'} />
      </div>
      {a?.comprovativoAnexoId && (
        <p className="mb-5 rounded-lg border border-zinc-200 p-3 text-xs text-mzd-gray">
          Comprovativo da aprovação ({METODO_APROVACAO_LABEL[a.metodo].toLowerCase()}) guardado no processo, separador Fotos.
        </p>
      )}

      {adicionais.length > 0 && (
        <>
          <SectionTitle>Trabalhos Adicionais</SectionTitle>
          <table className="mb-5 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
                <th className="py-2">Trabalho</th>
                <th className="py-2">Decisão</th>
                <th className="py-2">Data</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {adicionais.map((x) => (
                <tr key={x.id} className="border-b border-zinc-100">
                  <td className="py-2">{x.justificacao}</td>
                  <td className="py-2">{x.estado === 'aprovado' ? 'Aprovado' : 'Recusado'} ({METODO_APROVACAO_LABEL[x.decisao!.metodo].toLowerCase()})</td>
                  <td className="py-2">{formatDate(x.decisao!.data)}</td>
                  <td className="py-2 text-right">{formatAOA(calcularTotais(x).total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <SignatureLine label="Assinatura do cliente (quando presencial)" processoId={processo.id} anexoId={a?.assinaturaAnexoId} />
    </DocumentShell>
  );
}
