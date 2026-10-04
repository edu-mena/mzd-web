import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, RotateCcw } from 'lucide-react';
import { trocarSessao, useCopias, useEstadoSistema } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { API_MODE } from '../../api/client';
import { Card, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando, ErroCarregamento } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { formatDateTime } from '../../lib/format';
import { haQuanto } from '../../lib/datas';
import { mensagemErro } from '../../lib/erros';

const dec = (v: number, casas = 1) => v.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const tamanho = (b: number) => (b === 0 ? '0 KB' : b >= 1024 ** 3 ? `${dec(b / 1024 ** 3)} GB` : b >= 1024 ** 2 ? `${dec(b / 1024 ** 2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Estado do sistema, cópias de segurança e operações técnicas (só o administrador). */
export function EstadoDoSistema() {
  const { data: e, isPending, error, refetch } = useEstadoSistema();
  const [agora] = useState(() => Date.now());
  if (isPending) return <Carregando />;
  if (error || !e) return <ErroCarregamento erro={error} onRepetir={refetch} />;
  const usado = e.anexos.bytes / e.limiteArmazenamentoBytes;
  const copiaVelha = !e.ultimaCopia || agora - new Date(e.ultimaCopia.data).getTime() > 36 * 3600000;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Bloco rotulo="Última cópia" valor={e.ultimaCopia ? haQuanto(e.ultimaCopia.data, agora) : 'Nunca'} alerta={copiaVelha} nota={copiaVelha ? 'Verifique o Cron diário' : 'Cópia diária às 03:00'} />
        <Bloco rotulo="Ficheiros guardados" valor={tamanho(e.anexos.bytes)} nota={`${e.anexos.total} fotos, vídeos e assinaturas`} />
        <Bloco rotulo="Contas ativas" valor={String(e.utilizadoresAtivos)} />
        <Bloco rotulo="Entradas falhadas · 24 h" valor={String(e.loginsFalhados24h)} alerta={e.loginsFalhados24h >= 10} nota={e.loginsFalhados24h >= 10 ? 'Possível tentativa de adivinhar senhas' : 'Bloqueio após 5 tentativas'} />
      </div>
      <Card>
        <CardHeader title="Armazenamento" subtitle="Plano Startup da Hostinger: 200 GB para o site, a base de dados e os ficheiros" />
        <div className="px-5 py-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${dec(usado * 100, 2)}% usado`}>
            <div className={`h-full ${usado > 0.8 ? 'bg-mzd-red' : 'bg-mzd-black'}`} style={{ width: `${Math.max(0.5, usado * 100)}%` }} />
          </div>
          <p className="num mt-2 text-xs text-mzd-gray">{tamanho(e.anexos.bytes)} de {tamanho(e.limiteArmazenamentoBytes)} em ficheiros ({dec(usado * 100, 2)}%)</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Base de dados" subtitle={`Servidor: ${e.versaoServidor} · Aplicação compilada em ${formatDateTime(__BUILD__)}`} />
        <dl className="grid grid-cols-2 divide-x divide-y divide-linha/70 sm:grid-cols-5 sm:divide-y-0">
          {[['Processos', e.baseDados.processos], ['Clientes', e.baseDados.clientes], ['Viaturas', e.baseDados.viaturas], ['Mensagens', e.baseDados.mensagens], ['Eventos de auditoria', e.baseDados.eventosAuditoria]].map(([k, v]) => (
            <div key={k} className="px-5 py-3.5"><dt className="rotulo">{k}</dt><dd className="num mt-1 text-lg font-semibold text-mzd-black">{Number(v).toLocaleString('pt-PT')}</dd></div>
          ))}
        </dl>
      </Card>
      {API_MODE === 'mock' && <ReporDemo />}
    </div>
  );
}

function Bloco({ rotulo, valor, nota, alerta }: { rotulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-lg border bg-superficie px-4 py-3.5 ${alerta ? 'border-mzd-red' : 'border-linha'}`}>
      <p className="rotulo">{rotulo}</p>
      <p className={`mt-1.5 font-display text-xl font-extrabold ${alerta ? 'text-sinal-vermelho' : 'text-mzd-black'}`}>{valor}</p>
      {nota && <p className="mt-1 text-[11.5px] text-mzd-gray">{nota}</p>}
    </div>
  );
}

function ReporDemo() {
  const toast = useToast();
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  async function repor() {
    try {
      await api.demo.repor();
      trocarSessao(qc, null);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }
  return (
    <Card>
      <CardHeader title="Dados de demonstração" subtitle="Só existe no modo de demonstração (sem servidor)" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-mzd-gray">Repõe clientes, viaturas e processos de exemplo e termina a sessão.</p>
        <Button variante="secundario" icone={<RotateCcw size={14} />} onClick={() => setConfirmar(true)}>Repor dados</Button>
      </div>
      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="Repor os dados de demonstração?"
        footer={<><Button variante="fantasma" onClick={() => setConfirmar(false)}>Cancelar</Button><Button variante="perigo" onClick={repor}>Repor e sair</Button></>}>
        <p className="text-sm text-mzd-graphite">Todas as alterações feitas neste navegador perdem-se e terá de entrar de novo.</p>
      </Modal>
    </Card>
  );
}

export function Copias() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: copias, isPending, error, refetch } = useCopias();
  const [aCriar, setACriar] = useState(false);
  if (isPending) return <Carregando />;
  if (error || !copias) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  async function criar() {
    setACriar(true);
    try {
      await api.sistema.criarCopia();
      await qc.invalidateQueries({ queryKey: ['sistema'] });
      toast('Cópia de segurança criada');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setACriar(false);
    }
  }
  async function descarregar(id: string, data: string) {
    try {
      const dados = await api.sistema.dadosCopia(id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mzd-copia-${data.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-mzd-gray">
          Todos os dias às 03:00 o servidor guarda a base de dados e a pasta de ficheiros, fora da pasta pública, durante 30 dias.
          Repor uma cópia é uma operação técnica feita pelo administrador por SSH (procedimento no manual), para nunca se perderem dados por um clique.
        </p>
        <Button icone={<DatabaseBackup size={15} />} carregando={aCriar} onClick={criar}>Criar cópia agora</Button>
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Data</Th><Th>Tipo</Th><Th direita>Base de dados</Th><Th direita>Ficheiros</Th><Th /></tr></thead>
          <tbody>
            {copias.map((c) => (
              <Tr key={c.id}>
                <Td num className="text-mzd-black">{formatDateTime(c.data)}</Td>
                <Td className="text-mzd-gray">{c.tipo === 'automatica' ? 'Automática' : 'Manual'}</Td>
                <Td direita num>{tamanho(c.tamanhoBytes)}</Td>
                <Td direita num>{c.ficheiros}</Td>
                <Td direita><Button variante="fantasma" tamanho="sm" icone={<Download size={13} />} onClick={() => descarregar(c.id, c.data)}>Descarregar</Button></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
