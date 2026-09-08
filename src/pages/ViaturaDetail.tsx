import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, Palette, Hash } from 'lucide-react';
import { getViatura, getCliente, processos } from '../data/mock';
import { Card, CardHeader } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate, orcamentoTotal, formatAOA } from '../lib/format';

export default function ViaturaDetail() {
  const { id } = useParams();
  const viatura = id ? getViatura(id) : undefined;
  if (!viatura) return <p className="text-mzd-gray">Viatura não encontrada.</p>;
  const cliente = getCliente(viatura.clienteId);
  const historico = processos.filter((p) => p.viaturaId === viatura.id);

  return (
    <div className="space-y-5">
      <Link to="/viaturas" className="flex items-center gap-1.5 text-sm font-semibold text-mzd-gray hover:text-mzd-black">
        <ArrowLeft size={15} /> Viaturas
      </Link>

      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">{viatura.matricula} — {viatura.marca} {viatura.modelo}</h1>
        <p className="mt-1 text-sm text-mzd-gray">
          Proprietário: <Link to={`/clientes/${cliente.id}`} className="font-semibold text-mzd-black hover:text-mzd-red">{cliente.nome}</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniStat icon={<Gauge size={15} />} label="Quilometragem" value={`${viatura.km.toLocaleString('pt-PT')} km`} />
        <MiniStat icon={<Palette size={15} />} label="Cor / Ano" value={`${viatura.cor} · ${viatura.ano}`} />
        <MiniStat icon={<Hash size={15} />} label="Chassi" value={viatura.chassi} />
        <MiniStat icon={<Hash size={15} />} label="Nº de serviços" value={String(historico.length)} />
      </div>

      <Card>
        <CardHeader title="Histórico de Serviços" subtitle="Essencial para diagnósticos futuros e manutenção preventiva" />
        <div className="divide-y divide-zinc-50">
          {historico.map((p) => (
            <Link to={`/processos/${p.id}`} key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50">
              <div>
                <p className="text-sm font-semibold text-mzd-black">{p.numero}</p>
                <p className="text-xs text-mzd-gray">{formatDate(p.criadoEm)} · {p.fichaRecepcao.queixaCliente}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-mzd-gray">{p.orcamento ? formatAOA(orcamentoTotal(p.orcamento)) : '—'}</span>
                <StatusBadge estado={p.estado} />
              </div>
            </Link>
          ))}
          {historico.length === 0 && <p className="px-5 py-8 text-center text-sm text-mzd-gray">Sem histórico de serviços.</p>}
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-zinc-200/70">
      <div className="flex items-center gap-1.5 text-mzd-red">{icon}</div>
      <p className="mt-1.5 text-xs font-semibold uppercase text-mzd-gray">{label}</p>
      <p className="text-sm font-bold text-mzd-black">{value}</p>
    </div>
  );
}
