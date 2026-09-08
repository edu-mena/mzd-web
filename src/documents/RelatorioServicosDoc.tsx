import type { Processo } from '../types';
import { getCliente, getViatura } from '../data/mock';
import DocumentShell, { Field, SectionTitle } from './DocumentShell';

export default function RelatorioServicosDoc({ processo }: { processo: Processo }) {
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const o = processo.orcamento;

  return (
    <DocumentShell title="Relatório de Serviços Executados" numero={processo.numero}>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Viatura" value={`${viatura.matricula} — ${viatura.marca} ${viatura.modelo}`} />
        <Field label="Quilometragem na entrega" value={`${viatura.km.toLocaleString('pt-PT')} km`} />
      </div>

      <SectionTitle>Serviços Executados</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Horas</th>
          </tr>
        </thead>
        <tbody>
          {o?.maoObra.map((m, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{m.descricao}</td>
              <td className="py-2 text-right">{m.horas}h</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Peças Efetivamente Instaladas</SectionTitle>
      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Qtd.</th>
            <th className="py-2">Nº série/lote</th>
          </tr>
        </thead>
        <tbody>
          {o?.pecas.map((p, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-2">{p.descricao}</td>
              <td className="py-2 text-right">{p.quantidade}</td>
              <td className="py-2 text-mzd-gray">LT-{2026000 + i}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Comparativo Receção / Entrega</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase text-mzd-gray">Na receção</p>
          <Field label="Quilometragem" value={`${processo.fichaRecepcao.km.toLocaleString('pt-PT')} km`} />
          <Field label="Combustível" value={`${processo.fichaRecepcao.combustivel}%`} className="mt-2" />
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase text-mzd-gray">Na entrega</p>
          <Field label="Quilometragem" value={`${viatura.km.toLocaleString('pt-PT')} km`} />
          <Field label="Combustível" value={`${Math.max(processo.fichaRecepcao.combustivel - 5, 5)}%`} className="mt-2" />
        </div>
      </div>
    </DocumentShell>
  );
}
