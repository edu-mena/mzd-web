import type { Processo } from '../types';
import { getCliente, getViatura } from '../data/mock';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatAOA, formatDate, orcamentoTotal } from '../lib/format';

const METODO_LABEL: Record<string, string> = { presencial: 'Assinatura Presencial', email: 'Aprovação por Email', whatsapp: 'Aprovação via WhatsApp' };

export default function AutorizacaoDoc({ processo }: { processo: Processo }) {
  const a = processo.autorizacao;
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const total = a?.valorTotal ?? orcamentoTotal(processo.orcamento);

  return (
    <DocumentShell title="Declaração de Autorização de Reparação" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Valor total do orçamento" value={formatAOA(total)} />
      </div>

      <SectionTitle>Declaração</SectionTitle>
      <p className="mb-5 rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed">
        Eu, abaixo assinado, na qualidade de proprietário/responsável pela viatura com matrícula <strong>{viatura.matricula}</strong>,
        declaro ter tomado conhecimento do orçamento apresentado pela MZD Carros e Motores, no valor total de{' '}
        <strong>{formatAOA(total)}</strong>, e <strong>autorizo</strong> a requisição das peças necessárias e o início imediato da reparação
        conforme os termos acordados.
      </p>

      <SectionTitle>Validação da Autorização</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Método de validação" value={a ? METODO_LABEL[a.metodo] : 'Pendente'} />
        <Field label="Data" value={a ? formatDate(a.data) : '—'} />
        <Field label="Autorizado por" value={a?.autorizadoPor ?? '—'} />
      </div>

      {a?.metodo === 'whatsapp' && (
        <div className="mb-5 rounded-lg border border-zinc-200 p-3 text-xs text-mzd-gray">
          📎 Comprovativo anexado: print de conversa WhatsApp — timestamp {formatDate(a.data)}
        </div>
      )}
      {a?.metodo === 'email' && (
        <div className="mb-5 rounded-lg border border-zinc-200 p-3 text-xs text-mzd-gray">
          📎 Comprovativo anexado: email de aprovação — {formatDate(a.data)}
        </div>
      )}

      <SignatureLine label="Assinatura do cliente (quando presencial)" />
    </DocumentShell>
  );
}
