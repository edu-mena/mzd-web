import { Fragment, useState } from 'react';
import { ExternalLink, Printer } from 'lucide-react';
import type { Anexo, ProcessoDetalhado } from '../types';
import MapaDanos from '../components/ui/MapaDanos';
import { Segmented } from '../components/ui/Controls';
import { ImagemAnexo } from '../components/ui/Anexos';
import { useAnexos, useUtilizadores } from '../api/hooks';
import { useUrlAnexo } from '../lib/useUrlAnexo';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { botao } from '../components/ui/botao';
import { formatDate, formatDateTime } from '../lib/format';

const VERIFICACOES = ['Pneus e jantes', 'Pneu sobresselente', 'Vidros e para-brisas', 'Espelhos', 'Faróis e farolins', 'Macaco e chave de rodas', 'Triângulo e colete', 'Rádio / ecrã', 'Tapetes', 'Chave suplente'];

/**
 * Ficha de entrada no separador Documentos: a ficha assinada (digitalizada) quando existe,
 * e sempre o modelo para imprimir.
 */
export default function FichaRecepcaoDoc({ processo }: { processo: ProcessoDetalhado }) {
  const f = processo.fichaRecepcao;
  const digitalizada = !!f.digitalizacaoIds?.length;
  const noEcra = !digitalizada && f.assinaturaCliente;
  const [vista, setVista] = useState<'assinada' | 'modelo'>(digitalizada || noEcra ? 'assinada' : 'modelo');

  return (
    <div className="space-y-3">
      {(digitalizada || noEcra) && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Segmented<'assinada' | 'modelo'> label="Ficha de entrada" value={vista} onChange={setVista} opcoes={[{ valor: 'assinada', label: 'Ficha assinada' }, { valor: 'modelo', label: 'Modelo para imprimir' }]} />
        </div>
      )}
      {vista === 'modelo' && !digitalizada && !noEcra && (
        <p className="no-print rounded-md border border-linha bg-white px-4 py-3 text-[13px] text-mzd-graphite">
          Imprima esta ficha e entregue-a ao mecânico, que a preenche com o cliente. Depois de assinada, digitalize-a e carregue-a em <strong>Próximo passo → Carregar ficha assinada</strong>.
        </p>
      )}
      {vista === 'modelo' ? <FichaEntradaModelo processo={processo} /> : digitalizada ? <FichaDigitalizada processo={processo} /> : <FichaNoEcra processo={processo} />}
    </div>
  );
}

const Quadrado = () => <span aria-hidden className="inline-block h-3.5 w-3.5 shrink-0 border border-mzd-black align-[-2px]" />;
const Opcao = ({ children }: { children: string }) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Quadrado />{children}</span>;
const Pauta = ({ linhas = 2 }: { linhas?: number }) => <>{Array.from({ length: linhas }, (_, i) => <div key={i} className="h-6 border-b border-zinc-400" />)}</>;

