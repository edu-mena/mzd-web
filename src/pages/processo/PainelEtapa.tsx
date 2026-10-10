import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronRight, ClipboardCheck, FileText, MessageCircle, Stethoscope, Wallet, KeyRound, Lock, Upload } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useAlterarFinanceiro, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import { PERMISSAO_ETAPA, PERMISSOES_POR_PERFIL } from '../../auth/permissions';
import type { ChaveModelo, ProcessoDetalhado } from '../../types';
import { ESTADO_LABEL, ESTADOS_ORDEM, PERFIL_LABEL, SISTEMAS_VEICULO } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import { Field, Select, Textarea } from '../../components/ui/Form';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { calcularTotais, emDivida, faltaPagamentoAceitacao, recebidoProcesso, saldoEmAberto, totalFaturavel, valorAceitacao } from '../../lib/calculos';
import { aceitarAte, parqueamentoPorFaturar, textoAvisoLevantamento, valorParqueamento } from '../../lib/parqueamento';
import { diaISO } from '../../lib/datas';
import { formatDateTime, formatDia } from '../../lib/format';
import { modeloDaEtapa } from '../../lib/mensagens';
import ComporMensagem from '../../components/comunicacoes/ComporMensagem';
import FormDiagnostico from './FormDiagnostico';
import { FormOrcamento } from './FormOrcamento';
import { FormAprovacao } from './FormAprovacao';
import FormQualidade from './FormQualidade';
import { FormEntrega, FormPagamento } from './FormPagamentoEntrega';
import Reparacao from './Reparacao';
import FormFichaEntrada from './FormFichaEntrada';
import { BlocoAvisoLevantamento, BlocoPagamentoAceitacao, BlocoParqueamento, ComoAceitar } from './Cobranca';
import { LinkImprimir } from '../../documents/FichaRecepcaoDoc';

type Aberto =
  | { tipo: 'diagnostico' | 'orcamento' | 'aprovacao' | 'qualidade' | 'entrega' | 'ficha' }
  | { tipo: 'pagamento'; fatura?: string }
  | { tipo: 'mensagem'; modelo?: ChaveModelo }
  | null;

const DESCRICAO: Partial<Record<ProcessoDetalhado['estado'], string>> = {
  recepcao: 'O mecânico verifica a viatura com o cliente na ficha de entrada em papel. Carregue a ficha assinada e atribua o mecânico.',
  diagnostico: 'O mecânico inspeciona cada sistema e regista o que encontrou, com fotografias.',
  orcamentacao: 'Orçamente as peças e a mão de obra a partir do diagnóstico e envie ao cliente.',
  aguarda_aprovacao: 'O cliente aceita (ou recusa) o diagnóstico e o orçamento. Se aceitar online, o processo avança sozinho.',
  em_reparacao: 'Com o pagamento da aceitação recebido, execute as tarefas aprovadas. Registe o tempo e qualquer trabalho adicional encontrado.',
  controlo_qualidade: 'Verifique o trabalho e os itens de segurança antes de a viatura ficar pronta.',
  pronta_entrega: 'Avise o cliente, receba o que falta (e o parqueamento, se houver) e entregue a viatura com a assinatura do cliente.',
};

