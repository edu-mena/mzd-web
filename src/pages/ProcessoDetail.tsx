import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FileText, MessageSquare, LayoutList, AlertTriangle, Send } from 'lucide-react';
import { processos, getCliente, getViatura, getUtilizador } from '../data/mock';
import { ESTADOS_ORDEM, ESTADO_LABEL } from '../types';
import type { EstadoProcesso } from '../types';
import { Card, CardHeader } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { formatAOA, formatDate, formatDateTime, orcamentoTotal, diasEntre } from '../lib/format';

import FichaRecepcaoDoc from '../documents/FichaRecepcaoDoc';
import DiagnosticoDoc from '../documents/DiagnosticoDoc';
import OrcamentoDoc from '../documents/OrcamentoDoc';
import AutorizacaoDoc from '../documents/AutorizacaoDoc';
import ChecklistQualidadeDoc from '../documents/ChecklistQualidadeDoc';
import RelatorioServicosDoc from '../documents/RelatorioServicosDoc';
import FaturaDoc from '../documents/FaturaDoc';

export default function ProcessoDetail() {
  const { id } = useParams();
  const [processo, setProcesso] = useState(() => processos.find((p) => p.id === id));
  const [avancarOpen, setAvancarOpen] = useState(false);
  const toast = useToast();

  if (!processo) {
    return (
      <div className="py-20 text-center text-mzd-gray">
        <p>Processo não encontrado.</p>
        <Link to="/processos" className="mt-2 inline-block text-sm font-semibold text-mzd-red hover:underline">← Voltar aos processos</Link>
      </div>
    );
  }

  const cliente = getCliente(processo.clienteId);
  const viatura = getViatura(processo.viaturaId);
  const mecanico = getUtilizador(processo.mecanicoId);
  const idxAtual = ESTADOS_ORDEM.indexOf(processo.estado);
  const proximoEstado = ESTADOS_ORDEM[idxAtual + 1];

  function avancarEstado() {
    if (!processo || !proximoEstado) return;
    const atualizado = {
      ...processo,
      estado: proximoEstado,
      historico: [
        ...processo.historico,
        { id: `h${processo.historico.length}`, data: new Date().toISOString(), autor: 'Você', descricao: `Processo avançou para "${ESTADO_LABEL[proximoEstado]}"`, tipo: 'estado' as const },
      ],
    };
    setProcesso(atualizado);
    setAvancarOpen(false);
    toast(`Processo avançado para "${ESTADO_LABEL[proximoEstado]}"`);
  }

  return (
    <div className="space-y-5">
      <Link to="/processos" className="no-print flex items-center gap-1.5 text-sm font-semibold text-mzd-gray hover:text-mzd-black">
        <ArrowLeft size={15} /> Processos
      </Link>

      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-mzd-black">{processo.numero}</h1>
            <StatusBadge estado={processo.estado} />
            {processo.urgente && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-mzd-red ring-1 ring-red-200">
                <AlertTriangle size={11} /> Urgente
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-mzd-gray">
            {cliente.nome} · {viatura.matricula} — {viatura.marca} {viatura.modelo} ({viatura.ano}) · Mecânico: {mecanico?.nome ?? '—'}
          </p>
        </div>
        {proximoEstado && (
          <button
            onClick={() => setAvancarOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-mzd-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-mzd-redDark"
          >
            Avançar para "{ESTADO_LABEL[proximoEstado]}" <ChevronRight size={15} />
          </button>
        )}
      </div>

      <ProgressoEtapas estadoAtual={processo.estado} />

      <Tabs
        tabs={[
          { id: 'visao', label: 'Visão Geral', icon: LayoutList, content: <VisaoGeral processo={processo} /> },
          { id: 'docs', label: 'Documentos', badge: 7, content: <Documentos processo={processo} /> },
          { id: 'historico', label: 'Histórico', badge: processo.historico.length, content: <Historico processo={processo} /> },
          { id: 'pecas', label: 'Peças', content: <PecasTab processo={processo} /> },
          { id: 'comunicacoes', label: 'Comunicações', content: <Comunicacoes processo={processo} cliente={cliente} /> },
        ] as any}
      />

      <Modal
        open={avancarOpen}
        onClose={() => setAvancarOpen(false)}
        title="Confirmar avanço de estado"
        footer={
          <>
            <button onClick={() => setAvancarOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-mzd-gray hover:bg-zinc-100">Cancelar</button>
            <button onClick={avancarEstado} className="rounded-lg bg-mzd-red px-4 py-2 text-sm font-semibold text-white hover:bg-mzd-redDark">Confirmar</button>
          </>
        }
      >
        <p className="text-sm text-mzd-black">
          Avançar o processo <strong>{processo.numero}</strong> de <strong>{ESTADO_LABEL[processo.estado]}</strong> para{' '}
          <strong>{proximoEstado && ESTADO_LABEL[proximoEstado]}</strong>?
        </p>
        <p className="mt-2 text-xs text-mzd-gray">Esta ação fica registada no histórico do processo com o seu nome e a data/hora atuais.</p>
      </Modal>
    </div>
  );
}

function ProgressoEtapas({ estadoAtual }: { estadoAtual: EstadoProcesso }) {
  const idx = ESTADOS_ORDEM.indexOf(estadoAtual);
  return (
    <Card className="no-print overflow-x-auto p-4">
      <div className="flex min-w-[720px] items-center">
        {ESTADOS_ORDEM.map((estado, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={estado} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                    done ? 'bg-mzd-black text-white' : current ? 'bg-mzd-red text-white ring-4 ring-red-100' : 'bg-zinc-100 text-mzd-gray'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`w-20 text-center text-[10px] font-semibold leading-tight ${current ? 'text-mzd-red' : done ? 'text-mzd-black' : 'text-mzd-gray'}`}>
                  {ESTADO_LABEL[estado]}
                </span>
              </div>
              {i < ESTADOS_ORDEM.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${done ? 'bg-mzd-black' : 'bg-zinc-200'}`} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function VisaoGeral({ processo }: { processo: (typeof processos)[number] }) {
  const viatura = getViatura(processo.viaturaId);
  const cliente = getCliente(processo.clienteId);
  const total = orcamentoTotal(processo.orcamento);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Resumo do Processo" />
        <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm md:grid-cols-3">
          <Info label="Cliente" value={cliente.nome} />
          <Info label="Telefone" value={cliente.telefone} />
          <Info label="NIF" value={cliente.nif} />
          <Info label="Viatura" value={`${viatura.marca} ${viatura.modelo}`} />
          <Info label="Matrícula" value={viatura.matricula} />
          <Info label="Ano / Cor" value={`${viatura.ano} · ${viatura.cor}`} />
          <Info label="Receção" value={formatDate(processo.criadoEm)} />
          <Info label="Prazo de entrega" value={formatDate(processo.prazoEntrega)} />
          <Info label="Valor do orçamento" value={total ? formatAOA(total) : '—'} />
        </div>
        <div className="border-t border-zinc-100 px-5 py-4">
          <p className="mb-1 text-xs font-bold uppercase text-mzd-gray">Queixa relatada</p>
          <p className="text-sm text-mzd-black">{processo.fichaRecepcao.queixaCliente}</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Indicadores" />
        <div className="space-y-3 px-5 py-4">
          <Info label="Dias em oficina" value={`${diasEntre(processo.criadoEm)} dias`} />
          <Info label="Aguarda peças" value={processo.aguardaPecas ? 'Sim' : 'Não'} />
          <Info label="Urgência do diagnóstico" value={processo.diagnostico?.urgencia ?? '—'} />
          <Info label="Estado do orçamento" value={processo.orcamento?.estado ?? '—'} />
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-mzd-gray">{label}</p>
      <p className="font-medium text-mzd-black">{value}</p>
    </div>
  );
}

function Documentos({ processo }: { processo: (typeof processos)[number] }) {
  const docs = [
    { id: 'ficha', label: 'Ficha de Receção', icon: FileText, render: <FichaRecepcaoDoc processo={processo} /> },
    { id: 'diag', label: 'Documento de Diagnóstico', icon: FileText, render: <DiagnosticoDoc processo={processo} /> },
    { id: 'orc', label: 'Orçamento / Fatura Pró-forma', icon: FileText, render: <OrcamentoDoc processo={processo} /> },
    { id: 'aut', label: 'Declaração de Autorização', icon: FileText, render: <AutorizacaoDoc processo={processo} /> },
    { id: 'cq', label: 'Checklist de Controlo de Qualidade', icon: FileText, render: <ChecklistQualidadeDoc processo={processo} /> },
    { id: 'rel', label: 'Relatório de Serviços Executados', icon: FileText, render: <RelatorioServicosDoc processo={processo} /> },
    { id: 'fat', label: 'Fatura / Recibo + Garantia', icon: FileText, render: <FaturaDoc processo={processo} /> },
  ];
  const [ativo, setAtivo] = useState(docs[0].id);
  const atual = docs.find((d) => d.id === ativo)!;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <div className="no-print space-y-1">
        {docs.map((d) => (
          <button
            key={d.id}
            onClick={() => setAtivo(d.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
              ativo === d.id ? 'bg-mzd-black text-white' : 'bg-white text-mzd-black ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <FileText size={14} className="shrink-0" /> {d.label}
          </button>
        ))}
      </div>
      <div>{atual.render}</div>
    </div>
  );
}

function Historico({ processo }: { processo: (typeof processos)[number] }) {
  return (
    <Card>
      <CardHeader title="Linha do Tempo do Processo" subtitle="Registo de auditoria — quem fez o quê e quando" />
      <div className="space-y-0 px-5 py-4">
        {[...processo.historico].reverse().map((h, i) => (
          <div key={h.id} className="flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${h.tipo === 'rejeicao' ? 'bg-mzd-red' : 'bg-mzd-black'}`} />
              {i < processo.historico.length - 1 && <span className="mt-1 w-px flex-1 bg-zinc-200" />}
            </div>
            <div className="pb-1">
              <p className="text-sm font-semibold text-mzd-black">{h.descricao}</p>
              <p className="text-xs text-mzd-gray">{h.autor} · {formatDateTime(h.data)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PecasTab({ processo }: { processo: (typeof processos)[number] }) {
  const pecasOrc = processo.orcamento?.pecas ?? [];
  return (
    <Card>
      <CardHeader title="Peças do Processo" subtitle="Ligadas ao orçamento — baixa automática de stock ao aprovar" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
              <th className="px-5 py-2.5">Descrição</th>
              <th className="px-5 py-2.5">Qtd.</th>
              <th className="px-5 py-2.5">Preço Unit.</th>
              <th className="px-5 py-2.5">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pecasOrc.map((p, i) => (
              <tr key={i} className="border-b border-zinc-50 last:border-0">
                <td className="px-5 py-3 font-medium text-mzd-black">{p.descricao}</td>
                <td className="px-5 py-3 text-mzd-gray">{p.quantidade}</td>
                <td className="px-5 py-3 text-mzd-gray">{formatAOA(p.precoUnitario)}</td>
                <td className="px-5 py-3 font-semibold text-mzd-black">{formatAOA(p.quantidade * p.precoUnitario)}</td>
              </tr>
            ))}
            {pecasOrc.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-mzd-gray">Nenhuma peça associada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Comunicacoes({ processo, cliente }: { processo: (typeof processos)[number]; cliente: ReturnType<typeof getCliente> }) {
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const eventosComunicacao = [
    { canal: 'WhatsApp', texto: `Olá ${cliente.nome.split(' ')[0]}, o diagnóstico da sua viatura ${processo.numero} está pronto.`, data: processo.criadoEm },
  ];
  return (
    <Card>
      <CardHeader title="Comunicações com o Cliente" subtitle="Notificações automáticas nas transições-chave" />
      <div className="space-y-3 px-5 py-4">
        {eventosComunicacao.map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-50 p-3">
            <MessageSquare size={16} className="mt-0.5 shrink-0 text-mzd-red" />
            <div>
              <p className="text-sm text-mzd-black">{e.texto}</p>
              <p className="mt-0.5 text-xs text-mzd-gray">{e.canal} · {formatDateTime(e.data)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Escrever mensagem para o cliente…"
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
        />
        <button
          onClick={() => { if (msg.trim()) { toast('Mensagem enviada ao cliente'); setMsg(''); } }}
          className="flex items-center gap-1.5 rounded-lg bg-mzd-red px-3.5 py-2 text-sm font-semibold text-white hover:bg-mzd-redDark"
        >
          <Send size={14} /> Enviar
        </button>
      </div>
    </Card>
  );
}
