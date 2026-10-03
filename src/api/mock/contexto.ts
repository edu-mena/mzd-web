// Utilitários partilhados pelas rotas do servidor simulado.

import { ApiError } from '../client';
import { db, sessaoAtual } from './db';
import type { MockDB, UtilizadorComSenha } from './seed';
import { can } from '../../auth/permissions';
import type { Permissao } from '../../auth/permissions';
import type { AcessoPortal, EstadoProcesso, HistoricoEvento, Processo, ProcessoDetalhado, Utilizador } from '../../types';

export interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
}

export type Handler = (ctx: Ctx) => unknown;

export function publico(u: UtilizadorComSenha): Utilizador {
  const { senha: _senha, ...resto } = u;
  return resto;
}

export function utilizadorAtual(): UtilizadorComSenha {
  const id = sessaoAtual();
  const u = id ? db().utilizadores.find((x) => x.id === id && x.ativo) : undefined;
  if (!u) throw new ApiError(401, 'Sessão expirada. Inicie sessão novamente.');
  return u;
}

export function exigir(permissao: Permissao): UtilizadorComSenha {
  const u = utilizadorAtual();
  if (!can(u, permissao)) throw new ApiError(403, 'Não tem permissão para esta operação.');
  return u;
}

/** Gera o próximo identificador de uma sequência (ex.: "an12"). */
export function novoId(seq: keyof MockDB['sequencias'], prefixo: string): string {
  const base = db();
  base.sequencias[seq] = (base.sequencias[seq] ?? 0) + 1;
  return `${prefixo}${base.sequencias[seq]}`;
}

/** Token aleatório (144 bits) do link do portal do cliente, em base64url. */
export function gerarToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const novoAcessoPortal = (): AcessoPortal => ({ token: gerarToken(), criadoEm: new Date().toISOString(), acessos: 0 });

export function auditar(utilizadorId: string | null, acao: string, entidade: string, entidadeId?: string, detalhe?: string) {
  const base = db();
  base.auditoria.unshift({
    id: novoId('auditoria', 'a'),
    data: new Date().toISOString(),
    utilizadorId,
    acao,
    entidade,
    entidadeId,
    detalhe,
  });
  base.auditoria = base.auditoria.slice(0, 2000);
}

export function obterProcesso(id: string): Processo {
  const p = db().processos.find((x) => x.id === id);
  if (!p) throw new ApiError(404, 'Processo não encontrado.');
  return p;
}

export function exigirEstado(p: Processo, ...estados: EstadoProcesso[]) {
  if (!estados.includes(p.estado)) {
    throw new ApiError(422, 'Esta ação não está disponível na etapa atual do processo. Atualize a página.');
  }
}

export function registarHistorico(p: Processo, autor: string, descricao: string, tipo: HistoricoEvento['tipo'], estado?: EstadoProcesso) {
  p.historico.push({ id: `h${p.historico.length}`, data: new Date().toISOString(), autor, descricao, tipo, estado });
}

/** Quem não pode ver valores recebe o processo sem preços nem dados financeiros. */
function ocultarValores(p: ProcessoDetalhado): ProcessoDetalhado {
  const semPrecos = <T extends { pecas: { precoUnitario: number }[]; maoObra: { valorHora: number }[] }>(o: T): T => ({
    ...o,
    pecas: o.pecas.map((i) => ({ ...i, precoUnitario: 0 })),
    maoObra: o.maoObra.map((i) => ({ ...i, valorHora: 0 })),
  });
  return {
    ...p,
    orcamento: p.orcamento && semPrecos(p.orcamento),
    orcamentosAdicionais: p.orcamentosAdicionais?.map(semPrecos),
    autorizacao: p.autorizacao && { ...p.autorizacao, valorTotal: 0 },
    adiantamentos: undefined,
    fatura: undefined,
  };
}

export function detalhar(p: Processo, u: UtilizadorComSenha): ProcessoDetalhado {
  const base = db();
  const mec = base.utilizadores.find((x) => x.id === p.mecanicoId);
  const det: ProcessoDetalhado = {
    ...p,
    cliente: base.clientes.find((c) => c.id === p.clienteId)!,
    viatura: base.viaturas.find((v) => v.id === p.viaturaId)!,
    mecanico: mec ? publico(mec) : undefined,
  };
  // O link do portal é uma credencial do cliente: só o vê quem lhe envia mensagens.
  if (!can(u, 'mensagens.enviar')) det.portal = undefined;
  return can(u, 'valores.ver') ? det : ocultarValores(det);
}

/** Validações simples de entrada (o PHP faz o equivalente). */
export const texto = (v: unknown, campo: string, min = 1, max = 2000): string => {
  const s = String(v ?? '').trim();
  if (s.length < min) throw new ApiError(422, `${campo}: campo obrigatório${min > 1 ? ` (mínimo ${min} caracteres)` : ''}.`);
  if (s.length > max) throw new ApiError(422, `${campo}: máximo ${max} caracteres.`);
  return s;
};

export const numero = (v: unknown, campo: string, { min = 0, max = Number.MAX_SAFE_INTEGER, inteiro = false } = {}): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) {
    throw new ApiError(422, `${campo}: valor inválido.`);
  }
  return n;
};

export function umDe<T extends string>(v: unknown, opcoes: readonly T[], campo: string): T {
  if (!opcoes.includes(v as T)) throw new ApiError(422, `${campo}: opção inválida.`);
  return v as T;
}
