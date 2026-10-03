import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import logoMzd from '../assets/logo.png';
import { useAnexos, useConfiguracao } from '../api/hooks';
import { ImagemAnexo } from '../components/ui/Anexos';

export default function DocumentShell({
  title,
  subtitle,
  numero,
  children,
}: {
  title: string;
  subtitle?: string;
  numero: string;
  children: ReactNode;
}) {
  const { data: config } = useConfiguracao();
  const e = config?.empresa;
  return (
    <div className="mx-auto max-w-[210mm] rounded-lg border border-linha bg-white print:border-0">
      <div className="no-print flex items-center justify-end gap-2 border-b border-linha bg-zinc-50/60 px-4 py-2.5">
        <button
          onClick={() => window.print()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-mzd-black px-3 text-xs font-semibold text-white hover:bg-mzd-graphite"
        >
          <Printer size={13} /> Exportar PDF
        </button>
      </div>

      <div className="px-4 py-6 text-[13px] text-mzd-black sm:px-8 sm:py-8 print:px-8 print:py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b-2 border-mzd-black pb-4">
          <div className="flex flex-col gap-1.5">
            <img src={logoMzd} alt="Grupo MZD — MZD Carros e Motores" className="h-12 w-auto" />
            {e && (
              <p className="text-[10px] leading-tight text-mzd-gray">
                {e.nome} · NIF {e.nif}
                <br />
                {e.morada} · {e.telefone} · {e.email}
              </p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-sm font-extrabold uppercase tracking-wide text-mzd-red">{title}</h1>
            {subtitle && <p className="text-xs text-mzd-gray">{subtitle}</p>}
            <p className="num mt-1 text-xs font-semibold text-mzd-black">Nº {numero}</p>
          </div>
        </header>

        {children}

        <footer className="mt-8 border-t border-zinc-200 pt-3 text-center text-[10px] text-mzd-gray">
          Grupo MZD — Movendo Negócios, Inspirando Campeões · Documento gerado eletronicamente pelo sistema de gestão de oficina.
        </footer>
      </div>
    </div>
  );
}

export function Field({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-mzd-gray">{label}</p>
      <p className="text-sm font-medium text-mzd-black">{value ?? '—'}</p>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 border-l-4 border-mzd-red pl-2 text-xs font-extrabold uppercase tracking-wide text-mzd-black">{children}</h2>;
}

/** Linha de assinatura; com `anexoId`, mostra a assinatura recolhida no ecrã por cima da linha. */
export function SignatureLine({ label, processoId, anexoId }: { label: string; processoId?: string; anexoId?: string }) {
  const { data: anexos = [] } = useAnexos(processoId ?? '', !!anexoId);
  const anexo = anexos.find((a) => a.id === anexoId);
  return (
    <div className={anexo ? 'pt-1' : 'pt-8'}>
      {anexo && <ImagemAnexo anexo={anexo} alt={label} className="h-16 w-auto max-w-full object-contain" />}
      <div className="border-t border-mzd-black pt-1">
        <p className="text-[10px] text-mzd-gray">{label}</p>
      </div>
    </div>
  );
}
