import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Ban, CornerDownRight, Send } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useMensagens, useProcesso } from '../api/hooks';
import { api } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { ESTADOS_ORDEM, ESTADO_LABEL, estaAtivo } from '../types';
import PainelEtapa from './processo/PainelEtapa';
import Fotos from './processo/Fotos';
import { modeloDaEtapa } from '../lib/mensagens';
import ComporMensagem from '../components/comunicacoes/ComporMensagem';
import ListaMensagens from '../components/comunicacoes/ListaMensagens';
import RegistarResposta from '../components/comunicacoes/RegistarResposta';
import LinkPortal from '../components/comunicacoes/LinkPortal';
import type { ProcessoDetalhado } from '../types';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Matricula from '../components/ui/Matricula';
import Kz from '../components/ui/Kz';
import Tabs from '../components/ui/Tabs';
import Modal from '../components/ui/Modal';
import { Aviso } from '../components/ui/Controls';
import { Field, Textarea } from '../components/ui/Form';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { useToast } from '../components/ui/toast-context';
import { Carregando, ErroCarregamento, Vazio } from '../components/ui/Estados';
import { mensagemErro } from '../lib/erros';
import { formatDate, formatDateTime, diasEntre } from '../lib/format';
import { calcularTotais } from '../lib/calculos';
import { TOM_ESTADO } from '../lib/estados';

import FichaRecepcaoDoc from '../documents/FichaRecepcaoDoc';
import DiagnosticoDoc from '../documents/DiagnosticoDoc';
import OrcamentoDoc from '../documents/OrcamentoDoc';
import AutorizacaoDoc from '../documents/AutorizacaoDoc';
import ChecklistQualidadeDoc from '../documents/ChecklistQualidadeDoc';
import RelatorioServicosDoc from '../documents/RelatorioServicosDoc';
import FaturaDoc from '../documents/FaturaDoc';

const URGENCIA_LABEL = { baixo: 'Baixa', medio: 'Média', alto: 'Alta', seguranca: 'Risco de segurança' } as const;
const ORCAMENTO_LABEL = { rascunho: 'Em preparação', enviado: 'Enviado ao cliente', aprovado: 'Aprovado', recusado: 'Recusado' } as const;

