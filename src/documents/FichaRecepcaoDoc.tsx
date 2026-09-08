import type { Processo } from '../types';
import { getCliente, getViatura } from '../data/mock';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDateTime } from '../lib/format';

export default function FichaRecepcaoDoc({ processo }: { processo: Processo }) {
  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const f = processo.fichaRecepcao;

  return (
    <DocumentShell title="Ficha de Receção / OS Inicial" numero={processo.numero}>
      <SectionTitle>Dados do Cliente</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Nome" value={cliente.nome} />
        <Field label="Telefone" value={cliente.telefone} />
        <Field label="NIF" value={cliente.nif} />
        <Field label="Email" value={cliente.email} className="col-span-2" />
        <Field label="Data/Hora de receção" value={formatDateTime(f.dataHora)} />
      </div>

      <SectionTitle>Dados da Viatura</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Matrícula" value={viatura.matricula} />
        <Field label="Marca / Modelo" value={`${viatura.marca} ${viatura.modelo}`} />
        <Field label="Ano" value={viatura.ano} />
        <Field label="Cor" value={viatura.cor} />
        <Field label="Nº de chassi" value={viatura.chassi} />
        <Field label="Quilometragem" value={`${f.km.toLocaleString('pt-PT')} km`} />
      </div>

      <SectionTitle>Queixa Relatada pelo Cliente</SectionTitle>
      <p className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm">{f.queixaCliente}</p>

      <SectionTitle>Estado de Entrada</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Nível de combustível" value={`${f.combustivel}%`} />
        <Field label="Estado da bateria" value={f.bateria === 'boa' ? 'Boa' : f.bateria === 'fraca' ? 'Fraca' : 'A testar'} />
        <Field label="Pertences deixados" value={f.pertences} />
      </div>

      <SectionTitle>Mapa de Riscos / Danos Visuais</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <CarDiagram label="Vista de Topo" danos={f.danos.filter((d) => d.vista === 'topo')} />
        <CarDiagram label="Vista de Perfil" danos={f.danos.filter((d) => d.vista === 'perfil')} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <SignatureLine label="Assinatura do Cliente — confirma o estado acima descrito" />
        <SignatureLine label="Rececionista responsável" />
      </div>
    </DocumentShell>
  );
}

function CarDiagram({ label, danos }: { label: string; danos: { x: number; y: number }[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <p className="mb-2 text-center text-[10px] font-bold uppercase text-mzd-gray">{label}</p>
      <div className="relative mx-auto h-32 w-full rounded-md bg-zinc-50">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect x="20" y="10" width="60" height="80" rx="14" fill="none" stroke="#8E8E8E" strokeWidth="1.5" />
          <line x1="20" y1="30" x2="80" y2="30" stroke="#8E8E8E" strokeWidth="1" />
          <line x1="20" y1="70" x2="80" y2="70" stroke="#8E8E8E" strokeWidth="1" />
        </svg>
        {danos.map((d, i) => (
          <span key={i} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mzd-red ring-2 ring-white" style={{ left: `${d.x}%`, top: `${d.y}%` }} />
        ))}
      </div>
    </div>
  );
}
