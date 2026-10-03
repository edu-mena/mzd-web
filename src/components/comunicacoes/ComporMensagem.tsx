import { useState } from 'react';
import { Mail, MessageCircle, RotateCcw } from 'lucide-react';
import { useCliente, useConfiguracao, useEnviarMensagem, useMarcacao, useModelos, useProcesso } from '../../api/hooks';
import { useAuth } from '../../auth/useAuth';
import type { CanalMensagem, ChaveModelo } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { Aviso, Segmented } from '../ui/Controls';
import { Carregando } from '../ui/Estados';
import { useToast } from '../ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { linkWhatsApp, preencherModelo, valoresDoContexto } from '../../lib/mensagens';

/** A quem e sobre o quê: o contacto vem sempre da ficha do cliente (ou da marcação), como no servidor. */
export interface AlvoMensagem {
  clienteId?: string;
  processoId?: string;
  marcacaoId?: string;
  /** Lembretes de pagamento. */
  divida?: { total: number; faturas: string[] };
}

export default function ComporMensagem({ alvo, modeloInicial, onFechar }: { alvo: AlvoMensagem; modeloInicial: ChaveModelo; onFechar: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: processo } = useProcesso(alvo.processoId ?? '');
  const { data: marcacao } = useMarcacao(alvo.marcacaoId ?? '');
  const clienteId = alvo.clienteId ?? processo?.clienteId ?? marcacao?.clienteId;
  const { data: cliente } = useCliente(clienteId ?? '');
  const { data: modelos } = useModelos();
  const { data: config } = useConfiguracao();
  const enviar = useEnviarMensagem();

  const [chave, setChave] = useState<ChaveModelo>(modeloInicial);
  const [canal, setCanal] = useState<CanalMensagem>('whatsapp');
  // Só guarda o que a pessoa escreveu; até lá o texto é o do modelo preenchido.
  const [editado, setEditado] = useState<{ texto?: string; assunto?: string }>({});

  const aCarregar = !modelos || (!!alvo.processoId && !processo) || (!!alvo.marcacaoId && !marcacao) || (!!clienteId && !cliente);
  const nome = cliente?.nome ?? marcacao?.nome ?? '';
  const telefone = cliente?.telefone ?? marcacao?.telefone ?? '';
  const email = cliente?.email;
  const consentimento = cliente ? cliente.consentimentoMensagens : true;
  const modelo = modelos?.find((m) => m.chave === chave);
  const valores = valoresDoContexto({ nome, config, processo, marcacao, divida: alvo.divida, comValores: can('valores.ver') });
  const texto = editado.texto ?? (modelo ? preencherModelo(modelo.texto, valores) : '');
  const assunto = editado.assunto ?? (modelo ? preencherModelo(modelo.assunto, valores) : '');
  const porEmail = canal === 'email';
  const pronto = consentimento && texto.trim().length > 0 && (!porEmail || assunto.trim().length > 0);

  function submeter() {
    const t = texto.trim();
    // O WhatsApp abre já, no próprio clique (depois de um pedido assíncrono o navegador bloquearia a janela).
    if (!porEmail) window.open(linkWhatsApp(telefone, t), '_blank', 'noopener,noreferrer');
    enviar.mutate(
      { canal, clienteId, processoId: alvo.processoId, marcacaoId: alvo.marcacaoId, modelo: chave, texto: t, assunto: porEmail ? assunto.trim() : undefined },
      {
        onSuccess: (m) => {
          if (m.estado === 'falhou') toast(`O email não foi enviado${m.erro ? `: ${m.erro}` : ''}`, 'erro');
          else toast(m.estado === 'registada' ? 'Registada — conclua o envio no WhatsApp' : `Email enviado para ${m.destino}`);
          onFechar();
        },
        onError: (e) => toast(mensagemErro(e), 'erro'),
      },
    );
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo="Mensagem ao cliente"
      subtitulo={nome && <>{nome} · <span className="num">{porEmail ? email : telefone}</span></>}
      rodape={
        <>
          {!porEmail && <span className="mr-auto hidden text-xs text-mzd-gray sm:block">Confirme o envio no WhatsApp.</span>}
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={submeter} disabled={aCarregar || !pronto} carregando={enviar.isPending} icone={porEmail ? <Mail size={15} /> : <MessageCircle size={15} />}>
            {porEmail ? 'Enviar email' : 'Abrir no WhatsApp'}
          </Button>
        </>
      }
    >
      {aCarregar ? <Carregando /> : (
        <div className="space-y-4">
          {!consentimento && (
            <Aviso tom="vermelho">{nome} não autorizou o envio de mensagens. Registe o consentimento na ficha do cliente ou contacte por telefone.</Aviso>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Modelo">
              {(a) => (
                <Select {...a} value={chave} onChange={(e) => { setChave(e.target.value as ChaveModelo); setEditado({}); }}>
                  {modelos!.map((m) => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
                </Select>
              )}
            </Field>
            <Segmented
              label="Canal"
              value={canal}
              onChange={setCanal}
              opcoes={[
                { valor: 'whatsapp', label: 'WhatsApp', icone: <MessageCircle size={13} /> },
                ...(email ? [{ valor: 'email' as const, label: 'Email', icone: <Mail size={13} /> }] : []),
              ]}
            />
          </div>
          {porEmail && (
            <Field label="Assunto">{(a) => <Input {...a} value={assunto} onChange={(e) => setEditado({ ...editado, assunto: e.target.value })} maxLength={150} />}</Field>
          )}
          <Field label="Mensagem" hint={`${texto.length} caracteres · linhas sem dados (ex.: valores que não pode ver) são omitidas`}>
            {(a) => <Textarea {...a} rows={11} value={texto} onChange={(e) => setEditado({ ...editado, texto: e.target.value })} maxLength={4000} />}
          </Field>
          {(editado.texto !== undefined || editado.assunto !== undefined) && (
            <Button variante="fantasma" tamanho="sm" icone={<RotateCcw size={13} />} onClick={() => setEditado({})}>Repor o texto do modelo</Button>
          )}
          {!email && <p className="text-xs text-mzd-gray">Sem email na ficha do cliente — só por WhatsApp.</p>}
        </div>
      )}
    </Drawer>
  );
}