export default function ProcessoDetail() {
  const { id = '' } = useParams();
  const { data: processo, isPending, error, refetch } = useProcesso(id);
  const cancelar = useAcaoProcesso();
  const { can } = useAuth();
  const toast = useToast();
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  if (isPending) return <Carregando />;
  if (error || !processo) {
    return (
      <div>
        <ErroCarregamento erro={error} onRepetir={refetch} />
        <p className="text-center">
          <Link to="/processos" className="text-sm font-semibold text-mzd-black underline underline-offset-4">Voltar aos processos</Link>
        </p>
      </div>
    );
  }

  const { cliente, viatura, mecanico } = processo;
  const ativo = estaAtivo(processo.estado);
  const atrasado = ativo && diasEntre(processo.prazoEntrega) > 0;
  const verValores = can('valores.ver');

  function confirmarCancelamento() {
    cancelar.mutate(
      () => api.processos.cancelar(processo!.id, motivo),
      {
        onSuccess: () => {
          toast('Processo cancelado');
          setCancelarOpen(false);
          setMotivo('');
        },
        onError: (e) => toast(mensagemErro(e), 'erro'),
      }
    );
  }

  return (
    <div className="pagina space-y-5">
      <PageHeader
        voltar={{ to: '/processos', label: 'Processos' }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <Matricula valor={viatura.matricula} tamanho="lg" />
            <span>{viatura.marca} {viatura.modelo}</span>
          </span>
        }
        extra={
          <span className="flex items-center gap-2">
            <StatusBadge estado={processo.estado} />
            {processo.urgente && <span className="rotulo rounded bg-sinal-vermelho-fundo px-2 py-[3px] !text-sinal-vermelho">Urgente</span>}
          </span>
        }
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num font-medium text-mzd-black">{processo.numero}</span>
            <span aria-hidden>·</span>
            {can('clientes.ver') ? (
              <Link to={`/clientes/${cliente.id}`} className="font-medium text-mzd-black underline-offset-4 hover:underline">{cliente.nome}</Link>
            ) : (
              <span>{cliente.nome}</span>
            )}
            <span aria-hidden>·</span>
            <span>Mecânico: {mecanico?.nome ?? 'por atribuir'}</span>
          </span>
        }
        acoes={
          <>
            {ativo && can('processos.cancelar') && (
              <Button variante="secundario" icone={<Ban size={15} />} onClick={() => setCancelarOpen(true)}>Cancelar processo</Button>
            )}
          </>
        }
      />

      {processo.estado === 'cancelado' && processo.cancelamento && (
        <Aviso tom="neutro">
          <p className="font-semibold">Cancelado em {formatDateTime(processo.cancelamento.data)}</p>
          <p className="text-mzd-gray">{processo.cancelamento.motivo} · parou em "{ESTADO_LABEL[processo.cancelamento.estadoAnterior]}"</p>
        </Aviso>
      )}
      {atrasado && (
        <Aviso tom="vermelho">
          Prazo de entrega ultrapassado há <strong>{diasEntre(processo.prazoEntrega)} dia(s)</strong> — prometido para {formatDate(processo.prazoEntrega)}.
        </Aviso>
      )}

      <ProgressoEtapas processo={processo} atrasado={atrasado} />

      <PainelEtapa processo={processo} />

      <Tabs
        tabs={[
          { id: 'visao', label: 'Resumo', content: <VisaoGeral processo={processo} verValores={verValores} /> },
          { id: 'docs', label: 'Documentos', content: <Documentos processo={processo} verValores={verValores} /> },
          { id: 'fotos', label: 'Fotos', content: <Card className="p-5"><Fotos processoId={processo.id} podeEnviar={ativo} /></Card> },
          { id: 'historico', label: 'Histórico', badge: processo.historico.length, content: <Historico processo={processo} /> },
          { id: 'pecas', label: 'Peças', content: <PecasTab processo={processo} verValores={verValores} /> },
          ...(can('mensagens.enviar') ? [{ id: 'comunicacoes', label: 'Comunicações', content: <Comunicacoes processo={processo} /> }] : []),
        ]}
      />

      <Modal
        open={cancelarOpen}
        onClose={() => setCancelarOpen(false)}
        title="Cancelar processo"
        footer={
          <>
            <Button variante="fantasma" onClick={() => setCancelarOpen(false)}>Voltar</Button>
            <Button variante="perigo" onClick={confirmarCancelamento} carregando={cancelar.isPending} disabled={motivo.trim().length < 5}>
              Cancelar processo
            </Button>
          </>
        }
      >
        <Field label="Motivo do cancelamento" hint="O motivo alimenta os relatórios de orçamentos recusados. O cancelamento não pode ser desfeito.">
          {(a11y) => (
            <Textarea {...a11y} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente recusou o orçamento por preço elevado" />
          )}
        </Field>
      </Modal>
    </div>
  );
}

