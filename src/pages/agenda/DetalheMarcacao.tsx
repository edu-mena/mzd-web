import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, MessageCircle } from 'lucide-react';
import { useAlterarMarcacao } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { Marcacao } from '../../types';
import { ESTADO_MARCACAO_LABEL, TIPO_MARCACAO_LABEL } from '../../types';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { botao } from '../../components/ui/botao';
import Matricula from '../../components/ui/Matricula';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { horaCurta } from '../../lib/datas';
import ComporMensagem from '../../components/comunicacoes/ComporMensagem';

export default function DetalheMarcacao({ marcacao: m, onFechar, onEditar }: { marcacao: Marcacao; onFechar: () => void; onEditar: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const alterar = useAlterarMarcacao<Marcacao>();
  const aberta = m.estado === 'agendada' || m.estado === 'confirmada';
  // Hora de referência fixada ao abrir a janela (o render tem de ser puro).
  const [agora] = useState(() => Date.now());
  const passou = new Date(m.data).getTime() < agora;
  const gerir = can('agenda.gerir');
  const quando = new Date(m.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const [lembrar, setLembrar] = useState(false);

  const mudar = (estado: 'agendada' | 'confirmada' | 'faltou' | 'cancelada', msg: string) =>
    alterar.mutate(() => api.marcacoes.mudarEstado(m.id, estado), {
      onSuccess: () => { toast(msg); onFechar(); },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });

  return (
    <Modal
      open
      onClose={onFechar}
      title={`${TIPO_MARCACAO_LABEL[m.tipo]} · ${horaCurta(m.data)}`}
      footer={
        <>
          {gerir && aberta && <Button variante="fantasma" onClick={() => mudar('cancelada', 'Marcação cancelada')}>Cancelar marcação</Button>}
          {gerir && aberta && passou && <Button variante="secundario" onClick={() => mudar('faltou', 'Falta registada')}>Faltou</Button>}
          {gerir && m.estado === 'agendada' && <Button variante="secundario" onClick={() => mudar('confirmada', 'Marcação confirmada')}>Confirmar</Button>}
          {can('processos.criar') && aberta && (
            <Button variante="perigo" onClick={() => { onFechar(); navigate(`/processos/novo?marcacao=${m.id}`); }}>Iniciar receção</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-mzd-black">{m.nome}</p>
          <p className="num text-sm text-mzd-gray">{m.telefone}</p>
          {m.matricula && <p className="mt-2"><Matricula valor={m.matricula} tamanho="sm" /></p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <div><dt className="rotulo">Quando</dt><dd className="first-letter:uppercase">{quando}, {horaCurta(m.data)}</dd></div>
          <div><dt className="rotulo">Estado</dt><dd>{ESTADO_MARCACAO_LABEL[m.estado]}</dd></div>
          {!m.clienteId && <div className="col-span-2"><dt className="rotulo">Atenção</dt><dd>Ainda não é cliente — os dados ficam registados na receção.</dd></div>}
          {m.notas && <div className="col-span-2"><dt className="rotulo">Notas</dt><dd>{m.notas}</dd></div>}
        </dl>
        <div className="flex flex-wrap gap-2">
          {aberta && can('mensagens.enviar') && (
            <Button variante="secundario" tamanho="sm" icone={<MessageCircle size={14} />} onClick={() => setLembrar(true)}>Enviar lembrete</Button>
          )}
          {gerir && aberta && <Button variante="secundario" tamanho="sm" icone={<CalendarClock size={14} />} onClick={onEditar}>Alterar dia ou hora</Button>}
          {gerir && (m.estado === 'cancelada' || m.estado === 'faltou') && !passou && (
            <Button variante="secundario" tamanho="sm" onClick={() => mudar('agendada', 'Marcação reposta')}>Repor marcação</Button>
          )}
          {m.processoId && <Link to={`/processos/${m.processoId}`} className={botao('secundario', 'sm')}>Abrir processo</Link>}
        </div>
      </div>
      {lembrar && <ComporMensagem alvo={{ marcacaoId: m.id }} modeloInicial="marcacao" onFechar={() => setLembrar(false)} />}
    </Modal>
  );
}
