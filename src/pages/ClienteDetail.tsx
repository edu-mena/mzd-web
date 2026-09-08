import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car } from 'lucide-react';
import { getCliente, viaturas, processos } from '../data/mock';
import { Card, CardHeader } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate, orcamentoTotal, formatAOA } from '../lib/format';

export default function ClienteDetail() {
  const { id } = useParams();
  const cliente = id ? getCliente(id) : undefined;
  if (!cliente) return <p className="text-mzd-gray">Cliente não encontrado.</p>;

  const viaturasCliente = viaturas.filter((v) => v.clienteId === cliente.id);
  const processosCliente = processos.filter((p) => p.clienteId === cliente.id);

  return (
    <div className="space-y-5">
      <Link to="/clientes" className="flex items-center gap-1.5 text-sm font-semibold text-mzd-gray hover:text-mzd-black">
        <ArrowLeft size={15} /> Clientes
      </Link>

      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mzd-black text-lg font-bold text-white">
          {cliente.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-mzd-gray">
            <span className="flex items-center gap-1.5"><Phone size={13} /> {cliente.telefone}</span>
            <span className="flex items-center gap-1.5"><Mail size={13} /> {cliente.email}</span>
            <span>NIF: {cliente.nif}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Viaturas" subtitle={`${viaturasCliente.length} veículo(s)`} />
          <div className="divide-y divide-zinc-50">
            {viaturasCliente.map((v) => (
              <Link to={`/viaturas/${v.id}`} key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                <Car size={16} className="text-mzd-gray" />
                <div>
                  <p className="text-sm font-semibold text-mzd-black">{v.matricula}</p>
                  <p className="text-xs text-mzd-gray">{v.marca} {v.modelo} · {v.ano}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Histórico de Processos" subtitle={`${processosCliente.length} processo(s)`} />
          <div className="divide-y divide-zinc-50">
            {processosCliente.map((p) => (
              <Link to={`/processos/${p.id}`} key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50">
                <div>
                  <p className="text-sm font-semibold text-mzd-black">{p.numero}</p>
                  <p className="text-xs text-mzd-gray">{formatDate(p.criadoEm)} · {p.orcamento ? formatAOA(orcamentoTotal(p.orcamento)) : '—'}</p>
                </div>
                <StatusBadge estado={p.estado} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
