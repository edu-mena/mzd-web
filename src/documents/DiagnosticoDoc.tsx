import type { ReactNode } from 'react';
import type { ProcessoDetalhado } from '../types';
import { SISTEMAS_VEICULO } from '../types';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDate, formatDateTime } from '../lib/format';
import clsx from 'clsx';

const ESTADO_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  atencao: 'bg-amber-50 text-amber-700 ring-amber-200',
  critico: 'bg-red-50 text-mzd-red ring-red-200',
};
const ESTADO_TXT: Record<string, string> = { ok: 'OK', atencao: 'Requer Atenção', critico: 'Crítico' };

export default function DiagnosticoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const d = processo.diagnostico;
  if (!d?.concluidoEm) {
    return (
      <div className="space-y-3">
        <p className="no-print rounded-md border border-linha bg-white px-4 py-3 text-[13px] text-mzd-graphite">
          Diagnóstico ainda por registar. Imprima esta ficha para o mecânico preencher; depois registe o que ele encontrou em
          <strong> Próximo passo → Fazer diagnóstico</strong>.
        </p>
        <FichaDiagnosticoModelo processo={processo} />
      </div>
    );
  }
  const { cliente, viatura, mecanico } = processo;

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
        <Field label="Concluído em" value={d.concluidoEm ? formatDateTime(d.concluidoEm) : 'Em curso'} />
      </div>

      <SectionTitle>Aprovação do Cliente</SectionTitle>
      <p className="rounded-lg border border-zinc-200 p-4 text-sm text-mzd-gray">
        O cliente aprova este diagnóstico em conjunto com o orçamento. A aprovação fica registada na{' '}
        <span className="font-semibold text-mzd-black">Declaração de Autorização</span> deste processo.
      </p>
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

const Quadrado = () => <span aria-hidden className="inline-block h-3.5 w-3.5 shrink-0 border border-mzd-black align-[-2px]" />;
const Opcao = ({ children }: { children: ReactNode }) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Quadrado />{children}</span>;
const Linhas = ({ n }: { n: number }) => <>{Array.from({ length: n }, (_, i) => <div key={i} className="h-6 border-b border-zinc-400" />)}</>;

/** Folha em branco para o mecânico preencher à mão; a receção regista-a depois no sistema. */
export function FichaDiagnosticoModelo({ processo }: { processo: ProcessoDetalhado }) {
  const { cliente, viatura, mecanico } = processo;
  const f = processo.fichaRecepcao;
  return (
    <div className="print:[zoom:0.9]">
      <DocumentShell title="Ficha de Diagnóstico" subtitle="Preenchida pelo mecânico" numero={processo.numero}>
        <div className="mb-4 grid grid-cols-3 gap-x-4 gap-y-3">
          <Field label="Cliente" value={cliente.nome} />
          <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
          <Field label="Km na entrada" value={f.km !== undefined ? `${f.km.toLocaleString('pt-PT')} km` : '__________ km'} />
          <Field label="Mecânico" value={mecanico?.nome ?? '______________________'} />
          <Field label="Entrada" value={formatDateTime(f.dataHora)} />
          <Field label="Prazo prometido" value={formatDate(processo.prazoEntrega)} />
        </div>

        <SectionTitle>Queixa do Cliente</SectionTitle>
        <p className="mb-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm">{f.queixaCliente}</p>

        <SectionTitle>Inspeção por Sistema</SectionTitle>
        <table className="mb-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-[10px] font-bold uppercase text-mzd-gray">
              <th className="w-[26%] py-1">Sistema</th>
              <th className="w-10 py-1 text-center">OK</th>
              <th className="w-16 py-1 text-center">Atenção</th>
              <th className="w-14 py-1 text-center">Crítico</th>
              <th className="py-1 pl-3">O que encontrou</th>
            </tr>
          </thead>
          <tbody>
            {[...SISTEMAS_VEICULO, 'Outro: ____________', 'Outro: ____________'].map((s, i) => (
              <tr key={`${s}${i}`} className="border-b border-zinc-200">
                <td className={i >= SISTEMAS_VEICULO.length ? 'py-2 text-mzd-gray' : 'py-2'}>{s}</td>
                <td className="text-center"><Quadrado /></td>
                <td className="text-center"><Quadrado /></td>
                <td className="text-center"><Quadrado /></td>
                <td className="pl-3" />
              </tr>
            ))}
          </tbody>
        </table>

        <SectionTitle>Parecer Técnico</SectionTitle>
        <div className="mb-4"><Linhas n={4} /></div>

        <div className="mb-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
          <span className="font-semibold">Recomendação</span>
          <span className="flex flex-wrap gap-x-5 gap-y-1"><Opcao>Reparar</Opcao><Opcao>Substituir</Opcao><Opcao>Reparar e substituir</Opcao></span>
          <span className="font-semibold">Urgência</span>
          <span className="flex flex-wrap gap-x-5 gap-y-1"><Opcao>Baixa</Opcao><Opcao>Média</Opcao><Opcao>Alta</Opcao><Opcao><span className="font-semibold text-mzd-red">Risco de segurança</span></Opcao></span>
        </div>

        <SectionTitle>Peças e Trabalho Necessários</SectionTitle>
        <p className="mb-1 text-[10px] text-mzd-gray">Para o orçamento: peça, quantidade e horas de mão de obra estimadas.</p>
        <div className="mb-5"><Linhas n={4} /></div>

        <div className="mt-2 grid grid-cols-2 gap-10">
          <SignatureLine label="Mecânico — nome e assinatura" />
          <SignatureLine label="Data e hora" />
        </div>
      </DocumentShell>
    </div>
  );
}
