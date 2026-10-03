// Armazenamento dos ficheiros (fotos, vídeos, assinaturas) no modo simulado.
// Usa IndexedDB porque o localStorage só aguenta poucos MB. No backend real, os ficheiros ficam numa
// pasta fora de public_html e são servidos por um endpoint PHP que verifica permissões.

const NOME_DB = 'mzd-mock-ficheiros';
const LOJA = 'ficheiros';
export const PREFIXO_URL_MOCK = 'mock-anexo:';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_DB, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function transacao<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const pedido = fn(db.transaction(LOJA, modo).objectStore(LOJA));
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export const guardarFicheiro = (id: string, blob: Blob) => transacao('readwrite', (l) => l.put(blob, id)).then(() => undefined);
export const lerFicheiro = (id: string) => transacao<Blob | undefined>('readonly', (l) => l.get(id));
export const limparFicheiros = () => transacao('readwrite', (l) => l.clear()).then(() => undefined);
