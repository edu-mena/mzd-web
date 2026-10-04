import { useState } from 'react';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { useAlterarCadastro, useClientes } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { Cliente, ClienteResumo, ViaturaResumo } from '../../types';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Matricula from '../../components/ui/Matricula';
import { Aviso } from '../../components/ui/Controls';
import { Checkbox, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDate } from '../../lib/format';

/** Lista pesquisável de clientes para escolher um (transferência, junção). */
function EscolherCliente({ excluir, escolhido, onEscolher }: { excluir: string[]; escolhido?: ClienteResumo; onEscolher: (c: ClienteResumo) => void }) {
  const [q, setQ] = useState('');
  const { data: clientes = [] } = useClientes();
  const t = q.trim().toLowerCase();
  const lista = t.length < 2 ? [] : clientes
    .filter((c) => !excluir.includes(c.id))
    .filter((c) => c.nome.toLowerCase().includes(t) || c.telefone.replace(/\D/g, '').includes(t.replace(/\D/g, '') || '§') || c.nif?.toLowerCase().includes(t))
    .slice(0, 6);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone ou NIF" className="pl-9" autoFocus aria-label="Pesquisar cliente" />
      </div>
      <ul className="space-y-1">
        {lista.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onEscolher(c)}
              aria-pressed={escolhido?.id === c.id}
              className={clsx('flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[13px]', escolhido?.id === c.id ? 'border-mzd-black bg-mzd-black text-white' : 'border-linha bg-white hover:border-zinc-400')}
            >
              <span className="font-semibold">{c.nome}</span>
              <span className={clsx('num text-xs', escolhido?.id === c.id ? 'text-mzd-gray' : 'text-mzd-gray')}>{c.telefone}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mudança de proprietário (venda da viatura). O histórico de serviços acompanha a viatura. */
export function TransferirViatura({ viatura, onFechar }: { viatura: ViaturaResumo; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarCadastro<ViaturaResumo>();
  const [novo, setNovo] = useState<ClienteResumo>();

  return (
    <Modal
      open
      onClose={onFechar}
      title="Transferir viatura para outro cliente"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!novo}
            carregando={alterar.isPending}
            onClick={() =>
              alterar.mutate(() => api.viaturas.transferir(viatura.id, novo!.id), {
                onSuccess: () => {
                  toast(`${viatura.matricula} transferida para ${novo!.nome}`);
                  onFechar();
                },
                onError: (e) => toast(mensagemErro(e), 'erro'),
              })
            }
          >
            Transferir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-mzd-black">
          <Matricula valor={viatura.matricula} tamanho="sm" /> pertence atualmente a <strong>{viatura.cliente.nome}</strong>.
        </p>
        <EscolherCliente excluir={[viatura.cliente.id]} escolhido={novo} onEscolher={setNovo} />
        <p className="text-xs text-mzd-gray">O histórico de serviços fica com a viatura. Se o novo proprietário ainda não existe, registe-o primeiro em Clientes.</p>
      </div>
    </Modal>
  );
}

/**
 * Junta dois registos do mesmo cliente. Escolhe-se qual fica; viaturas e processos do outro passam
 * para ele, os dados em falta são completados e o registo duplicado é apagado. Irreversível.
 */
export function JuntarClientes({
  a,
  b,
  onFechar,
  onJuntado,
}: {
  a: ClienteResumo;
  b?: ClienteResumo;
  onFechar: () => void;
  onJuntado?: (c: Cliente) => void;
}) {
  const toast = useToast();
  const alterar = useAlterarCadastro<Cliente>();
  const [outro, setOutro] = useState<ClienteResumo | undefined>(b);
  const [manter, setManter] = useState<string>(a.id);
  const [confirmado, setConfirmado] = useState(false);
  const par = outro ? [a, outro] : [a];
  const destino = par.find((c) => c.id === manter);
  const origem = par.find((c) => c.id !== manter);

  return (
    <Modal
      open
      wide
      onClose={onFechar}
      title="Juntar clientes duplicados"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            variante="perigo"
            disabled={!outro || !confirmado}
            carregando={alterar.isPending}
            onClick={() =>
              alterar.mutate(() => api.clientes.fundir(destino!.id, origem!.id), {
                onSuccess: (c) => {
                  toast(`Registos juntos em ${c.nome}`);
                  onJuntado?.(c);
                  onFechar();
                },
                onError: (e) => toast(mensagemErro(e), 'erro'),
              })
            }
          >
            Juntar registos
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!outro ? (
          <>
            <p className="text-sm text-mzd-black">Com que cliente é que <strong>{a.nome}</strong> está duplicado?</p>
            <EscolherCliente excluir={[a.id]} onEscolher={setOutro} />
          </>
        ) : (
          <>
            <p className="text-sm text-mzd-black">Escolha o registo que fica. O outro é apagado e tudo o que tem passa para o escolhido.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Registo a manter">
              {par.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={manter === c.id}
                  onClick={() => setManter(c.id)}
                  className={clsx('rounded-md border-2 p-4 text-left transition-colors', manter === c.id ? 'border-mzd-black bg-white' : 'border-linha bg-zinc-50 hover:border-zinc-400')}
                >
                  <p className="rotulo">{manter === c.id ? 'Fica este' : 'Será apagado'}</p>
                  <p className="mt-1 font-semibold text-mzd-black">{c.nome}</p>
                  <dl className="mt-2 space-y-0.5 text-xs text-mzd-gray">
                    <div><span className="num">{c.telefone}</span></div>
                    <div>{c.email ?? 'sem email'} · NIF {c.nif ?? '—'}</div>
                    <div>Cliente desde {formatDate(c.desde)}</div>
                    <div className="font-semibold text-mzd-black">{c.nViaturas} viatura(s) · {c.nProcessos} processo(s)</div>
                    <div>{c.consentimentoMensagens ? 'Aceita mensagens' : 'Sem consentimento para mensagens'}</div>
                  </dl>
                </button>
              ))}
            </div>
            {origem && destino && (
              <Aviso tom="neutro">
                {origem.nViaturas} viatura(s) e {origem.nProcessos} processo(s) de <strong>{origem.nome}</strong> passam para <strong>{destino.nome}</strong>.
                Email, NIF e morada em falta são completados. O consentimento para mensagens mantém-se o de {destino.nome}.
              </Aviso>
            )}
            <Checkbox checked={confirmado} onChange={setConfirmado}>Confirmo que são a mesma pessoa. Esta ação não pode ser desfeita.</Checkbox>
          </>
        )}
      </div>
    </Modal>
  );
}
