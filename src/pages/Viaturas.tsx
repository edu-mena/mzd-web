import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { viaturas, getCliente, processos } from '../data/mock';
import { Card } from '../components/ui/Card';

export default function Viaturas() {
  const [query, setQuery] = useState('');
  const filtrados = viaturas.filter(
    (v) => v.matricula.toLowerCase().includes(query.toLowerCase()) || `${v.marca} ${v.modelo}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">Viaturas</h1>
        <p className="text-sm text-mzd-gray">{viaturas.length} veículos no histórico da oficina</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por matrícula, marca ou modelo…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Matrícula</th>
                <th className="px-5 py-2.5">Marca / Modelo</th>
                <th className="px-5 py-2.5">Ano</th>
                <th className="px-5 py-2.5">Cor</th>
                <th className="px-5 py-2.5">Km</th>
                <th className="px-5 py-2.5">Proprietário</th>
                <th className="px-5 py-2.5">Serviços</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => {
                const cliente = getCliente(v.clienteId);
                const n = processos.filter((p) => p.viaturaId === v.id).length;
                return (
                  <tr key={v.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link to={`/viaturas/${v.id}`} className="font-semibold text-mzd-black hover:text-mzd-red">{v.matricula}</Link>
                    </td>
                    <td className="px-5 py-3 text-mzd-black">{v.marca} {v.modelo}</td>
                    <td className="px-5 py-3 text-mzd-gray">{v.ano}</td>
                    <td className="px-5 py-3 text-mzd-gray">{v.cor}</td>
                    <td className="px-5 py-3 text-mzd-gray">{v.km.toLocaleString('pt-PT')} km</td>
                    <td className="px-5 py-3 text-mzd-gray">
                      <Link to={`/clientes/${cliente.id}`} className="hover:text-mzd-red">{cliente.nome}</Link>
                    </td>
                    <td className="px-5 py-3 text-mzd-gray">{n}</td>
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
