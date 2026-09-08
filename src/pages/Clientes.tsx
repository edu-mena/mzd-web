import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Phone, Mail } from 'lucide-react';
import { clientes, processos } from '../data/mock';
import { Card } from '../components/ui/Card';
import { formatDate } from '../lib/format';

export default function Clientes() {
  const [query, setQuery] = useState('');
  const filtrados = clientes.filter((c) => c.nome.toLowerCase().includes(query.toLowerCase()) || c.telefone.includes(query));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Clientes</h1>
          <p className="text-sm text-mzd-gray">{clientes.length} clientes registados</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-mzd-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-mzd-redDark">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome ou telefone…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Cliente</th>
                <th className="px-5 py-2.5">Contacto</th>
                <th className="px-5 py-2.5">NIF</th>
                <th className="px-5 py-2.5">Viaturas</th>
                <th className="px-5 py-2.5">Processos</th>
                <th className="px-5 py-2.5">Cliente desde</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const nProc = processos.filter((p) => p.clienteId === c.id).length;
                return (
                  <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link to={`/clientes/${c.id}`} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-mzd-black">
                          {c.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                        </span>
                        <span className="font-semibold text-mzd-black hover:text-mzd-red">{c.nome}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-mzd-gray">
                      <div className="flex items-center gap-1.5"><Phone size={12} /> {c.telefone}</div>
                      <div className="mt-0.5 flex items-center gap-1.5"><Mail size={12} /> {c.email}</div>
                    </td>
                    <td className="px-5 py-3 text-mzd-gray">{c.nif}</td>
                    <td className="px-5 py-3 text-mzd-gray">{c.viaturasIds.length}</td>
                    <td className="px-5 py-3 text-mzd-gray">{nProc}</td>
                    <td className="px-5 py-3 text-mzd-gray">{formatDate(c.desde)}</td>
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
