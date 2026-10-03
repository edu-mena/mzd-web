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
import SignaturePad from '../../components/ui/SignaturePad';
import { Aviso } from '../../components/ui/Controls';
import { Checkbox, Escolha, Field, Input } from '../../components/ui/Form';
import { MiniaturaPendente, SeletorFicheiros } from '../../components/ui/Anexos';
import type { FicheiroPendente } from '../../components/ui/Anexos';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { calcularTotais } from '../../lib/calculos';

const MOTIVOS = ['Preço elevado', 'Vai comparar orçamentos', 'Sem urgência', 'Vai vender a viatura', 'Outro'];
const METODOS: { valor: MetodoAprovacao; label: string }[] = [
  { valor: 'presencial', label: 'Presencial' },
  { valor: 'whatsapp', label: 'WhatsApp' },
  { valor: 'email', label: 'Email' },
  { valor: 'telefone', label: 'Telefone' },
];

/** Regista a decisão do cliente sobre o diagnóstico e o orçamento (num único passo). */
export function FormAprovacao({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { can } = useAuth();
  const total = calcularTotais(processo.orcamento).total;
  const [decisao, setDecisao] = useState<'aprovado' | 'recusado'>();
  const [metodo, setMetodo] = useState<MetodoAprovacao>();
  const [autorizadoPor, setAutorizadoPor] = useState(processo.cliente.nome);
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [comprovativo, setComprovativo] = useState<FicheiroPendente | null>(null);
  const [motivo, setMotivo] = useState<string>();
  const [motivoOutro, setMotivoOutro] = useState('');
  const [comAdiantamento, setComAdiantamento] = useState(false);
  const [adiantamento, setAdiantamento] = useState<{ valor: string; forma?: FormaPagamento; referencia: string }>({ valor: String(Math.round(total / 2)), referencia: '' });
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
        if (!metodo) throw new Error('Indique como o cliente aprovou.');
        let assinaturaAnexoId: string | undefined;
        let comprovativoAnexoId: string | undefined;
        if (metodo === 'presencial') {
          if (!assinatura) throw new Error('Recolha a assinatura do cliente.');
          assinaturaAnexoId = (await api.anexos.enviar(processo.id, assinatura, { tipo: 'assinatura', finalidade: 'assinatura_aprovacao', nome: 'assinatura-aprovacao.png' })).id;
        }
        if ((metodo === 'whatsapp' || metodo === 'email') && comprovativo) {
          comprovativoAnexoId = (await api.anexos.enviar(processo.id, comprovativo.ficheiro, { tipo: 'documento', finalidade: 'comprovativo_aprovacao', nome: comprovativo.nome, legenda: 'Comprovativo de aprovação' })).id;
        }
        let pagamento: DadosPagamento | undefined;
        if (comAdiantamento) {
          if (!adiantamento.forma) throw new Error('Indique a forma de pagamento do adiantamento.');
          pagamento = { valor: Number(adiantamento.valor), forma: adiantamento.forma, referencia: adiantamento.referencia.trim() || undefined };
        }
        await acao.mutateAsync(() =>
          api.processos.registarAprovacao(processo.id, {
            decisao: 'aprovado', metodo, autorizadoPor, assinaturaAnexoId, comprovativoAnexoId, adiantamento: pagamento,
          })
        );
        toast('Aprovação registada — reparação iniciada');
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
      subtitulo={<>Diagnóstico e orçamento · total <Kz valor={total} className="font-semibold text-mzd-black" /> com IVA</>}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button variante={decisao === 'recusado' ? 'perigo' : 'primario'} onClick={confirmar} carregando={aGuardar} disabled={!decisao}>
            {decisao === 'recusado' ? 'Registar recusa' : 'Registar aprovação'}
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
            { valor: 'aprovado', label: 'Aprovou', descricao: 'Inicia a reparação', tom: 'ok' },
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
            <Escolha label="Como aprovou" valor={metodo} onChange={setMetodo} opcoes={METODOS} />
            <Field label="Nome de quem autorizou">{(a) => <Input {...a} value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} />}</Field>

            {metodo === 'presencial' && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-mzd-black">Assinatura</p>
                <SignaturePad onChange={setAssinatura} legenda={`${autorizadoPor} autoriza a reparação pelo valor de ${total.toLocaleString('pt-PT')} Kz`} altura={160} />
              </div>
            )}
            {(metodo === 'whatsapp' || metodo === 'email') && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-mzd-black">Comprovativo (captura da conversa ou do email)</p>
                {comprovativo ? (
                  <div className="w-28"><MiniaturaPendente f={comprovativo} onRemover={() => setComprovativo(null)} /></div>
                ) : (
                  <SeletorFicheiros aceitarVideo={false} rotulo="Anexar captura de ecrã" onEscolher={(f) => setComprovativo(f[0] ?? null)} />
                )}
              </div>
            )}
            {metodo === 'telefone' && <Aviso tom="neutro">Aprovação por telefone não tem comprovativo. Fica registado quem a recebeu e quando.</Aviso>}

            {can('pagamentos.registar') && (
              <div className="rounded-md border border-linha bg-white p-4">
                <Checkbox checked={comAdiantamento} onChange={setComAdiantamento}>Registar adiantamento agora</Checkbox>
                {comAdiantamento && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Valor (Kz)" hint={`50% = ${Math.round(total / 2).toLocaleString('pt-PT')} Kz`}>
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
        <Escolha label="Comunicado por" valor={metodo} onChange={setMetodo} opcoes={METODOS} />
        <Field label="Nome de quem decidiu">{(a) => <Input {...a} value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
