import { criarSeed, VERSAO_DB } from './seed';
import type { MockDB } from './seed';

const CHAVE_DB = 'mzd.mock.db';
const CHAVE_SESSAO = 'mzd.mock.sessao';

let cache: MockDB | null = null;

function lerStorage(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function escreverStorage(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento (ex.: navegação privada): os dados vivem só em memória.
  }
}

export function db(): MockDB {
  if (cache) return cache;
  const bruto = lerStorage(CHAVE_DB);
  if (bruto) {
    try {
      const lido = JSON.parse(bruto) as MockDB;
      if (lido.versao === VERSAO_DB) {
        cache = lido;
        return cache;
      }
    } catch {
      // Dados corrompidos: recria-se a base de demonstração.
    }
  }
  cache = criarSeed();
  guardar();
  return cache;
}

export function guardar() {
  if (cache) escreverStorage(CHAVE_DB, JSON.stringify(cache));
}

export function reporDemo() {
  cache = criarSeed();
  guardar();
}

export function sessaoAtual(): string | null {
  return lerStorage(CHAVE_SESSAO);
}

export function definirSessao(utilizadorId: string | null) {
  escreverStorage(CHAVE_SESSAO, utilizadorId);
}
