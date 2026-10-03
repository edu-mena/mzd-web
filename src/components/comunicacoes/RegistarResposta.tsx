import { useState } from 'react';
import { useEnviarMensagem } from '../../api/hooks';
import type { CanalMensagem } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Escolha, Field, Textarea } from '../ui/Form';
import { useToast } from '../ui/toast-context';
import { mensagemErro } from '../../lib/erros';

/**
 * Regista o que o cliente respondeu (ex.: "SIM" no WhatsApp), para ficar no histórico do processo.
 * Não substitui o registo da aprovação, que continua a ser feito na etapa.
 */
export default function RegistarResposta({ processoId, clienteId, onFechar }: { processoId?: string; clienteId?: string; onFechar: () => void }) {
  const toast = useToast();
  const enviar = useEnviarMensagem();
  const [canal, setCanal] = useState<CanalMensagem>('whatsapp');
  const [texto, setTexto] = useState('');

  return (
    <Modal
      open
      onClose={onFechar}
      title="Registar resposta do cliente"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!texto.trim()}
            carregando={enviar.isPending}
            onClick={() => enviar.mutate({ canal, direcao: 'entrada', processoId, clienteId, texto: texto.trim() }, {
              onSuccess: () => { toast('Resposta registada'); onFechar(); },
              onError: (e) => toast(mensagemErro(e), 'erro'),
            })}
          >
            Registar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Escolha label="Recebida por" valor={canal} onChange={setCanal} opcoes={[{ valor: 'whatsapp', label: 'WhatsApp' }, { valor: 'email', label: 'Email' }]} />
        <Field label="O que o cliente respondeu" hint="Copie o texto da mensagem, tal como foi recebido.">
          {(a) => <Textarea {...a} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4000} autoFocus />}
        </Field>
      </div>
    </Modal>
  );
}
