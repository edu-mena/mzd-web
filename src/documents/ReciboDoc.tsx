import type { Pagamento } from '../types';
import { FORMA_PAGAMENTO_LABEL } from '../types';
import DocumentShell, { Field, SectionTitle, SignatureLine } from './DocumentShell';
import { formatAOA, formatDateTime } from '../lib/format';
import { useUtilizadores } from '../api/hooks';

/** Recibo de um pagamento (adiantamento ou pagamento de fatura). Anulado → carimbo "ANULADO". */
export default function ReciboDoc({
  pagamento: pg,
  cliente,
  processoNumero,
  matricula,
  faturaNumero,
}: {
  pagamento: Pagamento;
  cliente: { nome: string; nif?: string };
  processoNumero: string;
  matricula?: string;
  faturaNumero?: string;
}) {
  const { data: utilizadores = [] } = useUtilizadores();
  const nome = (id: string) => utilizadores.find((u) => u.id === id)?.nome ?? '—';
  return (
    <DocumentShell title="Recibo" numero={pg.numeroRecibo}>
      <div className="relative">
        {pg.anulado && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="-rotate-12 rounded border-4 border-mzd-red px-6 py-2 font-display text-5xl font-extrabold tracking-widest text-mzd-red/70">ANULADO</span>
          </div>
        )}
        <p className="mb-6 text-[15px] leading-relaxed">
          Recebemos de <strong>{cliente.nome}</strong>{cliente.nif ? <>, NIF <span className="num">{cliente.nif}</span></> : ''}, a quantia de{' '}
          <strong className="num">{formatAOA(pg.valor)}</strong>, referente {faturaNumero ? <>à fatura <strong className="num">{faturaNumero}</strong></> : 'a adiantamento'} do processo{' '}
          <strong className="num">{processoNumero}</strong>{matricula ? <> (viatura <span className="num">{matricula}</span>)</> : ''}.
        </p>
        <SectionTitle>Pagamento</SectionTitle>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
          <Field label="Data" value={formatDateTime(pg.data)} />
          <Field label="Forma" value={FORMA_PAGAMENTO_LABEL[pg.forma]} />
          <Field label="Referência" value={pg.referencia ?? '—'} />
          <Field label="Recebido por" value={nome(pg.registadoPorId)} />
        </div>
        {pg.anulado && (
          <p className="mb-6 rounded-lg border border-mzd-red p-3 text-sm text-sinal-vermelho">
            Anulado em {formatDateTime(pg.anulado.data)} por {nome(pg.anulado.porId)}: {pg.anulado.motivo}
          </p>
        )}
        <div className="mt-10 grid grid-cols-2 gap-10">
          <SignatureLine label="Pela MZD Carros e Motores" />
          <SignatureLine label="O cliente" />
        </div>
      </div>
    </DocumentShell>
  );
}
