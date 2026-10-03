import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useRenovarPortal } from '../../api/hooks';
import type { ProcessoDetalhado } from '../../types';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { botao } from '../ui/botao';
import { useToast } from '../ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { linkPortal } from '../../lib/mensagens';
import { haQuanto } from '../../lib/datas';

/** Link pessoal do cliente para acompanhar a viatura e aprovar orçamentos, com o último acesso. */
export default function LinkPortal({ processo }: { processo: ProcessoDetalhado }) {
  const toast = useToast();
  const renovar = useRenovarPortal(processo.id);
  const [confirmar, setConfirmar] = useState(false);
  const [agora] = useState(() => Date.now());
  const portal = processo.portal;
  if (!portal) return null;
  const url = linkPortal(portal.token);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie à mão.', 'erro');
    }
  }

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-mzd-black">Acompanhamento online do cliente</h3>
          <p className="mt-0.5 text-xs text-mzd-gray">
            O cliente vê o percurso da viatura e aprova orçamentos neste link, sem conta. Vai nas mensagens com {'{link}'}.
          </p>
        </div>
        <p className={`text-xs font-semibold ${portal.ultimoAcesso ? 'text-sinal-verde' : 'text-mzd-gray'}`}>
          {portal.ultimoAcesso ? `Aberto ${portal.acessos}× · último ${haQuanto(portal.ultimoAcesso, agora)}` : 'Ainda não foi aberto'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="num min-w-0 flex-1 truncate rounded-md border border-linha bg-papel px-3 py-2 text-xs text-mzd-black" title={url}>{url}</code>
        <Button variante="secundario" tamanho="sm" icone={<Copy size={13} />} onClick={copiar}>Copiar</Button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={botao('secundario', 'sm')}><ExternalLink size={13} /> Ver como o cliente</a>
        <Button variante="fantasma" tamanho="sm" icone={<RefreshCw size={13} />} onClick={() => setConfirmar(true)}>Novo link</Button>
      </div>
      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="Gerar um link novo?"
        footer={
          <>
            <Button variante="fantasma" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button
              variante="perigo"
              carregando={renovar.isPending}
              onClick={() => renovar.mutate(undefined, {
                onSuccess: () => { toast('Link novo gerado — envie-o ao cliente'); setConfirmar(false); },
                onError: (e) => toast(mensagemErro(e), 'erro'),
              })}
            >
              Gerar link novo
            </Button>
          </>
        }
      >
        <p className="text-sm text-mzd-graphite">
          O link atual deixa de funcionar de imediato. Use isto se o link foi parar a outra pessoa ou se o cliente pedir.
        </p>
      </Modal>
    </Card>
  );
}
