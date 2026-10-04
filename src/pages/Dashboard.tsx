import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useProcessos, useUtilizadores } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { ESTADOS_ATIVOS, ESTADO_LABEL, estaAtivo } from '../types';
import type { ProcessoDetalhado } from '../types';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import StageTrack from '../components/ui/StageTrack';
import Matricula from '../components/ui/Matricula';
import Kz from '../components/ui/Kz';
import { Table, Th, Tr, Td } from '../components/ui/Table';
import { Carregando, ErroCarregamento, Vazio } from '../components/ui/Estados';
import { diasEntre, formatAOA, formatDate } from '../lib/format';
import { calcularTotais, saldoEmAberto } from '../lib/calculos';
import { TOM_ESTADO } from '../lib/estados';
import { COR, eixo, milhares, tooltip } from '../lib/graficos';
import PainelMecanico from './painel/PainelMecanico';
import PainelBalcao from './painel/PainelBalcao';
import Alertas from './painel/Alertas';

/** Data em que o processo foi entregue (evento de mudança para "Entregue"). */
function dataEntrega(p: ProcessoDetalhado): string | undefined {
  return p.historico.find((h) => h.estado === 'entregue')?.data;
}

const atrasado = (p: ProcessoDetalhado) => estaAtivo(p.estado) && diasEntre(p.prazoEntrega) > 0;

/**
 * Um painel por função: o mecânico vê a sua lista de trabalho; a receção e a administração o dia de hoje;
 * a chefia e a Direção a gestão da oficina.
 */
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.perfil === 'mecanico') return <PainelMecanico />;
  if (user?.perfil === 'rececionista' || user?.perfil === 'administrativa') return <PainelBalcao />;
  return <PainelGestao />;
}