/** Modelo em papel, já com os dados do processo, para o mecânico preencher com o cliente. */
export function FichaEntradaModelo({ processo }: { processo: ProcessoDetalhado }) {
  const { cliente, viatura } = processo;
  const f = processo.fichaRecepcao;
  return (
    // Ligeiramente reduzida na impressão para caber numa folha A4 (o mecânico preenche-a à mão).
    <div className="print:[zoom:0.88]">
    <DocumentShell title="Ficha de Entrada da Viatura" subtitle="Preenchida pelo mecânico com o cliente" numero={processo.numero}>
      <div className="mb-4 grid grid-cols-3 gap-x-4 gap-y-3">
        <Field label="Cliente" value={cliente.nome} />
        <Field label="Telefone" value={cliente.telefone} />
        <Field label="NIF" value={cliente.nif} />
        <Field label="Matrícula" value={viatura.matricula} />
        <Field label="Marca / Modelo" value={`${viatura.marca} ${viatura.modelo}`} />
        <Field label="Ano · Cor" value={`${viatura.ano} · ${viatura.cor}`} />
        <Field label="Entrada" value={formatDateTime(f.dataHora)} />
        <Field label="Prazo prometido" value={formatDate(processo.prazoEntrega)} />
        <Field label="Mecânico" value={processo.mecanico?.nome ?? '______________________'} />
      </div>

      <SectionTitle>Queixa do Cliente</SectionTitle>
      <p className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">{f.queixaCliente}</p>

      <SectionTitle>Estado de Entrada (verificar com o cliente)</SectionTitle>
      <div className="mb-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
        <span className="font-semibold">Quilometragem</span>
        <span className="flex items-end gap-2"><span className="h-6 w-44 border-b border-mzd-black" /> km</span>
        <span className="font-semibold">Combustível</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">{['Reserva', '¼', '½', '¾', 'Cheio'].map((x) => <Opcao key={x}>{x}</Opcao>)}</span>
        <span className="font-semibold">Painel</span>
        <span className="flex flex-wrap items-end gap-x-4 gap-y-1"><Opcao>Sem luzes de aviso</Opcao><Opcao>Luzes acesas:</Opcao><span className="h-5 min-w-40 flex-1 border-b border-zinc-400" /></span>
      </div>

      <table className="mb-4 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-1">Verificação</th><th className="w-12 py-1 text-center">OK</th><th className="w-14 py-1 text-center">Dano</th><th className="w-12 py-1 text-center">Falta</th>
            <th className="py-1 pl-6">Verificação</th><th className="w-12 py-1 text-center">OK</th><th className="w-14 py-1 text-center">Dano</th><th className="w-12 py-1 text-center">Falta</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: VERIFICACOES.length / 2 }, (_, i) => (
            <tr key={i} className="border-b border-zinc-100">
              {[VERIFICACOES[i * 2], VERIFICACOES[i * 2 + 1]].map((v, k) => (
                <Fragment key={v}>
                  <td className={k ? 'py-1 pl-6' : 'py-1'}>{v}</td>
                  {[0, 1, 2].map((j) => <td key={j} className="text-center"><Quadrado /></td>)}
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-1 flex items-baseline justify-between gap-3">
        <SectionTitle>Danos Visíveis</SectionTitle>
        <span className="text-[11px] text-mzd-gray">Assinale e escreva R (risco), M (mossa) ou O (outro)</span>
      </div>
      {/* Mais estreito para a ficha caber numa folha A4. */}
      <div className="mx-auto mb-3 max-w-[135mm]"><MapaDanos danos={[]} soLeitura emBranco /></div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-mzd-gray">Pertences deixados na viatura</p>
          <Pauta />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-mzd-gray">Observações do mecânico</p>
          <Pauta />
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-snug">
        O cliente confirma o estado da viatura descrito acima, os pertences deixados e autoriza o diagnóstico.
        Nenhuma reparação é feita sem o cliente aceitar o orçamento.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-8">
        <SignatureLine label="Cliente — nome legível e assinatura" />
        <SignatureLine label="Mecânico" />
        <SignatureLine label="Data e hora" />
      </div>
    </DocumentShell>
    </div>
  );
}

/** Ficha preenchida em papel e digitalizada, com os dados transcritos para o sistema. */
function FichaDigitalizada({ processo }: { processo: ProcessoDetalhado }) {
  const f = processo.fichaRecepcao;
  const { data: anexos = [] } = useAnexos(processo.id);
  const { data: utilizadores = [] } = useUtilizadores();
  const paginas = (f.digitalizacaoIds ?? []).map((id) => anexos.find((a) => a.id === id)).filter((a): a is Anexo => !!a);
  const quem = utilizadores.find((u) => u.id === f.digitalizadaPorId)?.nome;
  return (
    <div className="mx-auto max-w-[210mm] space-y-4 rounded-lg border border-linha bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linha pb-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-mzd-red">Ficha de entrada assinada</h2>
          <p className="text-xs text-mzd-gray">Digitalizada {f.digitalizadaEm && formatDateTime(f.digitalizadaEm)}{quem && ` por ${quem}`} · {paginas.length} página(s)</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <Field label="Quilometragem" value={f.km !== undefined ? `${f.km.toLocaleString('pt-PT')} km` : '—'} />
          <Field label="Combustível" value={f.combustivel !== undefined ? `${f.combustivel}%` : '—'} />
          <Field label="Pertences" value={f.pertences ?? '—'} />
        </dl>
      </div>
      {paginas.map((a, i) => <Pagina key={a.id} anexo={a} n={i + 1} />)}
      {paginas.length === 0 && <p className="text-sm text-mzd-gray">A carregar as páginas…</p>}
    </div>
  );
}

function Pagina({ anexo, n }: { anexo: Anexo; n: number }) {
  const url = useUrlAnexo(anexo);
  if (anexo.tipo === 'documento' && anexo.nome.toLowerCase().endsWith('.pdf')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-linha px-4 py-3 text-sm font-semibold text-mzd-black hover:border-zinc-400">
        <ExternalLink size={15} /> Página {n} — abrir PDF ({anexo.nome})
      </a>
    );
  }
  return <ImagemAnexo anexo={anexo} alt={`Ficha de entrada, página ${n}`} className="w-full rounded border border-linha" />;
}

/** Processos antigos: ficha preenchida no ecrã, com assinatura digital. */
function FichaNoEcra({ processo }: { processo: ProcessoDetalhado }) {
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
        <Field label="Quilometragem" value={f.km !== undefined ? `${f.km.toLocaleString('pt-PT')} km` : '—'} />
      </div>

      <SectionTitle>Queixa Relatada pelo Cliente</SectionTitle>
      <p className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm">{f.queixaCliente}</p>

      <SectionTitle>Estado de Entrada</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Field label="Nível de combustível" value={f.combustivel !== undefined ? `${f.combustivel}%` : '—'} />
        <Field label="Estado da bateria" value={f.bateria === 'boa' ? 'Boa' : f.bateria === 'fraca' ? 'Fraca' : f.bateria === 'a_testar' ? 'A testar' : '—'} />
        <Field label="Pertences deixados" value={f.pertences} />
      </div>

      <SectionTitle>Mapa de Riscos / Danos Visuais</SectionTitle>
      <div className="mb-5">
        <MapaDanos danos={f.danos ?? []} soLeitura />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <SignatureLine label="Assinatura do Cliente — confirma o estado acima descrito" processoId={processo.id} anexoId={f.assinaturaAnexoId} />
        <SignatureLine label="Rececionista responsável" />
      </div>
    </DocumentShell>
  );
}

/** Botão para abrir o modelo da ficha (ou outro documento) numa página própria, pronta a imprimir. */
export function LinkImprimir({ processoId, documento, children }: { processoId: string; documento: 'ficha' | 'diagnostico' | 'proforma'; children: string }) {
  return (
    <a href={`/processos/${processoId}/imprimir/${documento}`} target="_blank" rel="noopener noreferrer" className={botao('secundario')}>
      <Printer size={15} /> {children}
    </a>
  );
}
