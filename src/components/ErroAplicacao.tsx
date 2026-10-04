import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const CHAVE_RECARGA = 'mzd.recarregado-em';

/** Depois de uma publicação, os ficheiros antigos deixam de existir e abrir uma página nova falha. */
const versaoNova = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically/i.test(e.message);

/**
 * Rede de segurança: um erro ao desenhar uma página mostra uma mensagem útil em vez de um ecrã branco.
 * Se o erro vier de uma versão nova publicada entretanto, recarrega sozinho (uma vez por minuto, no máximo).
 */
export default class ErroAplicacao extends Component<{ children: ReactNode }, { erro: unknown }> {
  state = { erro: null as unknown };

  static getDerivedStateFromError(erro: unknown) {
    return { erro };
  }

  componentDidCatch(erro: unknown, info: ErrorInfo) {
    if (versaoNova(erro)) {
      let ultima = 0;
      try { ultima = Number(sessionStorage.getItem(CHAVE_RECARGA)) || 0; } catch { /* sem armazenamento */ }
      if (Date.now() - ultima > 60_000) {
        try { sessionStorage.setItem(CHAVE_RECARGA, String(Date.now())); } catch { /* sem armazenamento */ }
        window.location.reload();
        return;
      }
    }
    console.error('Erro na aplicação', erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    const nova = versaoNova(this.state.erro);
    return (
      <div role="alert" className="mx-auto max-w-md px-4 py-20 text-center">
        <AlertTriangle size={26} strokeWidth={1.75} className="mx-auto text-sinal-ambar" />
        <h1 className="mt-3 text-xl font-extrabold text-mzd-black">{nova ? 'Há uma versão nova do sistema' : 'Algo correu mal nesta página'}</h1>
        <p className="mt-1 text-sm text-mzd-gray">
          {nova
            ? 'Recarregue a página para continuar. O que já estava guardado não se perdeu.'
            : 'O erro ficou registado. Recarregue a página; se voltar a acontecer, avise o administrador do sistema e diga o que estava a fazer.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-mzd-black px-4 text-sm font-semibold text-white hover:bg-mzd-graphite"
        >
          <RefreshCw size={15} /> Recarregar
        </button>
      </div>
    );
  }
}
