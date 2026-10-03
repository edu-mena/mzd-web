import type { ProcessoDetalhado } from '../types';
import { useUtilizadores } from '../api/hooks';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDateTime } from '../lib/format';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function ChecklistQualidadeDoc({ processo }: { processo: ProcessoDetalhado }) {
  const cq = processo.checklistQualidade;
  const { cliente, viatura } = processo;
  const { data: utilizadores } = useUtilizadores();
  const responsavel = utilizadores?.find((u) => u.id === cq?.responsavelId);

  if (!cq) return <p className="p-6 text-sm text-mzd-gray">O controlo de qualidade é feito depois de concluída a reparação.</p>;

  return (
    <DocumentShell title="Checklist de Controlo de Qualidade" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Responsável pela validação" value={responsavel?.nome ?? '—'} />
      </div>

      <SectionTitle>Itens Verificados</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Item</th>
            <th className="py-2">Resultado</th>
            <th className="py-2">Nota</th>
          </tr>
        </thead>
        <tbody>
          {cq.itens.map((it, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2 font-medium">{it.item}</td>
              <td className="py-2">
                {it.conforme
                  ? <span className="flex items-center gap-1 text-sinal-verde"><CheckCircle2 size={14} /> Conforme</span>
                  : <span className="flex items-center gap-1 text-sinal-vermelho"><XCircle size={14} /> Não conforme</span>}
              </td>
              <td className="py-2 text-mzd-gray">{it.nota ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Resultado final" value={cq.aprovado ? 'Conforme — aprovado para entrega' : 'Não conforme — voltou à reparação'} />
        <Field label="Data/hora" value={cq.dataHora ? formatDateTime(cq.dataHora) : '—'} />
        <Field label="Retrabalhos" value={String(processo.retrabalhos ?? 0)} />
      </div>
      {cq.observacoes && <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm">{cq.observacoes}</p>}

      <SignatureLine label="Assinatura do Chefe de Oficina" />
    </DocumentShell>
  );
}
