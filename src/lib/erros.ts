import { ApiError } from '../api/client';

export function mensagemErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
