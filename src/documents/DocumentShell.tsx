import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import logoMzd from '../assets/logo.png';

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
  return (
    <div className="mx-auto max-w-[210mm] rounded-xl bg-white shadow-card ring-1 ring-zinc-200/70 print:shadow-none print:ring-0">
      <div className="no-print flex items-center justify-end gap-2 border-b border-zinc-100 px-6 py-3">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-mzd-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-mzd-graphite"
        >
          <Printer size={13} /> Exportar PDF
        </button>
      </div>

      <div className="px-4 py-6 text-[13px] text-mzd-black sm:px-8 sm:py-8 print:px-8 print:py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b-2 border-mzd-black pb-4">
          <div className="flex flex-col gap-1.5">
            <img src={logoMzd} alt="Grupo MZD — MZD Carros e Motores" className="h-12 w-auto" />
            <p className="text-[10px] leading-tight text-mzd-gray">Luanda, Angola · +244 923 000 000 · geral@mzdcarros.ao</p>
          </div>
          <div className="text-right">
            <h1 className="text-sm font-extrabold uppercase tracking-wide text-mzd-red">{title}</h1>
            {subtitle && <p className="text-xs text-mzd-gray">{subtitle}</p>}
            <p className="mt-1 text-xs font-semibold text-mzd-black">Nº {numero}</p>
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

export function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-8">
      <div className="border-t border-mzd-black pt-1">
        <p className="text-[10px] text-mzd-gray">{label}</p>
      </div>
    </div>
  );
}