/** Painel "Próximo passo": o que falta na etapa atual, quem pode agir e as ações disponíveis. */
export default function PainelEtapa({ processo }: { processo: ProcessoDetalhado }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [aberto, setAberto] = useState<Aberto>(null);
  const [agora] = useState(() => Date.now());
  const financeiro = useAlterarFinanceiro<{ id: string }>();
  const [motivoRecusa, setMotivoRecusa] = useState<string | null>(null);
  const p = processo;
  const verValores = can('valores.ver');

  if (p.estado === 'cancelado') return <Cancelado processo={p} />;
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
  const abrir = (tipo: 'diagnostico' | 'orcamento' | 'aprovacao' | 'qualidade' | 'entrega' | 'ficha') => setAberto({ tipo });
  const pagar = (fatura?: string) => setAberto({ tipo: 'pagamento', fatura });
  const mensagem = (modelo?: ChaveModelo) => setAberto({ tipo: 'mensagem', modelo });
  const zap = can('mensagens.enviar') && p.cliente.consentimentoMensagens
    ? <Button variante="secundario" icone={<MessageCircle size={15} />} onClick={() => mensagem()}>Avisar o cliente</Button>
    : null;
  const parqueamento = <BlocoParqueamento processo={p} onPagar={pagar} />;
  // Parqueamento por faturar ou faturas de parqueamento por pagar (impedem a entrega).
  const parqueamentoPendente = parqueamentoPorFaturar(p).length > 0 || (p.faturasParqueamento ?? []).some((f) => saldoEmAberto(f) > 0);

  let requisitos: { ok: boolean; texto: ReactNode }[] = [];
  let acoes: ReactNode = null;
  let corpo: ReactNode = null;

  switch (p.estado) {
    case 'recepcao': {
      const f = p.fichaRecepcao;
      requisitos = [
        { ok: f.assinaturaCliente, texto: f.assinaturaCliente ? `Ficha de entrada assinada${f.km !== undefined ? ` · ${f.km.toLocaleString('pt-PT')} km` : ''}` : 'Ficha de entrada assinada pelo cliente e digitalizada' },
        { ok: !!p.mecanicoId, texto: p.mecanico ? `Mecânico atribuído: ${p.mecanico.nome}` : 'Mecânico atribuído' },
      ];
      corpo = (
        <>
          {!f.assinaturaCliente && can('processos.criar') && <PassosFicha processo={p} onCarregar={() => abrir('ficha')} />}
          {can('processos.atribuir') && <AtribuirMecanico processo={p} />}
        </>
      );
      acoes = (
        <>
          {f.assinaturaCliente && can('processos.criar') && !!f.digitalizacaoIds?.length && (
            <Button variante="fantasma" icone={<Upload size={15} />} onClick={() => abrir('ficha')}>Substituir ficha</Button>
          )}
          {can('processos.atribuir') && (
            <Button onClick={() => avancar('Diagnóstico iniciado')} carregando={acao.isPending} disabled={!p.mecanicoId || !f.assinaturaCliente}>
              Iniciar diagnóstico <ChevronRight size={15} />
            </Button>
          )}
        </>
      );
      break;
    }
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
          : <Button icone={<Stethoscope size={15} />} onClick={() => abrir('diagnostico')}>{avaliados ? 'Continuar diagnóstico' : 'Fazer diagnóstico'}</Button>
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
          <Button variante={linhas ? 'secundario' : 'primario'} icone={<FileText size={15} />} onClick={() => abrir('orcamento')}>{linhas ? 'Editar orçamento' : 'Fazer orçamento'}</Button>
          {linhas > 0 && <Button onClick={() => avancar('Orçamento enviado — aguarda aprovação do cliente')} carregando={acao.isPending} disabled={descontoBloqueia}>Enviar ao cliente <ChevronRight size={15} /></Button>}
        </>
      );
      break;
    }
    case 'aguarda_aprovacao': {
      const ate = aceitarAte(p.orcamento);
      const expirou = !!ate && diaISO(new Date()) > ate;
      requisitos = [
        { ok: true, texto: <>Enviado ao cliente {p.orcamento?.enviadoEm && formatDateTime(p.orcamento.enviadoEm)}{verValores && <> · <Kz valor={calcularTotais(p.orcamento).total} />{p.orcamento?.isencaoIva ? ' sem IVA' : ' com IVA'}</>}</> },
        ...(ate ? [{ ok: !expirou, texto: expirou ? `Validade terminou a ${formatDia(ate)} — parqueamento a contar` : `Aceitar até ${formatDia(ate)}` }] : []),
        { ok: false, texto: 'Decisão do cliente' },
      ];
      corpo = (
        <>
          <ComoAceitar processo={p} agora={agora} onMensagem={mensagem} onRegistar={() => abrir('aprovacao')} />
          {parqueamento}
        </>
      );
      acoes = can('aprovacao.registar') && <Button icone={<ClipboardCheck size={15} />} onClick={() => abrir('aprovacao')}>Registar decisão do cliente</Button>;
      break;
    }
    case 'em_reparacao': {
      const pendentes = (p.tarefas ?? []).filter((t) => !t.feita).length;
      const falta = faltaPagamentoAceitacao(p);
      requisitos = [
        {
          ok: !p.aguardaPagamento,
          texto: p.aguardaPagamento
            ? verValores ? <>Pagamento da aceitação: faltam <Kz valor={falta} /></> : 'Pagamento da aceitação em falta'
            : p.dispensaPagamentoAceitacao ? 'Começou sem o pagamento da aceitação (Direção)' : verValores ? <>Pagamento da aceitação recebido · <Kz valor={valorAceitacao(p.orcamento)} /></> : 'Pagamento da aceitação recebido',
        },
        { ok: pendentes === 0, texto: pendentes ? `${pendentes} tarefa(s) por fazer` : 'Todas as tarefas feitas' },
        { ok: !p.aguardaPecas, texto: p.aguardaPecas ? 'À espera de peças' : 'Sem peças em falta' },
        { ok: !(p.registosTempo ?? []).some((r) => !r.fim), texto: 'Cronómetros parados' },
      ];
      corpo = (
        <>
          <BlocoPagamentoAceitacao processo={p} onPagar={() => pagar()} onMensagem={mensagem} />
          {parqueamento}
          <Reparacao processo={p} />
        </>
      );
      acoes = (
        <>
          {can('pagamentos.registar') && !p.aguardaPagamento && emDivida(p) > 0 && <Button variante="secundario" icone={<Wallet size={15} />} onClick={() => pagar()}>Registar pagamento</Button>}
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
      corpo = parqueamento;
      acoes = can('qualidade.validar') && <Button icone={<ClipboardCheck size={15} />} onClick={() => abrir('qualidade')}>Fazer controlo de qualidade</Button>;
      break;
    case 'pronta_entrega': {
      const divida = emDivida(p);
      const aviso = textoAvisoLevantamento(p);
      const v = valorParqueamento(parqueamentoPorFaturar(p), p.orcamento);
      requisitos = [
        { ok: true, texto: <>Fatura {p.fatura?.numero} emitida{verValores && <> · <Kz valor={totalFaturavel(p)} /></>}</> },
        { ok: !!aviso, texto: aviso ?? 'Cliente avisado de que a viatura está pronta' },
        { ok: divida === 0, texto: divida === 0 ? 'Fatura do serviço paga' : verValores ? <>Falta receber <Kz valor={divida} /> (recebido <Kz valor={recebidoProcesso(p)} />)</> : 'Pagamento por concluir' },
      ];
      if (parqueamentoPendente || p.faturasParqueamento?.length) {
        requisitos.push({
          ok: !parqueamentoPendente,
          texto: !parqueamentoPendente ? 'Parqueamento pago' : v.dias ? `Parqueamento: ${v.dias} dia(s) por faturar` : 'Fatura de parqueamento por pagar',
        });
      }
      corpo = (
        <>
          <BlocoAvisoLevantamento processo={p} onMensagem={mensagem} />
          {parqueamento}
        </>
      );
      acoes = (
        <>
          {p.avisoLevantamento && zap}
          {can('pagamentos.registar') && divida > 0 && <Button variante="secundario" icone={<Wallet size={15} />} onClick={() => pagar(p.fatura?.numero)}>Registar pagamento</Button>}
          {can('entrega.registar') && <Button icone={<KeyRound size={15} />} onClick={() => abrir('entrega')} disabled={divida > 0 || parqueamentoPendente}>Entregar viatura</Button>}
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

      <Janelas processo={p} aberto={aberto} onFechar={() => setAberto(null)} />
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

/** Formulários abertos a partir do painel (também no processo cancelado, para o parqueamento). */
function Janelas({ processo: p, aberto, onFechar }: { processo: ProcessoDetalhado; aberto: Aberto; onFechar: () => void }) {
  if (!aberto) return null;
  switch (aberto.tipo) {
    case 'diagnostico': return <FormDiagnostico processo={p} onFechar={onFechar} />;
    case 'orcamento': return <FormOrcamento processo={p} onFechar={onFechar} />;
    case 'aprovacao': return <FormAprovacao processo={p} onFechar={onFechar} />;
    case 'qualidade': return <FormQualidade processo={p} onFechar={onFechar} />;
    case 'pagamento': return <FormPagamento processo={p} fatura={aberto.fatura} onFechar={onFechar} />;
    case 'entrega': return <FormEntrega processo={p} onFechar={onFechar} />;
    case 'ficha': return <FormFichaEntrada processo={p} onFechar={onFechar} />;
    case 'mensagem': return <ComporMensagem alvo={{ processoId: p.id }} modeloInicial={aberto.modelo ?? modeloDaEtapa(p)} onFechar={onFechar} />;
  }
}

function Passo({ n, titulo, texto, acao }: { n: number; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-mzd-black text-[11px] font-bold">{n}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-mzd-black">{titulo}</span>
        <span className="block text-[12.5px] text-mzd-gray">{texto}</span>
      </span>
      {acao}
    </li>
  );
}

/** Receção: a ficha em papel vai ao mecânico e volta assinada para ser digitalizada. */
function PassosFicha({ processo, onCarregar }: { processo: ProcessoDetalhado; onCarregar: () => void }) {
  return (
    <ol className="divide-y divide-linha/70 rounded-md border border-linha bg-white p-4">
      <Passo n={1} titulo="Imprimir a ficha de entrada" texto="Já vem com os dados do cliente, da viatura e a queixa." acao={<LinkImprimir processoId={processo.id} documento="ficha">Imprimir ficha</LinkImprimir>} />
      <Passo n={2} titulo="O mecânico preenche-a com o cliente" texto="Quilómetros, combustível, danos, pertences — e o cliente assina." />
      <Passo n={3} titulo="Digitalizar e carregar a ficha assinada" texto="Uma fotografia de cada página (ou o PDF) e os quilómetros." acao={<Button tamanho="sm" icone={<Upload size={14} />} onClick={onCarregar}>Carregar ficha assinada</Button>} />
    </ol>
  );
}

/** Processo cancelado com a viatura ainda a dever parqueamento (ex.: orçamento recusado depois da validade). */
function Cancelado({ processo }: { processo: ProcessoDetalhado }) {
  const { can } = useAuth();
  const [aberto, setAberto] = useState<Aberto>(null);
  const pendente = parqueamentoPorFaturar(processo).length > 0 || (processo.faturasParqueamento ?? []).some((f) => saldoEmAberto(f) > 0);
  if (!pendente || !can('valores.ver')) return null;
  return (
    <Card className="no-print p-5">
      <BlocoParqueamento processo={processo} onPagar={(fatura) => setAberto({ tipo: 'pagamento', fatura })} />
      <Janelas processo={processo} aberto={aberto} onFechar={() => setAberto(null)} />
    </Card>
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
