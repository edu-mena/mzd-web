import type { ProcessoDetalhado } from '../types';
import MapaDanos from '../components/ui/MapaDanos';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatDateTime } from '../lib/format';

export default function FichaRecepcaoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const { cliente, viatura } = processo;
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
      <div className="mb-5">
        <MapaDanos danos={f.danos} soLeitura />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <SignatureLine label="Assinatura do Cliente — confirma o estado acima descrito" processoId={processo.id} anexoId={f.assinaturaAnexoId} />
        <SignatureLine label="Rececionista responsável" />
      </div>
    </DocumentShell>
  );
}