function PainelGestao() {
  const { user, can } = useAuth();
  const { data: processos, isPending, error, refetch } = useProcessos();
  const { data: utilizadores = [] } = useUtilizadores();
  const verValores = can('valores.ver');

  const ind = useMemo(() => {
    if (!processos) return null;
    const ativos = processos.filter((p) => estaAtivo(p.estado));
    const atrasadas = ativos.filter(atrasado).sort((a, b) => a.prazoEntrega.localeCompare(b.prazoEntrega));
    const entregues = processos.filter((p) => p.estado === 'entregue');
    const faturados = processos.filter((p) => p.fatura);

    const receitaTotal = faturados.reduce((s, p) => s + p.fatura!.valorTotal, 0);
    const ticketMedio = faturados.length ? receitaTotal / faturados.length : 0;
    const pendente = faturados.reduce((s, p) => s + saldoEmAberto(p.fatura), 0);
    const comSaldo = faturados.filter((p) => saldoEmAberto(p.fatura) > 0).length;

    const decididos = processos.filter((p) => p.orcamento && ['aprovado', 'recusado'].includes(p.orcamento.estado));
    const aprovados = decididos.filter((p) => p.orcamento!.estado === 'aprovado');
    const taxaAprovacao = decididos.length ? Math.round((aprovados.length / decididos.length) * 100) : 0;

    const ciclos = entregues.map((p) => ({ p, fim: dataEntrega(p) })).filter((x) => x.fim);
    const cicloMedio = ciclos.length
      ? Math.round((ciclos.reduce((s, x) => s + diasEntre(x.p.criadoEm, x.fim), 0) / ciclos.length) * 10) / 10
      : 0;
    const cumprimentoPrazo = ciclos.length
      ? Math.round((ciclos.filter((x) => x.fim! <= x.p.prazoEntrega).length / ciclos.length) * 100)
      : 0;

    const etapas = ESTADOS_ATIVOS.map((estado) => {
      const lista = ativos.filter((p) => p.estado === estado);
      return { estado, total: lista.length, atrasados: lista.filter(atrasado).length };
    });

    // Faturação dos últimos 6 meses, pela data de emissão da fatura.
    const hoje = new Date();
    const receitaMensal = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        mes: d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        receita: faturados.filter((p) => p.fatura!.data.startsWith(chave)).reduce((s, p) => s + p.fatura!.valorTotal, 0),
        atual: i === 5,
      };
    });

    return {
      ativos, atrasadas, receitaTotal, ticketMedio, pendente, comSaldo, decididos, aprovados,
      taxaAprovacao, cicloMedio, cumprimentoPrazo, etapas, receitaMensal,
      aguardaPecas: ativos.filter((p) => p.aguardaPecas).length,
      aguardaCliente: ativos.filter((p) => p.estado === 'aguarda_aprovacao').length,
    };
  }, [processos]);

  if (isPending) return <Carregando />;
  if (error || !ind || !processos) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const mecanicos = utilizadores
    .filter((u) => u.perfil === 'mecanico')
    .map((u) => ({ ...u, emCurso: ind.ativos.filter((p) => p.mecanicoId === u.id).length }));
  const maxConcluidas = Math.max(1, ...mecanicos.map((m) => m.osConcluidas ?? 0));
  const recentes = [...processos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 6);
  const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="pagina space-y-6">
      <PageHeader
        titulo="Painel"
        descricao={<span className="first-letter:uppercase">{hoje} · bom trabalho, {user?.nome.split(' ')[0]}</span>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Viaturas na oficina" value={String(ind.ativos.length)} hint={`${processos.length} processos registados`} to="/processos" />
        <StatTile
          label="Prazos ultrapassados"
          value={String(ind.atrasadas.length)}
          tom={ind.atrasadas.length ? 'alerta' : 'neutro'}
          hint="Entrega prometida já passou"
          to="/processos?filtro=atrasados"
        />
        <StatTile
          label="Aguardam o cliente"
          value={String(ind.aguardaCliente)}
          tom={ind.aguardaCliente ? 'aviso' : 'neutro'}
          hint="Diagnóstico e orçamento por aprovar"
          to="/processos?estado=aguarda_aprovacao"
        />
        <StatTile
          label="À espera de peças"
          value={String(ind.aguardaPecas)}
          tom={ind.aguardaPecas ? 'aviso' : 'neutro'}
          hint="Reparações paradas"
          to="/processos?filtro=pecas"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Onde estão as viaturas" subtitle="Viaturas em cada etapa · a vermelho, as que já passaram o prazo" />
          <div className="grid grid-cols-2 gap-px bg-linha sm:grid-cols-4">
            {ind.etapas.map((e, i) => (
              <Link
                key={e.estado}
                to={`/processos?estado=${e.estado}`}
                className="group flex min-h-[132px] flex-col justify-between bg-superficie p-4 transition-colors hover:bg-zinc-50"
              >
                <div>
                  <span className="num text-[11px] text-mzd-gray">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-0.5 text-[12.5px] font-semibold leading-tight text-mzd-black">{ESTADO_LABEL[e.estado]}</p>
                </div>
                <div>
                  <p className={clsx('font-display text-[32px] font-extrabold leading-none tabular-nums [font-stretch:100%]', e.total === 0 && 'text-zinc-300')}>
                    {e.total}
                  </p>
                  <div className="mt-2.5 flex h-[5px] gap-[2px]" aria-hidden>
                    {Array.from({ length: Math.max(e.total, 1) }, (_, k) => (
                      <span
                        key={k}
                        className={clsx(
                          'flex-1 rounded-[1px]',
                          e.total === 0 ? 'bg-zinc-100' : k < e.atrasados ? 'bg-mzd-red' : TOM_ESTADO[e.estado] === 'espera' ? 'bg-sinal-ambar' : TOM_ESTADO[e.estado] === 'pronto' ? 'bg-sinal-verde' : 'bg-mzd-black'
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 h-4 text-[11px] font-semibold text-sinal-vermelho">
                    {e.atrasados > 0 && `${e.atrasados} atrasada${e.atrasados > 1 ? 's' : ''}`}
                  </p>
                </div>
              </Link>
            ))}
            <Link to="/processos" className="flex min-h-[132px] flex-col justify-between bg-mzd-black p-4 text-white transition-colors hover:bg-mzd-graphite">
              <p className="rotulo !text-zinc-400">Total na oficina</p>
              <div>
                <p className="font-display text-[32px] font-extrabold leading-none tabular-nums [font-stretch:100%]">{ind.ativos.length}</p>
                <p className="mt-2 text-[11px] text-zinc-400">Ver quadro de processos →</p>
              </div>
            </Link>
          </div>
        </Card>

        <div className="space-y-4">
          <Alertas />
        <Card>
          <CardHeader
            title="Prazos ultrapassados"
            subtitle="Mais antigos primeiro"
            action={ind.atrasadas.length > 0 && <Link to="/processos?filtro=atrasados" className="text-xs font-semibold text-mzd-black underline-offset-4 hover:underline">Ver todos</Link>}
          />
          {ind.atrasadas.length === 0 ? (
            <Vazio titulo="Sem atrasos">Todas as viaturas estão dentro do prazo prometido.</Vazio>
          ) : (
            <ul className="divide-y divide-linha/70">
              {ind.atrasadas.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/processos/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50">
                    <Matricula valor={p.viatura.matricula} tamanho="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-mzd-black">{p.cliente.nome}</p>
                      <p className="truncate text-xs text-mzd-gray">{ESTADO_LABEL[p.estado]}</p>
                    </div>
                    <span className="num shrink-0 text-[13px] font-semibold text-sinal-vermelho">+{diasEntre(p.prazoEntrega)}d</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Cumprimento de prazo"
          value={`${ind.cumprimentoPrazo}%`}
          tom={ind.cumprimentoPrazo < 80 ? 'alerta' : 'neutro'}
          hint="Viaturas entregues dentro do prazo prometido"
        />
        <StatTile label="Aprovação de orçamentos" value={`${ind.taxaAprovacao}%`} hint={`${ind.aprovados.length} aprovados de ${ind.decididos.length} decididos pelo cliente`} />
        <StatTile label="Tempo médio na oficina" value={`${ind.cicloMedio.toLocaleString('pt-PT')} dias`} hint="Da receção à entrega" />
      </div>

      {verValores && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Faturação mensal" subtitle="Últimos 6 meses, por data de emissão · Kz com IVA" />
            <div className="h-64 px-2 pb-3 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ind.receitaMensal} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={COR.grelha} />
                  <XAxis dataKey="mes" {...eixo} />
                  <YAxis tickFormatter={milhares} {...eixo} axisLine={false} width={44} />
                  <Tooltip formatter={(v) => formatAOA(Number(v))} {...tooltip} />
                  <Bar dataKey="receita" name="Faturado" radius={[3, 3, 0, 0]} maxBarSize={44}>
                    {ind.receitaMensal.map((m) => <Cell key={m.mes} fill={m.atual ? COR.tinta : COR.tintaSuave} fillOpacity={m.atual ? 1 : 0.45} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Financeiro" subtitle="Todo o histórico" />
            <dl className="flex flex-1 flex-col divide-y divide-linha/70">
              <div className="px-5 py-4">
                <dt className="rotulo">Total faturado</dt>
                <dd className="mt-1 text-xl font-semibold"><Kz valor={ind.receitaTotal} /></dd>
              </div>
              <div className="px-5 py-4">
                <dt className="rotulo">Valor médio por fatura</dt>
                <dd className="mt-1 text-xl font-semibold"><Kz valor={ind.ticketMedio} /></dd>
              </div>
              <Link to="/faturacao" className="group px-5 py-4 hover:bg-zinc-50">
                <dt className="rotulo">Por receber</dt>
                <dd className="mt-1 text-xl font-semibold text-sinal-vermelho"><Kz valor={ind.pendente} /></dd>
                <dd className="mt-0.5 text-xs text-mzd-gray group-hover:underline">{ind.comSaldo} fatura(s) com saldo em aberto</dd>
              </Link>
            </dl>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Mecânicos" subtitle="OS concluídas (histórico) e trabalho em curso" />
          <ul className="space-y-4 px-5 py-4">
            {mecanicos.map((m) => (
              <li key={m.id}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-mzd-black">{m.nome}</span>
                  <span className="num text-xs text-mzd-gray">{m.osConcluidas ?? 0} concl. · {m.emCurso} em curso</span>
                </div>
                <div className="mt-1.5 h-[6px] rounded-[1px] bg-zinc-100">
                  <div className="h-full rounded-[1px] bg-mzd-black" style={{ width: `${((m.osConcluidas ?? 0) / maxConcluidas) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Entradas recentes" action={<Link to="/processos?vista=lista" className="text-xs font-semibold text-mzd-black underline-offset-4 hover:underline">Ver todos</Link>} />
          <Table>
            <thead>
              <tr>
                <Th>Viatura</Th>
                <Th>Cliente</Th>
                <Th className="w-40">Etapa</Th>
                {verValores && <Th direita>Orçamento</Th>}
                <Th>Prazo</Th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link to={`/processos/${p.id}`} className="flex items-center gap-2.5">
                      <Matricula valor={p.viatura.matricula} tamanho="sm" />
                      <span className="num text-xs text-mzd-gray">{p.numero}</span>
                    </Link>
                  </Td>
                  <Td className="text-mzd-black">{p.cliente.nome}</Td>
                  <Td>
                    <StatusBadge estado={p.estado} />
                    <StageTrack estado={p.estado} estadoAnterior={p.cancelamento?.estadoAnterior} atrasado={atrasado(p)} className="mt-1.5 w-32" />
                  </Td>
                  {verValores && <Td direita num className="text-mzd-gray">{p.orcamento ? formatAOA(calcularTotais(p.orcamento).total) : '—'}</Td>}
                  <Td num className={atrasado(p) ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray'}>{formatDate(p.prazoEntrega)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
