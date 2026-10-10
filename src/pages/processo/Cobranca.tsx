import { useState } from 'react';
import type { ReactNode } from 'react';
import { Globe, MessageCircle, Phone, Store, Wallet } from 'lucide-react';
import { useAcaoProcesso, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { ChaveModelo, ProcessoDetalhado } from '../../types';
import { MOTIVO_PARQUEAMENTO_LABEL } from '../../types';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import Modal from '../../components/ui/Modal';
import { Field, Textarea } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { faltaPagamentoAceitacao, saldoEmAberto, valorAceitacao } from '../../lib/calculos';
import { aceitarAte, parqueamentoPorFaturar, valorParqueamento } from '../../lib/parqueamento';
import { formatDia } from '../../lib/format';
import { haQuanto } from '../../lib/datas';
import { LinkImprimir } from '../../documents/FichaRecepcaoDoc';

/** Destaque âmbar dentro do painel "Próximo passo": algo de fora (cliente, pagamento) que trava o processo. */
function Bloco({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="rounded-md border border-sinal-ambar bg-sinal-ambar-fundo p-4 text-sm">
      <p className="font-semibold text-mzd-black">{titulo}</p>
      <div className="mt-1 space-y-1 text-mzd-graphite">{children}</div>
      {acoes && <div className="mt-3 flex flex-wrap justify-end gap-2">{acoes}</div>}
    </div>
  );
}

/** Decisão da Direção com motivo (fica no histórico e na auditoria). */
function Dispensa({ titulo, explicacao, onConfirmar, onFechar }: {
  titulo: string; explicacao: string; onConfirmar: (motivo: string) => Promise<unknown>; onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  return (
    <Modal
      open
      onClose={onFechar}
      title={titulo}
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Voltar</Button>
          <Button
            disabled={motivo.trim().length < 5}
            carregando={aGuardar}
            onClick={async () => {
              setAGuardar(true);
              try { await onConfirmar(motivo.trim()); onFechar(); } finally { setAGuardar(false); }
            }}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-mzd-graphite">{explicacao}</p>
      <Field label="Motivo" hint="Fica no histórico do processo">
        {(a) => <Textarea {...a} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ex.: frotista com conta mensal" />}
      </Field>
    </Modal>
  );
}

function useCorrer() {
  const toast = useToast();
  const acao = useAcaoProcesso();
  return (fn: () => Promise<ProcessoDetalhado>, ok: string) =>
    acao.mutateAsync(fn).then(() => toast(ok)).catch((e) => { toast(mensagemErro(e), 'erro'); throw e; });
}

/** Aceite, mas sem o pagamento da aceitação: a reparação não começa (salvo dispensa da Direção). */
export function BlocoPagamentoAceitacao({ processo: p, onPagar, onMensagem }: { processo: ProcessoDetalhado; onPagar: () => void; onMensagem: (m: ChaveModelo) => void }) {
  const { can } = useAuth();
  const correr = useCorrer();
  const [dispensar, setDispensar] = useState(false);
  if (!p.aguardaPagamento) return null;
  const verValores = can('valores.ver');
  const c = p.orcamento?.condicoes;
  return (
    <Bloco
      titulo="A reparação ainda não pode começar"
      acoes={
        <>
          {can('financeiro.supervisionar') && <Button variante="fantasma" tamanho="sm" onClick={() => setDispensar(true)}>Começar sem o pagamento…</Button>}
          {can('mensagens.enviar') && p.cliente.consentimentoMensagens && (
            <Button variante="secundario" tamanho="sm" icone={<MessageCircle size={14} />} onClick={() => onMensagem('pagamento')}>Pedir o pagamento</Button>
          )}
          {can('pagamentos.registar') && <Button tamanho="sm" icone={<Wallet size={14} />} onClick={onPagar}>Registar pagamento</Button>}
        </>
      }
    >
      <p>
        O cliente aceitou o orçamento, mas falta o pagamento da aceitação
        {verValores && <>: <Kz valor={faltaPagamentoAceitacao(p)} className="font-semibold text-mzd-black" /></>}
        {c && <> ({[c.pecasAceitacaoPct && `${c.pecasAceitacaoPct}% das peças`, c.maoObraAceitacaoPct && `${c.maoObraAceitacaoPct}% da mão de obra`].filter(Boolean).join(' e ')})</>}.
      </p>
      <p>Até lá não se encomendam peças, nem se marcam tarefas ou horas.</p>
      {dispensar && (
        <Dispensa
          titulo="Começar a reparação sem o pagamento"
          explicacao="A reparação fica autorizada sem o pagamento da aceitação. O valor continua em dívida e é cobrado no levantamento."
          onConfirmar={(motivo) => correr(() => api.processos.dispensarPagamentoAceitacao(p.id, motivo), 'Reparação autorizada')}
          onFechar={() => setDispensar(false)}
        />
      )}
    </Bloco>
  );
}

/** Parqueamento: dias a contar e por faturar, faturas por pagar e dispensa da Direção. Só para quem vê valores. */
export function BlocoParqueamento({ processo: p, onPagar }: { processo: ProcessoDetalhado; onPagar: (fatura: string) => void }) {
  const { can } = useAuth();
  const correr = useCorrer();
  const { data: utilizadores = [] } = useUtilizadores();
  const [dispensar, setDispensar] = useState(false);
  const [aFaturar, setAFaturar] = useState(false);
  if (!can('valores.ver')) return null;
  const porFaturar = parqueamentoPorFaturar(p);
  const v = valorParqueamento(porFaturar, p.orcamento);
  const abertas = (p.faturasParqueamento ?? []).filter((f) => saldoEmAberto(f) > 0);
  if (!porFaturar.length && !abertas.length) {
    return p.dispensaParqueamento && p.estado !== 'entregue'
      ? <p className="text-xs text-mzd-gray">Parqueamento dispensado pela Direção ({utilizadores.find((u) => u.id === p.dispensaParqueamento!.porId)?.nome ?? '—'}): {p.dispensaParqueamento.motivo}</p>
      : null;
  }
  const aContar = porFaturar.some((x) => (x.motivo === 'orcamento' && p.estado === 'aguarda_aprovacao') || (x.motivo === 'levantamento' && p.estado === 'pronta_entrega'));
  return (
    <Bloco
      titulo={aContar ? 'Parqueamento a contar' : 'Parqueamento por cobrar'}
      acoes={
        <>
          {porFaturar.length > 0 && can('financeiro.supervisionar') && <Button variante="fantasma" tamanho="sm" onClick={() => setDispensar(true)}>Dispensar…</Button>}
          {porFaturar.length > 0 && can('pagamentos.registar') && !(p.estado === 'aguarda_aprovacao') && (
            <Button variante="secundario" tamanho="sm" carregando={aFaturar} onClick={() => {
              setAFaturar(true);
              correr(() => api.processos.faturarParqueamento(p.id), 'Fatura de parqueamento emitida').catch(() => undefined).finally(() => setAFaturar(false));
            }}>
              Faturar {v.dias} dia(s)
            </Button>
          )}
          {abertas.map((f) => can('pagamentos.registar') && (
            <Button key={f.numero} tamanho="sm" icone={<Wallet size={14} />} onClick={() => onPagar(f.numero)}>Pagar {f.numero}</Button>
          ))}
        </>
      }
    >
      {porFaturar.map((x) => (
        <p key={x.motivo}>
          {MOTIVO_PARQUEAMENTO_LABEL[x.motivo]}: desde <span className="num">{formatDia(x.de)}</span> · <span className="num">{x.dias}</span> dia(s)
        </p>
      ))}
      {porFaturar.length > 0 && (
        <p>
          {aContar ? 'Até hoje' : 'Por faturar'}: <span className="num">{v.dias} × </span><Kz valor={v.valorDia} /> = <Kz valor={v.total} className="font-semibold text-mzd-black" />
          {v.taxaIva > 0 && ' (IVA incluído)'}
          {aContar && <> · continua a contar até {p.estado === 'aguarda_aprovacao' ? 'à decisão do cliente' : 'ao levantamento'}.</>}
        </p>
      )}
      {abertas.map((f) => (
        <p key={f.numero}>Fatura <span className="num">{f.numero}</span> por pagar: <Kz valor={saldoEmAberto(f)} className="font-semibold text-mzd-black" /></p>
      ))}
      <p className="text-xs">É faturado à parte e tem de estar pago antes de a viatura sair.</p>
      {dispensar && (
        <Dispensa
          titulo="Dispensar o parqueamento"
          explicacao={`Os ${v.dias} dia(s) por faturar não são cobrados e o parqueamento deixa de contar neste processo.`}
          onConfirmar={(motivo) => correr(() => api.processos.dispensarParqueamento(p.id, motivo), 'Parqueamento dispensado')}
          onFechar={() => setDispensar(false)}
        />
      )}
    </Bloco>
  );
}

/** Viatura pronta: avisar o cliente faz contar os dias úteis para levantar (depois, parqueamento). */
export function BlocoAvisoLevantamento({ processo: p, onMensagem }: { processo: ProcessoDetalhado; onMensagem: (m: ChaveModelo) => void }) {
  const { can } = useAuth();
  const correr = useCorrer();
  const [aGuardar, setAGuardar] = useState<string | null>(null);
  if (p.avisoLevantamento || !can('mensagens.enviar')) return null;
  const dias = p.orcamento?.condicoes.diasUteisLevantamento ?? 5;
  const avisar = (canal: 'telefone' | 'presencial') => {
    setAGuardar(canal);
    correr(() => api.processos.avisarLevantamento(p.id, canal), 'Aviso registado').catch(() => undefined).finally(() => setAGuardar(null));
  };
  return (
    <Bloco
      titulo="Avise o cliente de que a viatura está pronta"
      acoes={
        <>
          <Button variante="fantasma" tamanho="sm" icone={<Store size={14} />} carregando={aGuardar === 'presencial'} onClick={() => avisar('presencial')}>Avisei ao balcão</Button>
          <Button variante="secundario" tamanho="sm" icone={<Phone size={14} />} carregando={aGuardar === 'telefone'} onClick={() => avisar('telefone')}>Avisei por telefone</Button>
          {p.cliente.consentimentoMensagens && <Button tamanho="sm" icone={<MessageCircle size={14} />} onClick={() => onMensagem('pronta')}>Enviar aviso</Button>}
        </>
      }
    >
      <p>A partir do aviso, o cliente tem {dias} dias úteis para levantar a viatura; depois disso conta parqueamento. Sem aviso, não conta.</p>
    </Bloco>
  );
}

function Caminho({ icone, titulo, children, acao }: { icone: ReactNode; titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <li className="flex flex-col rounded-md border border-linha bg-white p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-mzd-black">{icone}{titulo}</p>
      <div className="mt-1 flex-1 text-[12.5px] leading-snug text-mzd-gray">{children}</div>
      {acao && <div className="mt-3 flex flex-wrap gap-2">{acao}</div>}
    </li>
  );
}

/** As três formas de o cliente aceitar o orçamento, com o que a receção faz em cada uma. */
export function ComoAceitar({ processo: p, agora, onMensagem, onRegistar }: {
  processo: ProcessoDetalhado; agora: number; onMensagem: (m: ChaveModelo) => void; onRegistar: () => void;
}) {
  const { can } = useAuth();
  const verValores = can('valores.ver');
  const ate = aceitarAte(p.orcamento);
  const mensagens = can('mensagens.enviar');
  const registar = can('aprovacao.registar');
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-mzd-graphite">
        O cliente aceita de uma destas formas{ate && <>, até <strong className="num">{formatDia(ate)}</strong> (depois disso conta parqueamento)</>}.
        {verValores && p.orcamento && <> Ao aceitar, paga <Kz valor={valorAceitacao(p.orcamento)} className="font-semibold text-mzd-black" /> para a reparação começar.</>}
      </p>
      <ol className="grid gap-2 md:grid-cols-3">
        <Caminho
          icone={<Globe size={15} />}
          titulo="1. Online, pelo link"
          acao={mensagens && p.cliente.consentimentoMensagens && <Button variante="secundario" tamanho="sm" icone={<MessageCircle size={14} />} onClick={() => onMensagem('orcamento')}>Enviar orçamento</Button>}
        >
          Envie o orçamento por WhatsApp ou email. O cliente abre o link, vê o diagnóstico e carrega em «Aceitar orçamento». O processo avança sozinho e recebe um aviso.
          {p.portal && <span className="mt-1 block font-medium text-mzd-black">{p.portal.ultimoAcesso ? `Abriu o link ${haQuanto(p.portal.ultimoAcesso, agora)}.` : 'Ainda não abriu o link.'}</span>}
          {!p.cliente.consentimentoMensagens && <span className="mt-1 block">O cliente não autorizou mensagens.</span>}
        </Caminho>
        <Caminho
          icone={<Store size={15} />}
          titulo="2. Na oficina, em papel"
          acao={<LinkImprimir processoId={p.id} documento="proforma">Imprimir pró-forma</LinkImprimir>}
        >
          Imprima a pró-forma. O cliente assina «Aceito» e paga a aceitação. Registe a decisão com a fotografia da folha assinada.
        </Caminho>
        <Caminho
          icone={<Phone size={15} />}
          titulo="3. Por mensagem ou telefone"
          acao={registar && <Button tamanho="sm" onClick={onRegistar}>Registar decisão</Button>}
        >
          O cliente respondeu «ACEITO» por WhatsApp ou email, ou ligou. Registe a decisão com a captura da resposta (por telefone não há comprovativo).
        </Caminho>
      </ol>
    </div>
  );
}
