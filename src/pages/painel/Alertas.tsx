import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import clsx from 'clsx';
import { useAlertas } from '../../api/hooks';
import type { GravidadeAlerta } from '../../types';
import { Card, CardHeader } from '../../components/ui/Card';

const ICONE: Record<GravidadeAlerta, { Icone: typeof Info; cor: string; rotulo: string }> = {
  critico: { Icone: AlertOctagon, cor: 'text-sinal-vermelho', rotulo: 'Urgente' },
  aviso: { Icone: AlertTriangle, cor: 'text-sinal-ambar', rotulo: 'Atenção' },
  info: { Icone: Info, cor: 'text-mzd-gray', rotulo: 'Para hoje' },
};

/** O que pede atenção ou decisão de quem está a ver (o servidor já filtra pelas permissões). */
export default function Alertas({ className }: { className?: string }) {
  const { data: alertas, isPending } = useAlertas();
  return (
    <Card className={className}>
      <CardHeader title="Pede atenção" subtitle={alertas?.length ? 'Por ordem de urgência' : undefined} />
      {isPending ? (
        <p className="px-5 py-6 text-sm text-mzd-gray">A verificar…</p>
      ) : !alertas?.length ? (
        <p className="px-5 py-6 text-sm text-mzd-gray">Nada pendente. Bom trabalho.</p>
      ) : (
        <ul className="divide-y divide-linha/70">
          {alertas.map((a) => {
            const { Icone, cor, rotulo } = ICONE[a.gravidade];
            return (
              <li key={a.id}>
                <Link to={a.link} className="group flex items-start gap-3 px-5 py-3 hover:bg-zinc-50">
                  <Icone size={16} className={clsx('mt-0.5 shrink-0', cor)} aria-label={rotulo} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-mzd-black">{a.titulo}</span>
                    <span className="block text-xs text-mzd-gray">{a.texto}</span>
                  </span>
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-zinc-300 group-hover:text-mzd-black" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
