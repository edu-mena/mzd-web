import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronRight, ClipboardCheck, FileText, MessageCircle, Stethoscope, Wallet, KeyRound, Lock } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useAlterarFinanceiro, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import { PERMISSAO_ETAPA, PERMISSOES_POR_PERFIL } from '../../auth/permissions';
import type { ProcessoDetalhado } from '../../types';
import { ESTADO_LABEL, ESTADOS_ORDEM, PERFIL_LABEL, SISTEMAS_VEICULO } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import { Field, Select, Textarea } from '../../components/ui/Form';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { calcularTotais, emDivida, recebidoProcesso, totalFaturavel } from '../../lib/calculos';
import { formatDateTime } from '../../lib/format';
import { modeloDaEtapa } from '../../lib/mensagens';
import ComporMensagem from '../../components/comunicacoes/ComporMensagem';
import FormDiagnostico from './FormDiagnostico';
import { FormOrcamento } from './FormOrcamento';
import { FormAprovacao } from './FormAprovacao';
import FormQualidade from './FormQualidade';
import { FormEntrega, FormPagamento } from './FormPagamentoEntrega';
import Reparacao from './Reparacao';

type Aberto = 'diagnostico' | 'orcamento' | 'aprovacao' | 'qualidade' | 'pagamento' | 'entrega' | 'mensagem' | null;

const DESCRICAO: Partial<Record<ProcessoDetalhado['estado'], string>> = {
  recepcao: 'Atribua o mecânico responsável e inicie o diagnóstico.',
  diagnostico: 'O mecânico inspeciona cada sistema e regista o que encontrou, com fotografias.',
  orcamentacao: 'Orçamente as peças e a mão de obra a partir do diagnóstico e envie ao cliente.',
  aguarda_aprovacao: 'O cliente decide sobre o diagnóstico e o orçamento. Registe a decisão assim que a tiver.',
  em_reparacao: 'Execute as tarefas aprovadas. Registe o tempo e qualquer trabalho adicional encontrado.',
  controlo_qualidade: 'Verifique o trabalho e os itens de segurança antes de a viatura ficar pronta.',
  pronta_entrega: 'Receba o pagamento em falta e entregue a viatura com a assinatura do cliente.',
};

