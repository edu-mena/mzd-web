import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCaixa, useMarcacoes, usePendentesComunicacao, useProcessos } from '../../api/hooks';
import { useAuth } from '../../auth/useAuth';
import { ESTADO_MARCACAO_LABEL, FORMA_PAGAMENTO_LABEL, TIPO_MARCACAO_LABEL } from '../../types';
import type { FormaPagamento, ProcessoDetalhado } from '../../types';
import { Card, CardHeader } from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatTile from '../../components/ui/StatTile';
import Matricula from '../../components/ui/Matricula';
import Kz from '../../components/ui/Kz';
import { botao } from '../../components/ui/botao';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { emDivida } from '../../lib/calculos';
import { diaISO, haQuanto, horaCurta } from '../../lib/datas';
import { formatAOA } from '../../lib/format';
import Alertas from './Alertas';

const saudacao = (h: number) => (h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite');

/** Painel da receção e da administração: o dia de hoje, por ordem de quem chega e de quem sai. */
export default function PainelBalcao() {
  const { user, can } = useAuth();
  const [agora] = useState(() => Date.now());
  const hoje = diaISO(new Date(agora));
  const { data: processos, isPending } = useProcessos();
  const { data: marcacoes = [] } = useMarcacoes(hoje, hoje, { enabled: can('agenda.ver') });
  const { data: pendentes = [] } = usePendentesComunicacao({ enabled: can('mensagens.enviar') });
  const { data: caixa } = useCaixa(hoje, { enabled: can('faturacao.ver') });
  const verValores = can('valores.ver');

  if (isPending || !processos) return <Carregando />;
  const chegadas = marcacoes.filter((m) => m.estado !== 'cancelada');
  const porChegar = chegadas.filter((m) => m.estado === 'agendada' || m.estado === 'confirmada');
  const prontas = processos.filter((p) => p.estado === 'pronta_entrega');
  const aguardam = processos.filter((p) => p.estado === 'aguarda_aprovacao')
    .sort((a, b) => (a.orcamento?.enviadoEm ?? '').localeCompare(b.orcamento?.enviadoEm ?? ''));
  const recebidoHoje = caixa ? Object.values(caixa.totais).reduce((s, v) => s + v, 0) : 0;
  const dataHoje = new Date(agora).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="pagina space-y-6">
      <PageHeader
        titulo={`${saudacao(new Date(agora).getHours())}, ${user?.nome.split(' ')[0]}`}
        descricao={<span className="first-letter:uppercase">{dataHoje}</span>}
        acoes={can('processos.criar') && <Link to="/processos/novo" className={botao('primario')}>Nova receção</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Chegadas por receber" value={String(porChegar.length)} hint={`${chegadas.length} marcação(ões) hoje`} to="/agenda" />
        <StatTile label="Prontas para entregar" value={String(prontas.length)} tom={prontas.length ? 'ok' : 'neutro'} to="/processos?estado=pronta_entrega" />
        <StatTile label="À espera do cliente" value={String(aguardam.length)} tom={aguardam.length ? 'aviso' : 'neutro'} to="/processos?estado=aguarda_aprovacao" />
        {can('faturacao.ver')
          ? <StatTile label="Recebido hoje" value={formatAOA(recebidoHoje)} hint={caixa?.fecho ? 'Caixa fechada' : `${caixa?.pagamentos.length ?? 0} recibo(s) · caixa aberta`} to="/faturacao" />
          : <StatTile label="Clientes por avisar" value={String(pendentes.length)} tom={pendentes.length ? 'aviso' : 'neutro'} to="/comunicacoes" />}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {can('agenda.ver') && (
            <Card>
              <CardHeader title="Chegadas de hoje" subtitle="Marcações por hora" action={<Link to="/agenda" className="text-xs font-semibold text-mzd-black underline-offset-4 hover:underline">Agenda</Link>} />
              {chegadas.length === 0 ? <Vazio titulo="Sem marcações para hoje" /> : (
                <ul className="divide-y divide-linha/70">
                  {chegadas.map((m) => {
                    const aberta = m.estado === 'agendada' || m.estado === 'confirmada';
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
                        <span className="num w-12 text-[13px] font-semibold text-mzd-black">{horaCurta(m.data)}</span>
                        {m.matricula ? <Matricula valor={m.matricula} tamanho="sm" /> : <span className="w-[86px] text-xs text-mzd-gray">sem matrícula</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-mzd-black">{m.nome}</span>
                          <span className="block text-xs text-mzd-gray">{TIPO_MARCACAO_LABEL[m.tipo]} · {ESTADO_MARCACAO_LABEL[m.estado]}</span>
                        </span>
                        {aberta && can('processos.criar') && <Link to={`/processos/novo?marcacao=${m.id}`} className={botao('secundario', 'sm')}>Receção</Link>}
                        {m.processoId && <Link to={`/processos/${m.processoId}`} className="text-xs font-semibold text-mzd-black hover:underline">Processo</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <ListaProcessos
            titulo="Prontas para entregar"
            vazio="Nenhuma viatura pronta"
            processos={prontas}
            direita={(p) => verValores && emDivida(p) > 0 ? <span className="text-xs text-mzd-gray">a pagar <Kz valor={emDivida(p)} className="font-semibold text-mzd-black" /></span> : <span className="text-xs text-sinal-verde">pago</span>}
          />
          <ListaProcessos
            titulo="À espera da decisão do cliente"
            vazio="Nenhum orçamento à espera"
            processos={aguardam}
            direita={(p) => (
              <span className="text-right text-xs text-mzd-gray">
                {p.orcamento?.enviadoEm && <span className="block">enviado {haQuanto(p.orcamento.enviadoEm, agora)}</span>}
                <span className={`block ${p.portal?.ultimoAcesso ? 'text-sinal-verde' : ''}`}>{p.portal?.ultimoAcesso ? `viu o link ${haQuanto(p.portal.ultimoAcesso, agora)}` : p.portal ? 'ainda não abriu o link' : ''}</span>
              </span>
            )}
          />
        </div>

        <div className="space-y-4">
          <Alertas />
          {can('faturacao.ver') && caixa && (
            <Card>
              <CardHeader title="Caixa de hoje" subtitle={caixa.fecho ? 'Fechada' : 'Aberta'} action={<Link to="/faturacao" className="text-xs font-semibold text-mzd-black underline-offset-4 hover:underline">Abrir</Link>} />
              <dl className="divide-y divide-linha/70">
                {(Object.keys(caixa.totais) as FormaPagamento[]).map((f) => (
                  <div key={f} className="flex justify-between px-5 py-2.5 text-[13px]">
                    <dt className="text-mzd-gray">{FORMA_PAGAMENTO_LABEL[f]}</dt>
                    <dd><Kz valor={caixa.totais[f]} /></dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaProcessos({ titulo, vazio, processos, direita }: {
  titulo: string;
  vazio: string;
  processos: ProcessoDetalhado[];
  direita: (p: ProcessoDetalhado) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={titulo} subtitle={processos.length ? `${processos.length} viatura(s)` : undefined} />
      {processos.length === 0 ? <Vazio titulo={vazio} /> : (
        <ul className="divide-y divide-linha/70">
          {processos.map((p) => (
            <li key={p.id}>
              <Link to={`/processos/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                <Matricula valor={p.viatura.matricula} tamanho="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-mzd-black">{p.cliente.nome}</span>
                  <span className="num block text-xs text-mzd-gray">{p.numero} · {p.viatura.marca} {p.viatura.modelo}</span>
                </span>
                {direita(p)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
