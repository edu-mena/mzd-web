import { useState } from 'react';
import { useMensagens, usePedidosSite, usePendentesComunicacao } from '../api/hooks';
import PageHeader from '../components/ui/PageHeader';
import StatTile from '../components/ui/StatTile';
import Tabs from '../components/ui/Tabs';
import { Carregando } from '../components/ui/Estados';
import { diaISO } from '../lib/datas';
import PorAvisar from './comunicacoes/PorAvisar';
import Historico from './comunicacoes/Historico';
import Modelos from './comunicacoes/Modelos';
import PedidosSite from './comunicacoes/PedidosSite';

export default function Comunicacoes() {
  const { data: pendentes, isPending } = usePendentesComunicacao();
  const { data: mensagens = [], isPending: aCarregarMensagens } = useMensagens();
  const { data: pedidos = [] } = usePedidosSite();
  const n = (v: number) => (aCarregarMensagens ? '—' : String(v));
  const [agora] = useState(() => Date.now());

  const hoje = diaISO(new Date(agora));
  const semana = new Date(agora - 7 * 86400000).toISOString();
  const enviadas = mensagens.filter((m) => m.direcao === 'saida');
  const urgentes = (pendentes ?? []).filter((p) => p.motivo !== 'marcacao' && p.motivo !== 'divida').length;

  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Comunicações" descricao="Avisos por enviar, mensagens trocadas com os clientes e modelos de texto" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Por avisar" value={String(pendentes?.length ?? '—')} hint={urgentes ? `${urgentes} sobre processos em curso` : 'Nada urgente'} tom={urgentes ? 'alerta' : 'neutro'} />
        <StatTile label="Enviadas hoje" value={n(enviadas.filter((m) => diaISO(m.data) === hoje).length)} />
        <StatTile label="Enviadas · 7 dias" value={n(enviadas.filter((m) => m.data >= semana).length)} />
        <StatTile label="Respostas · 7 dias" value={n(mensagens.filter((m) => m.direcao === 'entrada' && m.data >= semana).length)} />
      </div>
      <Tabs
        tabs={[
          { id: 'avisar', label: 'Por avisar', badge: pendentes?.length, content: isPending || !pendentes ? <Carregando /> : <PorAvisar pendentes={pendentes} /> },
          { id: 'pedidos', label: 'Pedidos do site', badge: pedidos.filter((p) => p.estado === 'novo').length, content: <PedidosSite /> },
          { id: 'historico', label: 'Histórico', content: <Historico mensagens={mensagens} /> },
          { id: 'modelos', label: 'Modelos', content: <Modelos /> },
        ]}
      />
    </div>
  );
}
