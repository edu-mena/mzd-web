import { useState } from 'react';
import { useAcaoProcesso } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { DadosPagamento } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { FormaPagamento, MetodoAprovacao, OrcamentoAdicional, ProcessoDetalhado } from '../../types';
import { FORMA_PAGAMENTO_LABEL } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import { Aviso } from '../../components/ui/Controls';
import { Checkbox, Escolha, Field, Input } from '../../components/ui/Form';
import { MiniaturaPendente, SeletorFicheiros } from '../../components/ui/Anexos';
import type { FicheiroPendente } from '../../components/ui/Anexos';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { calcularTotais, textoCondicoes, valorAceitacao } from '../../lib/calculos';
import { LinkImprimir } from '../../documents/FichaRecepcaoDoc';

const MOTIVOS = ['Preço elevado', 'Vai comparar orçamentos', 'Sem urgência', 'Vai vender a viatura', 'Outro'];
const METODOS: { valor: MetodoAprovacao; label: string; descricao?: string }[] = [
  { valor: 'presencial', label: 'Na oficina', descricao: 'Assinou a pró-forma' },
  { valor: 'whatsapp', label: 'WhatsApp', descricao: 'Respondeu à mensagem' },
  { valor: 'email', label: 'Email', descricao: 'Respondeu ao email' },
  { valor: 'telefone', label: 'Telefone', descricao: 'Sem comprovativo' },
];
const METODOS_ADICIONAL = METODOS.map(({ valor, label }) => ({ valor, label }));

