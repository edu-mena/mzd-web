import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { processos, getCliente, getViatura } from '../data/mock';
import { Card } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function Agenda() {
  const [refDate, setRefDate] = useState(new Date());
  const weekStart = startOfWeek(refDate);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const porDia = useMemo(() => {
    const map = new Map<string, typeof processos>();
    dias.forEach((d) => map.set(d.toDateString(), []));
    processos.forEach((p) => {
      const entrega = new Date(p.prazoEntrega);
      const key = entrega.toDateString();
      if (map.has(key)) map.get(key)!.push(p);
    });
    return map;
  }, [refDate]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Agenda / Marcações</h1>
          <p className="text-sm text-mzd-gray">Entregas prometidas por dia — gestão de carga de trabalho</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefDate((d) => new Date(d.getTime() - 7 * 86400000))} className="rounded-lg bg-white p-2 shadow-card ring-1 ring-zinc-200/70 hover:bg-zinc-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-mzd-black">
            {weekStart.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} – {dias[6].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
          </span>
          <button onClick={() => setRefDate((d) => new Date(d.getTime() + 7 * 86400000))} className="rounded-lg bg-white p-2 shadow-card ring-1 ring-zinc-200/70 hover:bg-zinc-50">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((d) => {
          const itens = porDia.get(d.toDateString()) ?? [];
          const hoje = d.toDateString() === new Date().toDateString();
          return (
            <Card key={d.toISOString()} className={hoje ? 'ring-2 ring-mzd-red' : ''}>
              <div className="border-b border-zinc-100 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase text-mzd-gray">{d.toLocaleDateString('pt-PT', { weekday: 'short' })}</p>
                <p className="text-sm font-extrabold text-mzd-black">{d.getDate()}</p>
              </div>
              <div className="space-y-2 p-2">
                {itens.map((p) => {
                  const v = getViatura(p.viaturaId);
                  const c = getCliente(p.clienteId);
                  return (
                    <Link to={`/processos/${p.id}`} key={p.id} className="block rounded-lg bg-zinc-50 p-2 hover:bg-zinc-100">
                      <p className="truncate text-xs font-bold text-mzd-black">{v.matricula}</p>
                      <p className="truncate text-[11px] text-mzd-gray">{c.nome.split(' ')[0]}</p>
                      <StatusBadge estado={p.estado} className="mt-1 !text-[9px] !px-1.5 !py-0.5" />
                    </Link>
                  );
                })}
                {itens.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-mzd-gray">Sem entregas</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