/** Painel "Próximo passo": o que falta na etapa atual, quem pode agir e as ações disponíveis. */
export default function PainelEtapa({ processo }: { processo: ProcessoDetalhado }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [aberto, setAberto] = useState<Aberto>(null);
  const financeiro = useAlterarFinanceiro<{ id: string }>();
  const [motivoRecusa, setMotivoRecusa] = useState<string | null>(null);
  const p = processo;
  const verValores = can('valores.ver');

  if (p.estado === 'cancelado') return null;
  if (p.estado === 'entregue') return <Entregue processo={p} />;

  const perm = PERMISSAO_ETAPA[p.estado];
  const podeEtapa = !!perm && can(perm);
  const quemPode = perm
    ? (Object.keys(PERMISSOES_POR_PERFIL) as (keyof typeof PERMISSOES_POR_PERFIL)[])
        .filter((pf) => pf !== 'admin' && pf !== 'direcao' && PERMISSOES_POR_PERFIL[pf].includes(perm))
        .map((pf) => PERFIL_LABEL[pf])
    : [];
  const proximo = ESTADOS_ORDEM[ESTADOS_ORDEM.indexOf(p.estado) + 1];

  function decidirDesconto(decisao: 'aprovado' | 'recusado', motivo?: string) {
    if (decisao === 'recusado' && motivo === undefined) return setMotivoRecusa('');
    financeiro.mutate(() => api.financeiro.decidirDesconto(p.id, decisao, motivo), {
      onSuccess: () => { toast(decisao === 'aprovado' ? 'Desconto aprovado' : 'Desconto recusado'); setMotivoRecusa(null); },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  function avancar(sucesso: string) {
    acao.mutate(() => api.processos.avancar(p.id), {
      onSuccess: () => toast(sucesso),
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  const mecanicoBloqueado = user?.perfil === 'mecanico' && p.mecanicoId !== user.id;
  const zap = can('mensagens.enviar') && p.cliente.consentimentoMensagens
    ? <Button variante="secundario" icone={<MessageCircle size={15} />} onClick={() => setAberto('mensagem')}>Avisar o cliente</Button>
    : null;

  let requisitos: { ok: boolean; texto: ReactNode }[] = [];
  let acoes: ReactNode = null;
  let corpo: ReactNode = null;

  switch (p.estado) {
    case 'recepcao':
      requisitos = [
        { ok: !!p.fichaRecepcao.assinaturaCliente, texto: 'Ficha de receção assinada pelo cliente' },
        { ok: !!p.mecanicoId, texto: p.mecanico ? `Mecânico atribuído: ${p.mecanico.nome}` : 'Mecânico atribuído' },
      ];
      corpo = can('processos.atribuir') && <AtribuirMecanico processo={p} />;
      acoes = can('processos.atribuir') && (
        <Button onClick={() => avancar('Diagnóstico iniciado')} carregando={acao.isPending} disabled={!p.mecanicoId}>
          Iniciar diagnóstico <ChevronRight size={15} />
        </Button>
      );
      break;
    case 'diagnostico': {
      const avaliados = p.diagnostico?.itens.length ?? 0;
      requisitos = [
        { ok: avaliados >= SISTEMAS_VEICULO.length, texto: `Sistemas avaliados: ${avaliados}/${SISTEMAS_VEICULO.length}` },
        { ok: (p.diagnostico?.parecerGeral.length ?? 0) >= 10, texto: 'Parecer técnico escrito' },
      ];
      corpo = can('processos.atribuir') && <AtribuirMecanico processo={p} />;
      acoes = can('diagnostico.editar') && (
        mecanicoBloqueado
          ? <p className="text-xs text-mzd-gray">Atribuído a {p.mecanico?.nome}.</p>
          : <Button icone={<Stethoscope size={15} />} onClick={() => setAberto('diagnostico')}>{avaliados ? 'Continuar diagnóstico' : 'Fazer diagnóstico'}</Button>
      );
      break;
    }
    case 'orcamentacao': {
      const linhas = (p.orcamento?.pecas.length ?? 0) + (p.orcamento?.maoObra.length ?? 0);
      const desconto = p.orcamento?.desconto;
      const descontoBloqueia = desconto?.estado === 'pendente' || desconto?.estado === 'recusado';
      requisitos = [{ ok: linhas > 0, texto: linhas ? <>Orçamento com {linhas} linha(s){verValores && <> · <Kz valor={calcularTotais(p.orcamento).total} /></>}</> : 'Orçamento por preparar' }];
      if (desconto) {
        requisitos.push({
          ok: desconto.estado === 'aprovado',
          texto: desconto.estado === 'aprovado' ? `Desconto de ${desconto.percentagem}% aplicado`
            : desconto.estado === 'pendente' ? `Desconto de ${desconto.percentagem}% à espera da Direção`
            : `Desconto de ${desconto.percentagem}% recusado — ajuste o orçamento`,
        });
      }
      corpo = desconto?.estado === 'pendente' && can('financeiro.supervisionar') && (
        <div className="rounded-md border border-sinal-ambar bg-sinal-ambar-fundo p-4 text-sm">
          <p className="font-semibold text-mzd-black">Pedido de desconto de {desconto.percentagem}%</p>
          <p className="mt-0.5 text-mzd-gray">{desconto.motivo}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variante="secundario" tamanho="sm" onClick={() => decidirDesconto('recusado')}>Recusar</Button>
            <Button tamanho="sm" onClick={() => decidirDesconto('aprovado')} carregando={financeiro.isPending}>Aprovar desconto</Button>
          </div>
        </div>
      );
      acoes = can('orcamento.editar') && verValores && (
        <>
          <Button variante={linhas ? 'secundario' : 'primario'} icone={<FileText size={15} />} onClick={() => setAberto('orcamento')}>{linhas ? 'Editar orçamento' : 'Fazer orçamento'}</Button>
          {linhas > 0 && <Button onClick={() => avancar('Orçamento enviado — aguarda aprovação do cliente')} carregando={acao.isPending} disabled={descontoBloqueia}>Enviar ao cliente <ChevronRight size={15} /></Button>}
        </>
      );
      break;
    }
    case 'aguarda_aprovacao':
      requisitos = [
        { ok: true, texto: <>Enviado ao cliente {p.orcamento?.enviadoEm && formatDateTime(p.orcamento.enviadoEm)}{verValores && <> · <Kz valor={calcularTotais(p.orcamento).total} /> com IVA</>}</> },
        { ok: false, texto: 'Decisão do cliente' },
      ];
      acoes = (
        <>
          {zap}
          {can('aprovacao.registar') && <Button icone={<ClipboardCheck size={15} />} onClick={() => setAberto('aprovacao')}>Registar decisão do cliente</Button>}
        </>
      );
      break;
    case 'em_reparacao': {
      const pendentes = (p.tarefas ?? []).filter((t) => !t.feita).length;
      requisitos = [
        { ok: pendentes === 0, texto: pendentes ? `${pendentes} tarefa(s) por fazer` : 'Todas as tarefas feitas' },
        { ok: !p.aguardaPecas, texto: p.aguardaPecas ? 'À espera de peças' : 'Sem peças em falta' },
        { ok: !(p.registosTempo ?? []).some((r) => !r.fim), texto: 'Cronómetros parados' },
      ];
      corpo = <Reparacao processo={p} />;
      acoes = (
        <>
          {can('pagamentos.registar') && emDivida(p) > 0 && <Button variante="secundario" icone={<Wallet size={15} />} onClick={() => setAberto('pagamento')}>Adiantamento</Button>}
          {can('reparacao.executar') && !mecanicoBloqueado && (
            <Button onClick={() => avancar('Reparação concluída — segue para controlo de qualidade')} carregando={acao.isPending} disabled={requisitos.some((r) => !r.ok)}>
              Concluir reparação <ChevronRight size={15} />
            </Button>
          )}
        </>
      );
      break;
    }
    case 'controlo_qualidade':
      requisitos = [{ ok: false, texto: 'Checklist de qualidade por fazer' }];
      if (p.retrabalhos) requisitos.push({ ok: false, texto: `Já reprovado ${p.retrabalhos} vez(es)` });
      acoes = can('qualidade.validar') && <Button icone={<ClipboardCheck size={15} />} onClick={() => setAberto('qualidade')}>Fazer controlo de qualidade</Button>;
      break;
    case 'pronta_entrega': {
      const divida = emDivida(p);
      requisitos = [
        { ok: true, texto: <>Fatura {p.fatura?.numero} emitida{verValores && <> · <Kz valor={totalFaturavel(p)} /></>}</> },
        { ok: divida === 0, texto: divida === 0 ? 'Pago na totalidade' : verValores ? <>Falta receber <Kz valor={divida} /> (recebido <Kz valor={recebidoProcesso(p)} />)</> : 'Pagamento por concluir' },
      ];
      acoes = (
        <>
          {zap}
          {can('pagamentos.registar') && divida > 0 && <Button variante="secundario" icone={<Wallet size={15} />} onClick={() => setAberto('pagamento')}>Registar pagamento</Button>}
          {can('entrega.registar') && <Button icone={<KeyRound size={15} />} onClick={() => setAberto('entrega')} disabled={divida > 0}>Entregar viatura</Button>}
        </>
      );
      break;
    }
  }

  return (
    <Card className="no-print overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
        <div className="border-b border-linha bg-zinc-50/70 p-5 lg:border-b-0 lg:border-r">
          <p className="rotulo">Próximo passo</p>
          <h2 className="mt-1 text-lg font-extrabold leading-tight text-mzd-black">{ESTADO_LABEL[p.estado]}{proximo && <span className="font-sans text-sm font-medium text-mzd-gray"> → {ESTADO_LABEL[proximo]}</span>}</h2>
          <p className="mt-1.5 text-[13px] text-mzd-gray">{DESCRICAO[p.estado]}</p>
          <ul className="mt-4 space-y-2">
            {requisitos.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px]', r.ok ? 'bg-mzd-black text-white' : 'border-[1.5px] border-zinc-400')}>
                  {r.ok && <Check size={11} strokeWidth={3} />}
                </span>
                <span className={r.ok ? 'text-mzd-black' : 'text-mzd-gray'}>{r.texto}</span>
              </li>
            ))}
          </ul>
          {!podeEtapa && quemPode.length > 0 && (
            <p className="mt-4 flex items-start gap-1.5 text-xs text-mzd-gray">
              <Lock size={12} className="mt-0.5 shrink-0" /> Esta etapa é concluída por: {quemPode.join(', ')}.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 p-5">
          {corpo}
          {acoes && <div className="mt-auto flex flex-wrap items-center justify-end gap-2">{acoes}</div>}
          {!corpo && !acoes && <p className="text-sm text-mzd-gray">Sem ações disponíveis para o seu perfil nesta etapa.</p>}
        </div>
      </div>

      {aberto === 'diagnostico' && <FormDiagnostico processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'orcamento' && <FormOrcamento processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'aprovacao' && <FormAprovacao processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'qualidade' && <FormQualidade processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'pagamento' && <FormPagamento processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'entrega' && <FormEntrega processo={p} onFechar={() => setAberto(null)} />}
      {aberto === 'mensagem' && <ComporMensagem alvo={{ processoId: p.id }} modeloInicial={modeloDaEtapa(p)} onFechar={() => setAberto(null)} />}
      {motivoRecusa !== null && (
        <Modal
          open
          onClose={() => setMotivoRecusa(null)}
          title="Recusar desconto"
          footer={
            <>
              <Button variante="fantasma" onClick={() => setMotivoRecusa(null)}>Voltar</Button>
              <Button variante="perigo" disabled={motivoRecusa.trim().length < 3} carregando={financeiro.isPending} onClick={() => decidirDesconto('recusado', motivoRecusa.trim())}>Recusar desconto</Button>
            </>
          }
        >
          <Field label="Motivo" hint="Aparece no histórico do processo para quem pediu o desconto">
            {(a) => <Textarea {...a} rows={2} value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} autoFocus />}
          </Field>
        </Modal>
      )}
    </Card>
  );
}

function AtribuirMecanico({ processo }: { processo: ProcessoDetalhado }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: utilizadores = [] } = useUtilizadores();
  const mecanicos = utilizadores.filter((u) => u.perfil === 'mecanico' && u.ativo);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-semibold text-mzd-black">Mecânico responsável</span>
        <Select
          value={processo.mecanicoId ?? ''}
          disabled={acao.isPending}
          onChange={(e) => {
            // Ler o valor já: o select é controlado e volta ao valor anterior até o pedido terminar.
            const mecanicoId = e.target.value;
            acao.mutate(() => api.processos.atribuirMecanico(processo.id, mecanicoId), {
              onSuccess: (p) => toast(`Atribuído a ${p.mecanico?.nome}`),
              onError: (err) => toast(mensagemErro(err), 'erro'),
            });
          }}
        >
          <option value="" disabled>Escolher mecânico…</option>
          {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </Select>
      </label>
    </div>
  );
}

function Entregue({ processo }: { processo: ProcessoDetalhado }) {
  const e = processo.entrega;
  return (
    <Card className="no-print flex flex-wrap items-center gap-x-6 gap-y-2 border-l-[3px] border-l-sinal-verde px-5 py-4">
      <p className="font-semibold text-mzd-black">Viatura entregue{e && ` em ${formatDateTime(e.data)}`}</p>
      {e && <p className="num text-sm text-mzd-gray">{e.km.toLocaleString('pt-PT')} km · combustível {e.combustivel}%</p>}
      {e?.observacoes && <p className="text-sm text-mzd-gray">{e.observacoes}</p>}
    </Card>
  );
}
