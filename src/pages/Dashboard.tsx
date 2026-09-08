import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { AlertTriangle, Clock, PackageX, TrendingUp, Wallet, Wrench, CheckCircle2, Gauge } from 'lucide-react';
import { processos, utilizadores, getViatura, getCliente } from '../data/mock';
import { ESTADOS_ORDEM, ESTADO_LABEL } from '../types';
import { Card, CardHeader } from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import { diasEntre, formatAOA, orcamentoTotal, formatDate } from '../lib/format';
import { Link } from 'react-router-dom';

const CHART_GRAY = '#8E8E8E';
const CHART_RED = '#E60000';
const CHART_BLACK = '#232323';

export default function Dashboard() {
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('mes');

  const funil = useMemo(
    () =>
      ESTADOS_ORDEM.filter((e) => e !== 'entregue').map((estado) => ({
        estado: ESTADO_LABEL[estado],
        total: processos.filter((p) => p.estado === estado).length,
      })),
    []
  );

  const atrasadas = processos.filter((p) => p.estado !== 'entregue' && diasEntre(p.prazoEntrega) > 0);
  const aguardaPecas = processos.filter((p) => p.aguardaPecas);
  const ativos = processos.filter((p) => p.estado !== 'entregue');
  const entregues = processos.filter((p) => p.estado === 'entregue');

  const receitaTotal = entregues.reduce((s, p) => s + (p.fatura?.valorTotal ?? orcamentoTotal(p.orcamento)), 0);
  const ticketMedio = entregues.length ? receitaTotal / entregues.length : 0;
  const pendentePagamento = processos.filter((p) => p.fatura && !p.fatura.pago).reduce((s, p) => s + (p.fatura?.valorTotal ?? 0), 0);

  const orcamentosEmitidos = processos.filter((p) => p.orcamento);
  const orcamentosAprovados = orcamentosEmitidos.filter((p) => p.orcamento?.estado === 'aprovado' || ESTADOS_ORDEM.indexOf(p.estado) > ESTADOS_ORDEM.indexOf('aguarda_autorizacao'));
  const taxaAprovacao = orcamentosEmitidos.length ? Math.round((orcamentosAprovados.length / orcamentosEmitidos.length) * 100) : 0;

  const checklists = processos.filter((p) => p.checklistQualidade);
  const checklistsAprovados = checklists.filter((p) => p.checklistQualidade?.aprovado);
  const taxaQualidade = checklists.length ? Math.round((checklistsAprovados.length / checklists.length) * 100) : 0;

  const tempoCicloMedio = entregues.length
    ? Math.round(entregues.reduce((s, p) => s + diasEntre(p.criadoEm, p.historico[p.historico.length - 1]?.data ?? p.criadoEm), 0) / entregues.length * 10) / 10
    : 0;

  const cumprimentoPrazo = entregues.length
    ? Math.round((entregues.filter((p) => new Date(p.historico[p.historico.length - 1]?.data ?? p.criadoEm) <= new Date(p.prazoEntrega)).length / entregues.length) * 100)
    : 0;

  const produtividade = utilizadores
    .filter((u) => u.perfil === 'mecanico')
    .map((u) => ({ nome: u.nome.split(' ')[0], concluidas: u.osConcluidas ?? 0, tempoMedio: u.tempoMedioHoras ?? 0 }));

  const receitaMensal = useMemo(() => {
    const meses = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];
    return meses.map((m, i) => ({
      mes: m,
      receita: Math.round(1_800_000 + i * 220_000 + (i % 2 === 0 ? 180_000 : -90_000)),
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Painel de Gestão</h1>
          <p className="text-sm text-mzd-gray">Visão geral da oficina — MZD Carros e Motores</p>
        </div>
        <div className="flex rounded-lg bg-white p-1 shadow-card ring-1 ring-zinc-200/70">
          {(['hoje', 'semana', 'mes'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                periodo === p ? 'bg-mzd-black text-white' : 'text-mzd-gray hover:text-mzd-black'
              }`}
            >
              {p === 'mes' ? 'Este mês' : p === 'semana' ? 'Esta semana' : 'Hoje'}
            </button>
          ))}
        </div>
      </div>

      {/* Operational at-a-glance */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Viaturas ativas" value={String(ativos.length)} icon={<Wrench size={16} />} hint={`${processos.length} processos no total`} />
        <StatTile
          label="Prazos em risco"
          value={String(atrasadas.length)}
          icon={<AlertTriangle size={16} />}
          delta={atrasadas.length > 0 ? `${atrasadas.length} atrasadas` : undefined}
          deltaGood={false}
          hint="Entrega prometida ultrapassada"
        />
        <StatTile label="À espera de peças" value={String(aguardaPecas.length)} icon={<PackageX size={16} />} hint="Gargalo de reparação" />
        <StatTile label="Ciclo médio" value={`${tempoCicloMedio} dias`} icon={<Clock size={16} />} hint="Receção → entrega" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Funil de Processos" subtitle="Nº de viaturas em cada etapa (exclui entregues)" />
          <div className="h-72 px-3 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funil} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: CHART_GRAY }} axisLine={{ stroke: '#e4e4e7' }} />
                <YAxis dataKey="estado" type="category" width={150} tick={{ fontSize: 12, fill: CHART_BLACK }} axisLine={{ stroke: '#e4e4e7' }} />
                <Tooltip cursor={{ fill: '#fafafa' }} contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Bar dataKey="total" fill={CHART_RED} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Alertas de Prazo" subtitle="Viaturas atrasadas" />
          <div className="max-h-72 overflow-y-auto px-5 py-3">
            {atrasadas.length === 0 && <p className="py-6 text-center text-sm text-mzd-gray">Sem atrasos — tudo dentro do prazo.</p>}
            <ul className="space-y-3">
              {atrasadas.slice(0, 6).map((p) => {
                const v = getViatura(p.viaturaId);
                const c = getCliente(p.clienteId);
                return (
                  <li key={p.id}>
                    <Link to={`/processos/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-mzd-black">{v.matricula} · {c.nome.split(' ')[0]}</p>
                        <p className="text-xs text-mzd-gray">{p.numero}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-mzd-red">
                        +{diasEntre(p.prazoEntrega)}d
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatTile label="Cumprimento de prazo" value={`${cumprimentoPrazo}%`} icon={<Gauge size={16} />} hint="OS entregues no prazo prometido" />
        <StatTile label="Taxa de aprovação de orçamentos" value={`${taxaAprovacao}%`} icon={<CheckCircle2 size={16} />} hint={`${orcamentosAprovados.length} de ${orcamentosEmitidos.length} orçamentos`} />
        <StatTile label="Qualidade à 1ª" value={`${taxaQualidade}%`} icon={<TrendingUp size={16} />} hint="Aprovados sem retrabalho" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Receita" subtitle="Últimos 6 meses (Kz)" />
          <div className="h-64 px-3 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={receitaMensal} margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: CHART_GRAY }} axisLine={{ stroke: '#e4e4e7' }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: CHART_GRAY }} axisLine={{ stroke: '#e4e4e7' }} width={48} />
                <Tooltip formatter={(v: any) => formatAOA(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Line type="monotone" dataKey="receita" stroke={CHART_RED} strokeWidth={2.5} dot={{ r: 3, fill: CHART_RED }} name="Receita" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Financeiro" />
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase text-mzd-gray">Receita no período</p>
              <p className="text-lg font-extrabold text-mzd-black">{formatAOA(receitaTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-mzd-gray">Ticket médio</p>
              <p className="text-lg font-extrabold text-mzd-black">{formatAOA(ticketMedio)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-mzd-gray">Faturação pendente</p>
              <p className="flex items-center gap-1.5 text-lg font-extrabold text-mzd-red">
                <Wallet size={16} /> {formatAOA(pendentePagamento)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Produtividade por Mecânico" subtitle="OS concluídas e tempo médio por OS" />
        <div className="h-64 px-3 pb-4 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={produtividade} margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: CHART_GRAY }} axisLine={{ stroke: '#e4e4e7' }} />
              <YAxis tick={{ fontSize: 12, fill: CHART_GRAY }} axisLine={{ stroke: '#e4e4e7' }} width={32} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="concluidas" name="OS concluídas" fill={CHART_BLACK} radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Processos recentes" action={<Link to="/processos" className="text-xs font-semibold text-mzd-red hover:underline">Ver todos →</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Nº OS</th>
                <th className="px-5 py-2.5">Cliente</th>
                <th className="px-5 py-2.5">Viatura</th>
                <th className="px-5 py-2.5">Estado</th>
                <th className="px-5 py-2.5">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {processos.slice(0, 6).map((p) => {
                const v = getViatura(p.viaturaId);
                const c = getCliente(p.clienteId);
                return (
                  <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link to={`/processos/${p.id}`} className="font-semibold text-mzd-black hover:text-mzd-red">{p.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-mzd-black">{c.nome}</td>
                    <td className="px-5 py-3 text-mzd-gray">{v.matricula} · {v.marca} {v.modelo}</td>
                    <td className="px-5 py-3"><StatusBadge estado={p.estado} /></td>
                    <td className="px-5 py-3 text-mzd-gray">{formatDate(p.prazoEntrega)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