/** Regista a decisão do cliente sobre o diagnóstico e o orçamento (num único passo). */
export function FormAprovacao({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { can } = useAuth();
  const total = calcularTotais(processo.orcamento).total;
  const aceitacao = valorAceitacao(processo.orcamento);
  const [decisao, setDecisao] = useState<'aprovado' | 'recusado'>();
  const [metodo, setMetodo] = useState<MetodoAprovacao>();
  const [autorizadoPor, setAutorizadoPor] = useState(processo.cliente.nome);
  const [comprovativo, setComprovativo] = useState<FicheiroPendente | null>(null);
  const [motivo, setMotivo] = useState<string>();
  const [motivoOutro, setMotivoOutro] = useState('');
  // O pagamento da aceitação costuma ser feito no momento (na oficina); se não for, a reparação espera por ele.
  const [comAdiantamento, setComAdiantamento] = useState(can('pagamentos.registar'));
  const [adiantamento, setAdiantamento] = useState<{ valor: string; forma?: FormaPagamento; referencia: string }>({ valor: String(aceitacao), referencia: '' });
  const [aGuardar, setAGuardar] = useState(false);

  async function confirmar() {
    if (!decisao) return toast('Indique se o cliente aprovou ou recusou.', 'erro');
    setAGuardar(true);
    try {
      if (decisao === 'recusado') {
        const m = motivo === 'Outro' ? motivoOutro.trim() : motivo;
        if (!m) throw new Error('Indique o motivo da recusa.');
        await acao.mutateAsync(() => api.processos.registarAprovacao(processo.id, { decisao: 'recusado', motivoRecusa: m }));
        toast('Recusa registada — processo cancelado');
      } else {
        if (!metodo) throw new Error('Indique como o cliente aceitou.');
        let comprovativoAnexoId: string | undefined;
        if (metodo !== 'telefone') {
          if (!comprovativo) throw new Error(metodo === 'presencial' ? 'Junte a fotografia (ou PDF) da pró-forma assinada.' : 'Anexe a captura da resposta do cliente.');
          comprovativoAnexoId = (await api.anexos.enviar(processo.id, comprovativo.ficheiro, {
            tipo: 'documento', finalidade: 'comprovativo_aprovacao', nome: comprovativo.nome,
            legenda: metodo === 'presencial' ? 'Pró-forma assinada pelo cliente' : 'Comprovativo de aceitação',
          })).id;
        }
        let pagamento: DadosPagamento | undefined;
        if (comAdiantamento) {
          if (!adiantamento.forma) throw new Error('Indique a forma de pagamento do adiantamento.');
          pagamento = { valor: Number(adiantamento.valor), forma: adiantamento.forma, referencia: adiantamento.referencia.trim() || undefined };
        }
        await acao.mutateAsync(() =>
          api.processos.registarAprovacao(processo.id, {
            decisao: 'aprovado', metodo, autorizadoPor, comprovativoAnexoId, adiantamento: pagamento,
          })
        );
        toast(pagamento && Number(pagamento.valor) >= aceitacao ? 'Aceitação registada — a reparação pode começar' : 'Aceitação registada — a reparação começa com o pagamento da aceitação');
      }
      onFechar();
    } catch (e) {
      toast(e instanceof Error && !('status' in e) ? e.message : mensagemErro(e), 'erro');
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo="Decisão do cliente"
      subtitulo={<>Diagnóstico e orçamento · total <Kz valor={total} className="font-semibold text-mzd-black" /> {processo.orcamento?.isencaoIva ? 'sem IVA' : 'com IVA'}</>}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button variante={decisao === 'recusado' ? 'perigo' : 'primario'} onClick={confirmar} carregando={aGuardar} disabled={!decisao}>
            {decisao === 'recusado' ? 'Registar recusa' : 'Registar aceitação'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Escolha
          label="O cliente…"
          valor={decisao}
          onChange={setDecisao}
          opcoes={[
            { valor: 'aprovado', label: 'Aceitou', descricao: 'Segue para a reparação', tom: 'ok' },
            { valor: 'recusado', label: 'Recusou', descricao: 'Cancela o processo', tom: 'alerta' },
          ]}
        />

        {decisao === 'recusado' && (
          <div className="space-y-3">
            <Escolha label="Motivo da recusa" valor={motivo} onChange={setMotivo} opcoes={MOTIVOS.map((m) => ({ valor: m, label: m }))} />
            {motivo === 'Outro' && (
              <Field label="Descreva o motivo">{(a) => <Input {...a} value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} autoFocus />}</Field>
            )}
            <Aviso tom="neutro">O motivo alimenta o relatório de orçamentos recusados — ajuda a Direção a ajustar preços e prazos.</Aviso>
          </div>
        )}

        {decisao === 'aprovado' && (
          <>
            <Escolha label="Como aceitou" valor={metodo} onChange={(m) => { setMetodo(m); setComprovativo(null); }} opcoes={METODOS} />
            <Field label="Nome de quem aceitou">{(a) => <Input {...a} value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} />}</Field>

            {metodo && metodo !== 'telefone' && (
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-mzd-black">
                    {metodo === 'presencial' ? 'Pró-forma assinada pelo cliente (fotografia ou PDF)' : 'Comprovativo (captura da conversa ou do email)'}
                  </p>
                  {metodo === 'presencial' && <LinkImprimir processoId={processo.id} documento="proforma">Imprimir pró-forma</LinkImprimir>}
                </div>
                {comprovativo ? (
                  <div className="w-28"><MiniaturaPendente f={comprovativo} onRemover={() => setComprovativo(null)} /></div>
                ) : (
                  <SeletorFicheiros
                    aceitarVideo={false}
                    aceitarPdf={metodo === 'presencial'}
                    rotulo={metodo === 'presencial' ? 'Fotografar a pró-forma assinada' : 'Anexar captura de ecrã'}
                    onEscolher={(f) => setComprovativo(f[0] ?? null)}
                  />
                )}
              </div>
            )}
            {metodo === 'telefone' && <Aviso tom="neutro">A aceitação por telefone não tem comprovativo. Fica registado quem a recebeu e quando.</Aviso>}

            {can('pagamentos.registar') && (
              <div className="rounded-md border border-linha bg-white p-4">
                <Checkbox checked={comAdiantamento} onChange={setComAdiantamento}>
                  O cliente pagou a aceitação agora
                  {processo.orcamento && <span className="block text-xs font-normal text-mzd-gray">{textoCondicoes(processo.orcamento.condicoes)}</span>}
                </Checkbox>
                {!comAdiantamento && (
                  <p className="mt-2 text-xs text-sinal-ambar">A reparação fica à espera do pagamento de <Kz valor={aceitacao} /> (a Direção pode dispensá-lo).</p>
                )}
                {comAdiantamento && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Valor (Kz)" hint={`Pagamento da aceitação: ${aceitacao.toLocaleString('pt-PT')} Kz`}>
                      {(a) => <Input {...a} value={adiantamento.valor} onChange={(e) => setAdiantamento({ ...adiantamento, valor: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="num" />}
                    </Field>
                    <Field label="Referência" hint="Obrigatória em transferência e Multicaixa">
                      {(a) => <Input {...a} value={adiantamento.referencia} onChange={(e) => setAdiantamento({ ...adiantamento, referencia: e.target.value })} />}
                    </Field>
                    <Escolha
                      className="sm:col-span-2"
                      label="Forma de pagamento"
                      valor={adiantamento.forma}
                      onChange={(f) => setAdiantamento({ ...adiantamento, forma: f })}
                      opcoes={(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((f) => ({ valor: f, label: FORMA_PAGAMENTO_LABEL[f] }))}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

/** Decisão do cliente sobre um trabalho adicional. */
export function DecisaoAdicional({ processo, adicional, onFechar }: { processo: ProcessoDetalhado; adicional: OrcamentoAdicional; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [decisao, setDecisao] = useState<'aprovado' | 'recusado'>();
  const [metodo, setMetodo] = useState<MetodoAprovacao>();
  const [autorizadoPor, setAutorizadoPor] = useState(processo.cliente.nome);

  function confirmar() {
    if (!decisao || !metodo) return toast('Indique a decisão e como foi comunicada.', 'erro');
    acao.mutate(() => api.processos.decidirAdicional(processo.id, adicional.id, { decisao, metodo, autorizadoPor }), {
      onSuccess: () => {
        toast(decisao === 'aprovado' ? 'Trabalho adicional aprovado — tarefas acrescentadas' : 'Trabalho adicional recusado');
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  return (
    <Modal
      open
      onClose={onFechar}
      title="Decisão sobre o trabalho adicional"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={confirmar} carregando={acao.isPending} disabled={!decisao || !metodo}>Registar decisão</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-mzd-black">{adicional.justificacao}</p>
        <p className="text-sm">Valor: <Kz valor={calcularTotais(adicional).total} className="font-semibold" /> com IVA</p>
        <Escolha label="O cliente…" valor={decisao} onChange={setDecisao} opcoes={[{ valor: 'aprovado', label: 'Aprovou', tom: 'ok' }, { valor: 'recusado', label: 'Recusou', tom: 'alerta' }]} />
        <Escolha label="Comunicado por" valor={metodo} onChange={setMetodo} opcoes={METODOS_ADICIONAL} />
        <Field label="Nome de quem decidiu">{(a) => <Input {...a} value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
