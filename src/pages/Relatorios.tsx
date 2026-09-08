import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { processos, utilizadores } from '../data/mock';
import { Card, CardHeader } from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import { useToast } from '../components/ui/Toast';

const CHART_RED = '#E60000';
const CHART_BLACK = '#232323';
const CHART_GRAY = '#8E8E8E';
const PIE_COLORS = ['#E60000', '#232323', '#8E8E8E', '#f4c95d'];

export default function Relatorios() {
  const [periodo, setPeriodo] = useState('mes');
  const toast = useToast();

  const motivosRecusa = [
    { motivo: 'Preço elevado', total: 6 },
    { motivo: 'Vai comparar orçamento', total: 4 },
    { motivo: 'Vai vender a viatura', total: 2 },
    { motivo: 'Sem urgência', total: 3 },
  ];

  const receitaPorTipo = [
    { tipo: 'Peças', valor: 45 },
    { tipo: 'Mão de Obra', valor: 38 },
    { tipo: 'Diagnóstico', valor: 10 },
    { tipo: 'Outros', valor: 7 },
  ];

  const entregues = processos.filter((p) => p.estado === 'entregue');
  const retrabalho = Math.round((processos.filter((p) => p.checklistQualidade && !p.checklistQualidade.aprovado).length / Math.max(processos.filter((p) => p.checklistQualidade).length, 1)) * 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Relatórios & KPIs</h1>
          <p className="text-sm text-mzd-gray">Visão aprofundada para reuniões de direção</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-mzd-red">
            <option value="hoje">Hoje</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mês</option>
            <option value="custom">Personalizado</option>
          </select>
          <button onClick={() => toast('Relatório exportado em PDF')} className="flex items-center gap-1.5 rounded-lg bg-mzd-black px-3.5 py-2 text-sm font-semibold text-white hover:bg-mzd-graphite">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => toast('Relatório exportado em Excel')} className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-mzd-black shadow-card ring-1 ring-zinc-200/70 hover:bg-zinc-50">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Taxa de retrabalho" value={`${retrabalho}%`} hint="Reprovações em qualidade" />
        <StatTile label="Viaturas entregues" value={String(entregues.length)} hint="No período selecionado" />
        <StatTile label="Satisfação pós-entrega" value="4.6 / 5" hint="Baseado em 32 respostas" />
        <StatTile label="OS com garantia ativa" value={String(processos.filter((p) => p.garantias?.length).length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Motivos de Recusa de Orçamento" />
          <div className="h-64 px-3 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={motivosRecusa} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: CHART_GRAY }} />
                <YAxis dataKey="motivo" type="category" width={140} tick={{ fontSize: 12, fill: CHART_BLACK }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Bar dataKey="total" fill={CHART_RED} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Receita por Tipo de Serviço" subtitle="% do total faturado" />
          <div className="h-64 px-3 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={receitaPorTipo} dataKey="valor" nameKey="tipo" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {receitaPorTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Produtividade Detalhada por Mecânico" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Mecânico</th>
                <th className="px-5 py-2.5">OS Concluídas</th>
                <th className="px-5 py-2.5">Tempo Médio / OS</th>
              </tr>
            </thead>
            <tbody>
              {utilizadores.filter((u) => u.perfil === 'mecanico').map((u) => (
                <tr key={u.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-mzd-black">{u.nome}</td>
                  <td className="px-5 py-3 text-mzd-gray">{u.osConcluidas}</td>
                  <td className="px-5 py-3 text-mzd-gray">{u.tempoMedioHoras}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
