import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { mensagemErro } from '../../lib/erros';

export function EcraCarregamento() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-papel">
      <Loader2 size={22} className="animate-spin text-mzd-gray" aria-label="A carregar" />
    </div>
  );
}

/** Esqueleto de página enquanto os dados chegam (evita saltos de layout). */
export function Carregando({ texto = 'A carregar…' }: { texto?: string }) {
  return (
    <div role="status" aria-label={texto} className="space-y-4">
      <div className="h-7 w-56 animate-pulse rounded bg-zinc-200/80" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-200/60" />)}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-zinc-200/50" />
      <span className="sr-only">{texto}</span>
    </div>
  );
}

export function ErroCarregamento({ erro, onRepetir }: { erro: unknown; onRepetir?: () => void }) {
  const naoEncontrado = erro instanceof ApiError && erro.status === 404;
  return (
    <div className="mx-auto max-w-md py-16 text-center" role="alert">
      <AlertTriangle size={22} className="mx-auto text-mzd-gray" />
      <p className="mt-3 text-sm font-semibold text-mzd-black">{mensagemErro(erro)}</p>
      {!naoEncontrado && onRepetir && (
        <button onClick={onRepetir} className="mt-3 text-sm font-semibold text-mzd-black underline underline-offset-4 hover:text-mzd-gray">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Estado vazio com explicação do que aparece ali e, opcionalmente, uma ação. */
export function Vazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid grid-cols-3 gap-[3px] opacity-60" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-[1px] ${i === 4 ? 'bg-mzd-red' : 'bg-zinc-300'}`} />)}
      </div>
      <p className="text-sm font-semibold text-mzd-black">{titulo}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-mzd-gray">{children}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
