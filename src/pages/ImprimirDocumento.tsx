import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProcesso } from '../api/hooks';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { FichaEntradaModelo } from '../documents/FichaRecepcaoDoc';
import OrcamentoDoc from '../documents/OrcamentoDoc';

const TITULOS = { ficha: 'Ficha de entrada', proforma: 'Pró-forma' } as const;

/**
 * Documento sozinho numa página, para imprimir: a ficha de entrada (a receção entrega-a ao mecânico)
 * ou a pró-forma (o cliente assina na oficina). Abre o diálogo de impressão quando está pronto.
 */
export default function ImprimirDocumento() {
  const { id = '', documento = '' } = useParams();
  const { data: processo, isPending, error, refetch } = useProcesso(id);
  const impresso = useRef(false);
  const tipo = documento === 'proforma' ? 'proforma' : 'ficha';

  useEffect(() => {
    if (!processo || impresso.current) return;
    impresso.current = true;
    document.title = `${TITULOS[tipo]} · ${processo.numero}`;
    // Esperar pelas fontes e imagens (logótipo) antes de abrir o diálogo.
    void document.fonts.ready.then(() => setTimeout(() => window.print(), 400));
  }, [processo, tipo]);

  if (isPending) return <Carregando />;
  if (error || !processo) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  return (
    <div className="min-h-[100dvh] bg-papel px-3 py-4 print:bg-white print:p-0">
      <p className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 text-sm">
        <Link to={`/processos/${processo.id}`} className="inline-flex items-center gap-1.5 font-semibold text-mzd-black hover:underline">
          <ArrowLeft size={15} /> Voltar ao processo {processo.numero}
        </Link>
        <span className="text-mzd-gray">{TITULOS[tipo]}</span>
      </p>
      {tipo === 'proforma' ? <OrcamentoDoc processo={processo} /> : <FichaEntradaModelo processo={processo} />}
    </div>
  );
}
