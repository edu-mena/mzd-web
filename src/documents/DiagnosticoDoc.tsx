import type { Processo } from '../types';
import { getCliente, getViatura, getUtilizador } from '../data/mock';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDate } from '../lib/format';
import clsx from 'clsx';

const ESTADO_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  atencao: 'bg-amber-50 text-amber-700 ring-amber-200',
  critico: 'bg-red-50 text-mzd-red ring-red-200',
};
const ESTADO_TXT: Record<string, string> = { ok: 'OK', atencao: 'Requer Atenção', critico: 'Crítico' };

export default function DiagnosticoDoc({ processo }: { processo: Processo }) {
  const d = processo.diagnostico;
  if (!d) return <p className="p-6 text-sm text-mzd-gray">Diagnóstico ainda não iniciado.</p>;
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const mecanico = getUtilizador(d.mecanicoId);

  return (
    <DocumentShell title="Documento de Diagnóstico" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Mecânico responsável" value={mecanico?.nome} />
        <Field label="Nível de urgência" value={<UrgenciaBadge urgencia={d.urgencia} />} />
      </div>

      <SectionTitle>Inspeção por Sistema</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Sistema</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Observação</th>
          </tr>
        </thead>
        <tbody>
          {d.itens.map((item) => (
            <tr key={item.sistema} className="border-b border-zinc-100">
              <td className="py-2 font-medium">{item.sistema}</td>
              <td className="py-2">
                <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', ESTADO_STYLE[item.estado])}>
                  {ESTADO_TXT[item.estado]}
                </span>
              </td>
              <td className="py-2 text-mzd-gray">{item.observacao ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Parecer Técnico Geral</SectionTitle>
      <p className="mb-3 rounded-lg bg-zinc-50 p-3 text-sm">{d.parecerGeral}</p>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <Field label="Recomendação" value={d.recomendacao === 'reparar' ? 'Reparação' : d.recomendacao === 'substituir' ? 'Substituição' : 'Reparação e substituição'} />
      </div>

      <SectionTitle>Aprovação do Cliente</SectionTitle>
      <div className="rounded-lg border border-zinc-200 p-4 text-sm">
        <p>
          Eu, <span className="font-bold">{d.aprovacao?.nomeCliente ?? '_______________________________'}</span>, tomei conhecimento do
          diagnóstico acima e <span className="font-bold">aprovo</span> o avançar para orçamento/reparação.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-10">
          <Field label="Data" value={d.aprovacao ? formatDate(d.aprovacao.data) : '—'} />
          <Field label="Método de aprovação" value={d.aprovacao ? { assinatura: 'Assinatura manuscrita', digital: 'Assinatura digital', foto: 'Foto de documento assinado' }[d.aprovacao.metodo] : 'Pendente'} />
        </div>
        <SignatureLine label="Assinatura do cliente" />
      </div>
    </DocumentShell>
  );
}

function UrgenciaBadge({ urgencia }: { urgencia: string }) {
  const map: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', seguranca: 'Segurança' };
  const style: Record<string, string> = {
    baixo: 'bg-zinc-100 text-zinc-700', medio: 'bg-amber-50 text-amber-700', alto: 'bg-orange-50 text-orange-700', seguranca: 'bg-red-50 text-mzd-red',
  };
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-bold', style[urgencia])}>{map[urgencia]}</span>;
}
