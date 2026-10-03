import { useState } from 'react';
import { useAcaoProcesso } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { FormaPagamento, ProcessoDetalhado } from '../../types';
import { FORMA_PAGAMENTO_LABEL } from '../../types';
import Modal from '../../components/ui/Modal';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import SignaturePad from '../../components/ui/SignaturePad';
import { Checkbox, Escolha, Field, Input, Textarea } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { emDivida } from '../../lib/calculos';

export function FormPagamento({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const divida = emDivida(processo);
  const [valor, setValor] = useState(String(Math.round(divida)));
  const [forma, setForma] = useState<FormaPagamento>();
  const [referencia, setReferencia] = useState('');

  function registar() {
    if (!forma) return toast('Indique a forma de pagamento.', 'erro');
    acao.mutate(() => api.processos.registarPagamento(processo.id, { valor: Number(valor), forma, referencia: referencia.trim() || undefined }), {
      onSuccess: () => {
        toast('Pagamento registado');
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  return (
    <Modal
      open
      onClose={onFechar}
      title={processo.fatura ? `Pagamento da fatura ${processo.fatura.numero}` : 'Adiantamento'}
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={registar} carregando={acao.isPending} disabled={!forma || !Number(valor)}>Registar pagamento</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-mzd-gray">Em dívida: <Kz valor={divida} className="font-semibold text-mzd-black" /></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Valor (Kz)">{(a) => <Input {...a} value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="num text-base" autoFocus />}</Field>
          <Field label="Referência" hint="Obrigatória em transferência e Multicaixa">{(a) => <Input {...a} value={referencia} onChange={(e) => setReferencia(e.target.value)} />}</Field>
        </div>
        <Escolha label="Forma de pagamento" valor={forma} onChange={setForma} opcoes={(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((f) => ({ valor: f, label: FORMA_PAGAMENTO_LABEL[f] }))} />
      </div>
    </Modal>
  );
}

/** Entrega da viatura ao cliente, com assinatura. Só é possível com a fatura paga. */
export function FormEntrega({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [km, setKm] = useState(String(processo.fichaRecepcao.km));
  const [combustivel, setCombustivel] = useState(processo.fichaRecepcao.combustivel);
  const [observacoes, setObservacoes] = useState('');
  const [pertences, setPertences] = useState(false);
  const [pecasMostradas, setPecasMostradas] = useState(false);
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const temPertences = processo.fichaRecepcao.pertences && processo.fichaRecepcao.pertences !== 'Nenhum';

  async function entregar() {
    if (!assinatura) return toast('Recolha a assinatura do cliente.', 'erro');
    setAGuardar(true);
    try {
      const anexo = await api.anexos.enviar(processo.id, assinatura, { tipo: 'assinatura', finalidade: 'assinatura_entrega', nome: 'assinatura-entrega.png' });
      const notas = [
        temPertences && pertences ? `Pertences devolvidos: ${processo.fichaRecepcao.pertences}` : null,
        pecasMostradas ? 'Peças substituídas mostradas ao cliente' : null,
        observacoes.trim() || null,
      ].filter(Boolean).join('. ');
      await acao.mutateAsync(() => api.processos.registarEntrega(processo.id, { km: Number(km), combustivel, observacoes: notas || undefined, assinaturaAnexoId: anexo.id }));
      toast('Viatura entregue — processo concluído');
      onFechar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo="Entrega ao cliente"
      subtitulo={`${processo.viatura.matricula} · ${processo.cliente.nome}`}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={entregar} carregando={aGuardar} disabled={!assinatura || (!!temPertences && !pertences)}>Confirmar entrega</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Quilometragem na saída" hint={`Na receção: ${processo.fichaRecepcao.km.toLocaleString('pt-PT')} km`}>
            {(a) => <Input {...a} value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="num" />}
          </Field>
          <div>
            <label htmlFor="comb-saida" className="mb-1 flex justify-between text-xs font-semibold text-mzd-black">Combustível na saída <span className="num">{combustivel}%</span></label>
            <input id="comb-saida" type="range" min={0} max={100} step={5} value={combustivel} onChange={(e) => setCombustivel(Number(e.target.value))} className="h-10 w-full accent-mzd-black" />
          </div>
        </div>
        <div className="space-y-2.5 rounded-md border border-linha bg-white p-4">
          {temPertences && (
            <Checkbox checked={pertences} onChange={setPertences}>
              Pertences devolvidos ao cliente
              <span className="block text-xs text-mzd-gray">{processo.fichaRecepcao.pertences}</span>
            </Checkbox>
          )}
          <Checkbox checked={pecasMostradas} onChange={setPecasMostradas}>Peças substituídas mostradas ou entregues ao cliente</Checkbox>
        </div>
        <Field label="Observações" hint="Opcional — recomendações para a próxima visita, por exemplo">
          {(a) => <Textarea {...a} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-mzd-black">Assinatura do cliente</p>
          <SignaturePad onChange={setAssinatura} legenda="O cliente recebe a viatura, a fatura e o termo de garantia" altura={160} />
        </div>
      </div>
    </Drawer>
  );
}
