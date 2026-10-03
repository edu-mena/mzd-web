import type { ProcessoDetalhado } from '../types';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDateTime } from '../lib/format';
import { horasTrabalhadas } from '../lib/calculos';

export default function RelatorioServicosDoc({ processo }: { processo: ProcessoDetalhado }) {
  const { cliente, viatura, entrega } = processo;
  const tarefas = (processo.tarefas ?? []).filter((t) => t.feita);
  const aprovados = [processo.orcamento, ...(processo.orcamentosAdicionais ?? []).filter((a) => a.estado === 'aprovado')].filter(Boolean);
  const pecas = aprovados.flatMap((o) => o!.pecas);

  if (!processo.tarefas?.length) return <p className="p-6 text-sm text-mzd-gray">O relatório é preenchido à medida que a reparação avança.</p>;

  return (
    <DocumentShell title="Relatório de Serviços Executados" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Mecânico responsável" value={processo.mecanico?.nome ?? '—'} />
        <Field label="Horas de trabalho registadas" value={`${horasTrabalhadas(processo).toLocaleString('pt-PT')} h`} />
        <Field label="Retrabalhos" value={String(processo.retrabalhos ?? 0)} />
      </div>

      <SectionTitle>Trabalhos Executados</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Concluído</th>
          </tr>
        </thead>
        <tbody>
          {tarefas.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100">
              <td className="py-2">{t.descricao}{t.adicionalId && <span className="ml-1 text-xs text-mzd-gray">(adicional)</span>}</td>
              <td className="py-2 text-right text-mzd-gray">{t.feitaEm ? formatDateTime(t.feitaEm) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Peças Instaladas</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {pecas.map((p, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{p.descricao}</td>
              <td className="py-2 text-right">{p.quantidade}</td>
            </tr>
          ))}
          {pecas.length === 0 && <tr><td colSpan={2} className="py-3 text-center text-mzd-gray">Sem peças</td></tr>}
        </tbody>
      </table>

      <SectionTitle>Comparativo Receção / Entrega</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase text-mzd-gray">Na receção</p>
          <Field label="Quilometragem" value={`${processo.fichaRecepcao.km.toLocaleString('pt-PT')} km`} />
          <Field label="Combustível" value={`${processo.fichaRecepcao.combustivel}%`} className="mt-2" />
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase text-mzd-gray">Na entrega</p>
          <Field label="Quilometragem" value={entrega ? `${entrega.km.toLocaleString('pt-PT')} km` : 'Por registar'} />
          <Field label="Combustível" value={entrega ? `${entrega.combustivel}%` : 'Por registar'} className="mt-2" />
        </div>
      </div>
      {entrega?.observacoes && <p className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm">{entrega.observacoes}</p>}

      <div className="mt-8 grid grid-cols-2 gap-10">
        <SignatureLine label="O cliente recebeu a viatura" processoId={processo.id} anexoId={entrega?.assinaturaAnexoId} />
        <SignatureLine label="Responsável pela entrega" />
      </div>
    </DocumentShell>
  );
}
