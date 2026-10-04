import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Cabeçalho de página: ligação de retorno opcional, título, descrição e ações. */
export default function PageHeader({
  titulo,
  descricao,
  voltar,
  acoes,
  extra,
  tituloDocumento,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  voltar?: { to: string; label: string };
  acoes?: ReactNode;
  /** Conteúdo junto ao título (ex.: estado do processo). */
  extra?: ReactNode;
  /** Título do separador do navegador, quando `titulo` não é texto simples. */
  tituloDocumento?: string;
}) {
  const doc = tituloDocumento ?? (typeof titulo === 'string' ? titulo : undefined);
  useEffect(() => {
    if (doc) document.title = `${doc} · MZD`;
  }, [doc]);
  return (
    <header className="no-print">
      {voltar && (
        <Link to={voltar.to} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-mzd-gray hover:text-mzd-black">
          <ArrowLeft size={14} /> {voltar.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[22px] font-extrabold leading-tight text-mzd-black sm:text-2xl">{titulo}</h1>
            {extra}
          </div>
          {descricao && <div className="mt-1 text-sm text-mzd-gray">{descricao}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
