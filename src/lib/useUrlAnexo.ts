import { useEffect, useState } from 'react';
import type { Anexo } from '../types';

const PREFIXO_MOCK = 'mock-anexo:';

/**
 * Devolve um URL utilizável num <img>/<video> para um anexo.
 * Com o backend real o URL já vem pronto (endpoint PHP protegido por sessão); no modo simulado
 * o ficheiro é lido do IndexedDB e exposto como object URL.
 */
export function useUrlAnexo(anexo: Pick<Anexo, 'url'> | undefined): string | undefined {
  const url = anexo?.url;
  const mock = !!url?.startsWith(PREFIXO_MOCK);
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!url || !mock) return;
    let ativo = true;
    let criado: string | undefined;
    import('../api/mock/ficheiros')
      .then(({ lerFicheiro }) => lerFicheiro(url.slice(PREFIXO_MOCK.length)))
      .then((blob) => {
        if (!ativo || !blob) return;
        criado = URL.createObjectURL(blob);
        setObjectUrl(criado);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [url, mock]);

  return mock ? objectUrl : url;
}
