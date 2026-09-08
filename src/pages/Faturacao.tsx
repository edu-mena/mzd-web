import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { processos, getCliente, getViatura } from '../data/mock';
import { Card } from '../components/ui/Card';
import { formatAOA, formatDate } from '../lib/format';
import StatTile from '../components/ui/StatTile';
import { Wallet, CheckCircle2, Clock3 } from 'lucide-react';

export default function Faturacao() {
  const [query, setQuery] = useState('');
  const faturas = processos.filter((p) => p.fatura).filter((p) => {
    const v = getViatura(p.viaturaId);
    const c = getCliente(p.clienteId);
    return p.fatura!.numero.toLowerCase().includes(query.toLowerCase()) || c.nome.toLowerCase().includes(query.toLowerCase()) || v.matricula.toLowerCase().includes(query.toLowerCase());
  });

  const totalFaturado = faturas.reduce((s, p) => s + p.fatura!.valorTotal, 0);
  const totalPago = faturas.filter((p) => p.fatura!.pago).reduce((s, p) => s + p.fatura!.valorTotal, 0);
  const totalPendente = totalFaturado - totalPago;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">Faturação & Pagamentos</h1>
        <p className="text-sm text-mzd-gray">{faturas.length} fatura(s) emitidas</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total faturado" value={formatAOA(totalFaturado)} icon={<Wallet size={16} />} />
        <StatTile label="Pago" value={formatAOA(totalPago)} icon={<CheckCircle2 size={16} />} />
        <StatTile label="Pendente" value={formatAOA(totalPendente)} icon={<Clock3 size={16} />} />
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar fatura, cliente ou matrícula…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Fatura</th>
                <th className="px-5 py-2.5">Cliente</th>
                <th className="px-5 py-2.5">Viatura</th>
                <th className="px-5 py-2.5">Data</th>
                <th className="px-5 py-2.5">Forma Pag.</th>
                <th className="px-5 py-2.5">Valor</th>
                <th className="px-5 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((p) => {
                const c = getCliente(p.clienteId);
                const v = getViatura(p.viaturaId);
                return (
                  <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link to={`/processos/${p.id}`} className="font-semibold text-mzd-black hover:text-mzd-red">{p.fatura!.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-mzd-black">{c.nome}</td>
                    <td className="px-5 py-3 text-mzd-gray">{v.matricula}</td>
                    <td className="px-5 py-3 text-mzd-gray">{formatDate(p.fatura!.data)}</td>
                    <td className="px-5 py-3 text-mzd-gray capitalize">{p.fatura!.formaPagamento}</td>
                    <td className="px-5 py-3 font-semibold text-mzd-black">{formatAOA(p.fatura!.valorTotal)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.fatura!.pago ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {p.fatura!.pago ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
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