/** Régua grande com o nome de cada etapa, e data de passagem nas etapas concluídas. */
function ProgressoEtapas({ processo, atrasado }: { processo: ProcessoDetalhado; atrasado: boolean }) {
  const cancelado = processo.estado === 'cancelado';
  const ref = cancelado ? processo.cancelamento?.estadoAnterior ?? 'recepcao' : processo.estado;
  const idx = ESTADOS_ORDEM.indexOf(ref);
  const dataEtapa = (e: string) => processo.historico.find((h) => h.estado === e)?.data;
  const tom = TOM_ESTADO[processo.estado];

  return (
    <Card className="no-print overflow-x-auto">
      <ol className="grid min-w-[760px] grid-cols-8">
        {ESTADOS_ORDEM.map((estado, i) => {
          const feito = i < idx || (processo.estado === 'entregue' && i === idx);
          const atual = i === idx && !feito;
          const data = dataEtapa(estado) ?? (i === 0 ? processo.criadoEm : undefined);
          return (
            <li key={estado} className="px-3 py-3.5" aria-current={atual ? 'step' : undefined}>
              <span
                className={clsx(
                  'block h-[5px] rounded-[1px]',
                  cancelado
                    ? i <= idx ? 'bg-zinc-300' : 'bg-zinc-100'
                    : feito
                      ? 'bg-mzd-black'
                      : atual
                        ? atrasado ? 'bg-mzd-red' : tom === 'espera' ? 'bg-sinal-ambar' : tom === 'pronto' ? 'bg-sinal-verde' : 'bg-mzd-black'
                        : 'bg-zinc-200'
                )}
              />
              <p className="num mt-2 text-[10.5px] text-mzd-gray">{String(i + 1).padStart(2, '0')}</p>
              <p className={clsx('text-[12px] font-semibold leading-tight', feito || atual ? 'text-mzd-black' : 'text-zinc-400')}>{ESTADO_LABEL[estado]}</p>
              <p className="num mt-0.5 h-4 text-[10.5px] text-mzd-gray">
                {feito && data ? formatDate(data).slice(0, 5) : atual && !cancelado ? 'atual' : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Dado({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="rotulo">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-mzd-black">{children}</dd>
    </div>
  );
}

function VisaoGeral({ processo, verValores }: { processo: ProcessoDetalhado; verValores: boolean }) {
  const { viatura, cliente } = processo;
  const totais = calcularTotais(processo.orcamento);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Queixa do cliente" subtitle={`Registada na receção a ${formatDateTime(processo.fichaRecepcao.dataHora)}`} />
        <p className="px-5 py-4 text-[15px] leading-relaxed text-mzd-black">“{processo.fichaRecepcao.queixaCliente}”</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-linha px-5 py-4 md:grid-cols-3">
          <Dado label="Cliente">{cliente.nome}</Dado>
          <Dado label="Telefone"><span className="num">{cliente.telefone}</span></Dado>
          <Dado label="NIF"><span className="num">{cliente.nif ?? '—'}</span></Dado>
          <Dado label="Viatura">{viatura.marca} {viatura.modelo} · {viatura.ano}</Dado>
          <Dado label="Cor">{viatura.cor}</Dado>
          <Dado label="Km na receção"><span className="num">{processo.fichaRecepcao.km.toLocaleString('pt-PT')}</span></Dado>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Situação" />
        <dl className="space-y-4 px-5 py-4">
          <Dado label="Na oficina há"><span className="num">{diasEntre(processo.criadoEm)}</span> dias</Dado>
          <Dado label="Prazo de entrega"><span className="num">{formatDate(processo.prazoEntrega)}</span></Dado>
          <Dado label="Aguarda peças">{processo.aguardaPecas ? <span className="text-sinal-ambar">Sim</span> : 'Não'}</Dado>
          <Dado label="Urgência do diagnóstico">{processo.diagnostico ? URGENCIA_LABEL[processo.diagnostico.urgencia] : '—'}</Dado>
          <Dado label="Orçamento">
            {processo.orcamento ? ORCAMENTO_LABEL[processo.orcamento.estado] : '—'}
            {verValores && totais.total > 0 && <> · <Kz valor={totais.total} /></>}
          </Dado>
        </dl>
      </Card>
    </div>
  );
}

function Documentos({ processo, verValores }: { processo: ProcessoDetalhado; verValores: boolean }) {
  const docs = [
    { id: 'ficha', label: 'Ficha de Receção', pronto: true, render: <FichaRecepcaoDoc processo={processo} /> },
    { id: 'diag', label: 'Diagnóstico', pronto: !!processo.diagnostico, render: <DiagnosticoDoc processo={processo} /> },
    { id: 'orc', label: 'Orçamento / Pró-forma', valores: true, pronto: !!processo.orcamento, render: <OrcamentoDoc processo={processo} /> },
    { id: 'aut', label: 'Declaração de Autorização', valores: true, pronto: !!processo.autorizacao, render: <AutorizacaoDoc processo={processo} /> },
    { id: 'cq', label: 'Controlo de Qualidade', pronto: !!processo.checklistQualidade, render: <ChecklistQualidadeDoc processo={processo} /> },
    { id: 'rel', label: 'Relatório de Serviços', pronto: !!processo.checklistQualidade, render: <RelatorioServicosDoc processo={processo} /> },
    { id: 'fat', label: 'Fatura / Recibo + Garantia', valores: true, pronto: !!processo.fatura, render: <FaturaDoc processo={processo} /> },
  ].filter((d) => verValores || !d.valores);
  const [ativo, setAtivo] = useState(docs[0].id);
  const atual = docs.find((d) => d.id === ativo) ?? docs[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[230px_1fr]">
      <nav className="no-print flex gap-1 overflow-x-auto lg:flex-col" aria-label="Documentos do processo">
        {docs.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setAtivo(d.id)}
            aria-current={atual.id === d.id}
            className={clsx(
              'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors',
              atual.id === d.id ? 'bg-mzd-black text-white' : 'text-mzd-black hover:bg-zinc-100'
            )}
          >
            <span className={clsx('num text-[11px]', atual.id === d.id ? 'text-zinc-400' : 'text-mzd-gray')}>{i + 1}</span>
            <span className="flex-1">{d.label}</span>
            <span
              className={clsx('h-1.5 w-1.5 rounded-full', d.pronto ? (atual.id === d.id ? 'bg-white' : 'bg-mzd-black') : 'bg-zinc-300')}
              title={d.pronto ? 'Disponível' : 'Ainda por preencher'}
            />
          </button>
        ))}
      </nav>
      <div className="min-w-0">{atual.render}</div>
    </div>
  );
}

function Historico({ processo }: { processo: ProcessoDetalhado }) {
  const eventos = [...processo.historico].reverse();
  return (
    <Card>
      <CardHeader title="Linha do tempo" subtitle="Registo de auditoria — quem fez o quê e quando" />
      <ol className="px-5 py-4">
        {eventos.map((h, i) => (
          <li key={h.id} className="grid grid-cols-[92px_16px_1fr] gap-x-3">
            <p className="num pt-0.5 text-right text-[11.5px] leading-tight text-mzd-gray">
              {formatDate(h.data).slice(0, 5)}
              <br />
              {new Date(h.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex flex-col items-center">
              <span className={clsx('mt-1.5 h-2 w-2 rounded-[1px]', h.tipo === 'rejeicao' || h.tipo === 'cancelamento' ? 'bg-mzd-red' : i === 0 ? 'bg-mzd-black' : 'bg-zinc-400')} />
              {i < eventos.length - 1 && <span className="w-px flex-1 bg-linha" />}
            </div>
            <div className="pb-5">
              <p className="text-[13.5px] font-medium text-mzd-black">{h.descricao}</p>
              <p className="text-xs text-mzd-gray">{h.autor}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PecasTab({ processo, verValores }: { processo: ProcessoDetalhado; verValores: boolean }) {
  const pecasOrc = processo.orcamento?.pecas ?? [];
  return (
    <Card>
      <CardHeader title="Peças do processo" subtitle="Peças incluídas no orçamento" />
      <Table>
        <thead>
          <tr>
            <Th>Descrição</Th>
            <Th direita>Qtd.</Th>
            {verValores && <Th direita>Preço unit.</Th>}
            {verValores && <Th direita>Subtotal</Th>}
          </tr>
        </thead>
        <tbody>
          {pecasOrc.map((p, i) => (
            <Tr key={i}>
              <Td className="font-medium text-mzd-black">{p.descricao}</Td>
              <Td direita num>{p.quantidade}</Td>
              {verValores && <Td direita><Kz valor={p.precoUnitario} className="text-mzd-gray" /></Td>}
              {verValores && <Td direita><Kz valor={p.quantidade * p.precoUnitario} className="font-semibold" /></Td>}
            </Tr>
          ))}
          {pecasOrc.length === 0 && <LinhaVazia colunas={4}>Ainda não há peças associadas — são adicionadas no orçamento.</LinhaVazia>}
        </tbody>
      </Table>
    </Card>
  );
}

function Comunicacoes({ processo }: { processo: ProcessoDetalhado }) {
  const { data: mensagens, isPending } = useMensagens({ processoId: processo.id });
  const [aberto, setAberto] = useState<'mensagem' | 'resposta' | null>(null);
  const { cliente } = processo;
  return (
    <div className="space-y-4">
    <LinkPortal processo={processo} />
    <Card>
      <CardHeader
        title="Mensagens com o cliente"
        subtitle={cliente.consentimentoMensagens ? `${cliente.nome} · ${cliente.telefone}${cliente.email ? ` · ${cliente.email}` : ''}` : 'O cliente não autorizou mensagens'}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variante="secundario" tamanho="sm" icone={<CornerDownRight size={13} />} onClick={() => setAberto('resposta')}>Registar resposta</Button>
            <Button tamanho="sm" icone={<Send size={13} />} onClick={() => setAberto('mensagem')} disabled={!cliente.consentimentoMensagens}>Nova mensagem</Button>
          </div>
        }
      />
      {isPending ? <Carregando /> : mensagens?.length ? <ListaMensagens mensagens={mensagens} /> : (
        <Vazio titulo="Ainda sem mensagens">As mensagens enviadas ao cliente sobre este processo ficam registadas aqui.</Vazio>
      )}
      {aberto === 'mensagem' && <ComporMensagem alvo={{ processoId: processo.id }} modeloInicial={modeloDaEtapa(processo)} onFechar={() => setAberto(null)} />}
      {aberto === 'resposta' && <RegistarResposta processoId={processo.id} onFechar={() => setAberto(null)} />}
    </Card>
    </div>
  );
}
