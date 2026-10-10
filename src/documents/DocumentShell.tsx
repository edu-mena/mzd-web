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

      <div className="documento px-4 py-6 text-mzd-black sm:px-8 sm:py-8 print:p-0">
        <header className="mb-5 border-b-2 border-mzd-black pb-3">
          <div className="flex items-start justify-between gap-6">
            {/* Altura fixa e largura proporcional: o logótipo nunca estica. */}
            <img src={logoMzd} alt="Grupo MZD — MZD Carros e Motores" className="h-[14mm] w-auto max-w-[45%] shrink-0 self-start object-contain object-left" />
            <div className="min-w-0 text-right">
              <h1 className="font-display text-[13pt] font-extrabold uppercase leading-tight tracking-wide text-mzd-red [font-stretch:110%]">{title}</h1>
              {subtitle && <p className="text-xs text-mzd-gray">{subtitle}</p>}
              <p className="num mt-1 text-sm font-semibold text-mzd-black">Nº {numero}</p>
            </div>
          </div>
          {e && (
            <p className="mt-2.5 text-[10px] leading-snug text-mzd-gray">
              <span className="font-semibold text-mzd-black">{e.nome}</span> · NIF <span className="num">{e.nif}</span>
              <br />
              {e.morada} · Tel. <span className="num">{e.telefone}</span> · {e.email}
            </p>
          )}
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

/** Contas para pagamento por transferência (a Direção define-as em Definições). */
export function CoordenadasPagamento({ referencia }: { referencia?: string }) {
  const { data: config } = useConfiguracao();
  const contas = config?.coordenadasPagamento ?? [];
  if (!contas.length) return null;
  return (
    <section className="mt-6 break-inside-avoid">
      <SectionTitle>Coordenadas de Pagamento</SectionTitle>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] font-bold uppercase text-mzd-gray">
            <th className="py-1.5">Banco</th>
            <th className="py-1.5">Titular</th>
            <th className="py-1.5">IBAN</th>
          </tr>
        </thead>
        <tbody>
          {contas.map((c) => (
            <tr key={c.id} className="border-b border-zinc-100 align-top">
              <td className="py-1.5 pr-3">{c.banco}</td>
              <td className="py-1.5 pr-3">{c.titular}</td>
              <td className="num py-1.5">{c.iban}{c.conta && <span className="block text-[11px] text-mzd-gray">Conta {c.conta}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-mzd-gray">
        Também aceitamos TPA, Multicaixa Express e numerário na oficina.
        {config?.instrucoesPagamento && <> {config.instrucoesPagamento}</>}
        {referencia && <> Referência: <span className="num font-semibold text-mzd-black">{referencia}</span>.</>}
      </p>
    </section>
  );
}

/** Linha do IVA nos totais: taxa, ou "isento" quando o documento é sem IVA. */
export function LinhaIva({ taxa, isencao, valor }: { taxa: number; isencao?: string; valor: ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-mzd-gray">{isencao ? 'IVA (isento)' : `IVA (${taxa}%)`}</span>
      <span>{valor}</span>
    </div>
  );
}

/** Motivo legal de um documento sem IVA. */
export function NotaIsencao({ isencao }: { isencao?: string }) {
  return isencao ? <p className="mt-2 text-right text-[11px] text-mzd-gray">Motivo da isenção de IVA: {isencao}</p> : null;
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
