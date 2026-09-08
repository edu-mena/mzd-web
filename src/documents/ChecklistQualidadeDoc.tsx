import type { Processo } from '../types';
import { getCliente, getViatura, getUtilizador } from '../data/mock';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDateTime } from '../lib/format';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

const SEGURANCA_PADRAO = ['Travões', 'Luzes', 'Níveis de fluidos', 'Aperto de parafusos/porcas', 'Ausência de fugas', 'Teste de condução'];

export default function ChecklistQualidadeDoc({ processo }: { processo: Processo }) {
  const cq = processo.checklistQualidade;
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const responsavel = getUtilizador(cq?.responsavelId);

  const itens = cq?.itens ?? [];
  const seguranca = SEGURANCA_PADRAO.map((item) => ({ item, conforme: true as boolean | null }));

  return (
    <DocumentShell title="Checklist de Controlo de Qualidade" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Responsável pela validação" value={responsavel?.nome ?? '—'} />
      </div>

      <SectionTitle>Itens Sinalizados no Diagnóstico</SectionTitle>
      <ChecklistTable itens={itens} />

      <SectionTitle>Verificações de Segurança Padrão</SectionTitle>
      <ChecklistTable itens={seguranca} />

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Resultado final" value={cq?.aprovado ? 'Conforme — aprovado para entrega' : 'Pendente de validação'} />
        <Field label="Data/hora do teste final" value={cq?.dataHora ? formatDateTime(cq.dataHora) : '—'} />
      </div>

      <SignatureLine label="Assinatura do Chefe de Oficina" />
    </DocumentShell>
  );
}

function ChecklistTable({ itens }: { itens: { item: string; conforme: boolean | null; nota?: string }[] }) {
  return (
    <table className="mb-5 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
          <th className="py-2">Item testado</th>
          <th className="py-2">Conforme</th>
          <th className="py-2">Nota</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((it, i) => (
          <tr key={i} className="border-b border-zinc-100">
            <td className="py-2 font-medium">{it.item}</td>
            <td className="py-2">
              {it.conforme === true && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} /> Conforme</span>}
              {it.conforme === false && <span className="flex items-center gap-1 text-mzd-red"><XCircle size={14} /> Não conforme</span>}
              {it.conforme === null && <span className="flex items-center gap-1 text-mzd-gray"><MinusCircle size={14} /> —</span>}
            </td>
            <td className="py-2 text-mzd-gray">{it.nota ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
