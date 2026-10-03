// Stock, fornecedores e encomendas.
//
// Regras (o PHP deve replicá-las, com as alterações de stock dentro de transações):
// - stock = unidades físicas; reservado = peças de processos aprovados ainda não montadas;
//   disponível = stock − reservado; encomendado = linhas de encomendas enviadas ainda não recebidas.
// - Montar uma peça (tarefa feita) dá baixa no stock; o stock físico nunca fica negativo.
// - Receber uma encomenda dá entrada e atualiza o custo pelo custo médio ponderado.
// - Todas as alterações de stock ficam em `movimentos` (quem, quando, porquê).

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { UtilizadorComSenha } from './seed';
import { auditar, exigir, novoId, numero, registarHistorico, texto } from './contexto';
import type { Handler } from './contexto';
import { notificar } from './comunicacoes';
import { can } from '../../auth/permissions';
import type { Encomenda, Fornecedor, LinhaEncomenda, Peca, PecaResumo, Processo, TipoMovimento } from '../../types';

const ESTADOS_COM_RESERVA: Processo['estado'][] = ['em_reparacao', 'controlo_qualidade'];

export function obterPeca(id: string): Peca {
  const p = db().pecas.find((x) => x.id === id);
  if (!p) throw new ApiError(404, 'Peça não encontrada.');
  return p;
}

export function reservado(pecaId: string): number {
  return db().processos
    .filter((p) => ESTADOS_COM_RESERVA.includes(p.estado))
    .flatMap((p) => p.tarefas ?? [])
    .filter((t) => t.pecaId === pecaId && !t.feita)
    .reduce((s, t) => s + (t.quantidade ?? 1), 0);
}

function encomendado(pecaId: string): number {
  return db().encomendas
    .filter((e) => e.estado === 'enviada')
    .flatMap((e) => e.linhas)
    .filter((l) => l.pecaId === pecaId)
    .reduce((s, l) => s + l.quantidade, 0);
}

export function resumoPeca(p: Peca, u: UtilizadorComSenha): PecaResumo {
  const r = reservado(p.id);
  const fornecedor = db().fornecedores.find((f) => f.id === p.fornecedorId)?.nome ?? '—';
  return {
    ...p,
    // Custos só para quem gere o stock; preço de venda só para quem pode ver valores.
    precoCusto: can(u, 'pecas.editar') ? p.precoCusto : 0,
    precoBase: can(u, 'valores.ver') ? p.precoBase : 0,
    fornecedor,
    reservado: r,
    disponivel: p.stock - r,
    encomendado: encomendado(p.id),
  };
}

/** Altera o stock e regista o movimento. Nunca deixa o stock físico negativo. */
export function movimentar(
  peca: Peca,
  quantidade: number,
  tipo: TipoMovimento,
  u: UtilizadorComSenha,
  extra: { processoId?: string; encomendaId?: string; motivo?: string } = {}
) {
  const novo = peca.stock + quantidade;
  if (novo < 0) {
    throw new ApiError(422, `Só há ${peca.stock} em stock de "${peca.nome}". Registe primeiro a receção da encomenda.`);
  }
  peca.stock = novo;
  db().movimentos.unshift({
    id: novoId('movimento', 'mv'),
    pecaId: peca.id,
    tipo,
    quantidade,
    stockApos: novo,
    data: new Date().toISOString(),
    utilizadorId: u.id,
    ...extra,
  });
}

/** Peças de que um processo precisa e não há disponíveis (para marcar "aguarda peças"). */
export function faltasDoProcesso(p: Processo): { peca: Peca; falta: number }[] {
  const precisa = new Map<string, number>();
  (p.tarefas ?? []).filter((t) => t.pecaId && !t.feita).forEach((t) => precisa.set(t.pecaId!, (precisa.get(t.pecaId!) ?? 0) + (t.quantidade ?? 1)));
  return [...precisa.keys()]
    .map((id) => {
      const peca = db().pecas.find((x) => x.id === id);
      return peca ? { peca, falta: Math.max(0, -(peca.stock - reservado(id))) } : null;
    })
    .filter((x): x is { peca: Peca; falta: number } => !!x && x.falta > 0);
}

/** Depois de aprovar trabalho: se faltarem peças, o processo fica "à espera de peças" com a lista. */
export function verificarFaltas(p: Processo, autor: string) {
  const faltas = faltasDoProcesso(p);
  if (faltas.length === 0) return;
  p.aguardaPecas = true;
  p.notaPecas = `Sem stock: ${faltas.map((f) => `${f.peca.nome} (falta ${f.falta})`).join(', ')}`;
  registarHistorico(p, autor, `Aprovado sem stock suficiente — ${p.notaPecas}. É preciso encomendar.`, 'nota');
}

function obterFornecedor(id: string): Fornecedor {
  const f = db().fornecedores.find((x) => x.id === id);
  if (!f) throw new ApiError(422, 'Fornecedor não encontrado.');
  return f;
}

function obterEncomenda(id: string): Encomenda {
  const e = db().encomendas.find((x) => x.id === id);
  if (!e) throw new ApiError(404, 'Encomenda não encontrada.');
  return e;
}

function validarPeca(body: any, ignorarId?: string): Omit<Peca, 'id' | 'stock'> {
  const referencia = texto(body?.referencia, 'Referência', 2, 40).toUpperCase();
  if (db().pecas.some((p) => p.id !== ignorarId && p.referencia.toUpperCase() === referencia)) {
    throw new ApiError(422, 'Já existe uma peça com esta referência.');
  }
  const nome = texto(body?.nome, 'Nome', 3, 120);
  if (db().pecas.some((p) => p.id !== ignorarId && p.nome.toLowerCase() === nome.toLowerCase())) {
    throw new ApiError(422, 'Já existe uma peça com este nome no catálogo.');
  }
  const precoCusto = numero(body?.precoCusto, 'Preço de custo', { min: 0 });
  const precoBase = numero(body?.precoBase, 'Preço de venda', { min: 1 });
  if (precoBase < precoCusto) throw new ApiError(422, 'O preço de venda é inferior ao custo — a peça seria vendida com prejuízo.');
  return {
    referencia,
    nome,
    categoria: texto(body?.categoria, 'Categoria', 2, 60),
    fornecedorId: obterFornecedor(String(body?.fornecedorId ?? '')).id,
    precoCusto,
    precoBase,
    stockMinimo: numero(body?.stockMinimo, 'Stock mínimo', { min: 0, max: 100000, inteiro: true }),
    localizacao: body?.localizacao ? String(body.localizacao).trim().slice(0, 30) || undefined : undefined,
  };
}

function validarLinhas(linhas: unknown): LinhaEncomenda[] {
  if (!Array.isArray(linhas) || linhas.length === 0) throw new ApiError(422, 'A encomenda tem de ter pelo menos uma peça.');
  return linhas.map((l: any, i) => ({
    pecaId: obterPeca(String(l?.pecaId ?? '')).id,
    quantidade: numero(l?.quantidade, `Linha ${i + 1}: quantidade`, { min: 1, max: 10000, inteiro: true }),
    precoCusto: numero(l?.precoCusto, `Linha ${i + 1}: custo`, { min: 0 }),
  }));
}

/** Sugestão de encomendas por fornecedor: o que está abaixo do mínimo e o que falta para processos aprovados. */
function sugestao() {
  const porFornecedor = new Map<string, { linhas: LinhaEncomenda[]; motivos: string[] }>();
  db().pecas.forEach((p) => {
    const disponivel = p.stock - reservado(p.id);
    const aCaminho = encomendado(p.id);
    const projetado = disponivel + aCaminho;
    if (projetado >= p.stockMinimo) return;
    // Repõe até ao dobro do mínimo (cobre as reservas em falta).
    const quantidade = Math.max(1, p.stockMinimo * 2 - projetado);
    const g = porFornecedor.get(p.fornecedorId) ?? { linhas: [], motivos: [] };
    g.linhas.push({ pecaId: p.id, quantidade, precoCusto: p.precoCusto });
    g.motivos.push(disponivel < 0 ? `${p.nome}: faltam ${-disponivel} para processos aprovados` : `${p.nome}: abaixo do mínimo (${projetado}/${p.stockMinimo})`);
    porFornecedor.set(p.fornecedorId, g);
  });
  return [...porFornecedor].map(([fornecedorId, g]) => ({
    fornecedorId,
    linhas: g.linhas,
    motivos: g.motivos,
    processosIds: db().processos
      .filter((p) => p.aguardaPecas && (p.tarefas ?? []).some((t) => !t.feita && g.linhas.some((l) => l.pecaId === t.pecaId)))
      .map((p) => p.id),
  }));
}

export const rotasStock: [Metodo, string, Handler][] = [
  // Peças
  ['GET', '/pecas', () => {
    const u = exigir('pecas.ver');
    return db().pecas.map((p) => resumoPeca(p, u));
  }],
  ['POST', '/pecas', ({ body }) => {
    const u = exigir('pecas.editar');
    const dados = validarPeca(body);
    const stockInicial = numero(body?.stock ?? 0, 'Stock inicial', { min: 0, max: 100000, inteiro: true });
    const p: Peca = { id: novoId('peca', 'p'), ...dados, stock: 0 };
    db().pecas.push(p);
    if (stockInicial > 0) movimentar(p, stockInicial, 'acerto', u, { motivo: 'Stock inicial ao criar a peça' });
    auditar(u.id, 'criar', 'peca', p.id, p.nome);
    guardar();
    return resumoPeca(p, u);
  }],
  ['PUT', '/pecas/:id', ({ params, body }) => {
    const u = exigir('pecas.editar');
    const p = obterPeca(params.id);
    const antes = p.precoBase;
    Object.assign(p, validarPeca(body, p.id));
    auditar(u.id, 'editar', 'peca', p.id, antes !== p.precoBase ? `preço de venda ${antes} → ${p.precoBase}` : undefined);
    guardar();
    return resumoPeca(p, u);
  }],
  // Contagem física: o stock passa a ser o contado; a diferença fica registada com o motivo.
  ['POST', '/pecas/:id/acerto', ({ params, body }) => {
    const u = exigir('pecas.editar');
    const p = obterPeca(params.id);
    const contado = numero(body?.stockContado, 'Stock contado', { min: 0, max: 100000, inteiro: true });
    const motivo = texto(body?.motivo, 'Motivo', 5, 200);
    const diferenca = contado - p.stock;
    if (diferenca === 0) throw new ApiError(422, 'O stock contado é igual ao registado — não há nada a acertar.');
    movimentar(p, diferenca, 'acerto', u, { motivo });
    auditar(u.id, 'acerto_stock', 'peca', p.id, `${diferenca > 0 ? '+' : ''}${diferenca}: ${motivo}`);
    guardar();
    return resumoPeca(p, u);
  }],
  ['GET', '/movimentos', ({ query }) => {
    exigir('pecas.editar');
    const pecaId = query.get('pecaId');
    return db().movimentos.filter((m) => !pecaId || m.pecaId === pecaId).slice(0, 500);
  }],

  // Fornecedores
  ['GET', '/fornecedores', () => {
    exigir('pecas.ver');
    return db().fornecedores;
  }],
  ['POST', '/fornecedores', ({ body }) => {
    const u = exigir('pecas.editar');
    const nome = texto(body?.nome, 'Nome', 2, 120);
    if (db().fornecedores.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) throw new ApiError(422, 'Já existe um fornecedor com este nome.');
    const f: Fornecedor = {
      id: novoId('fornecedor', 'f'),
      nome,
      telefone: body?.telefone ? String(body.telefone).trim() || undefined : undefined,
      email: body?.email ? String(body.email).trim() || undefined : undefined,
      nif: body?.nif ? String(body.nif).trim() || undefined : undefined,
      prazoEntregaDias: numero(body?.prazoEntregaDias ?? 2, 'Prazo de entrega', { min: 0, max: 120, inteiro: true }),
      ativo: true,
    };
    db().fornecedores.push(f);
    auditar(u.id, 'criar', 'fornecedor', f.id, f.nome);
    guardar();
    return f;
  }],
  ['PUT', '/fornecedores/:id', ({ params, body }) => {
    const u = exigir('pecas.editar');
    const f = obterFornecedor(params.id);
    f.nome = texto(body?.nome, 'Nome', 2, 120);
    f.telefone = body?.telefone ? String(body.telefone).trim() || undefined : undefined;
    f.email = body?.email ? String(body.email).trim() || undefined : undefined;
    f.nif = body?.nif ? String(body.nif).trim() || undefined : undefined;
    f.prazoEntregaDias = numero(body?.prazoEntregaDias, 'Prazo de entrega', { min: 0, max: 120, inteiro: true });
    f.ativo = body?.ativo !== false;
    auditar(u.id, 'editar', 'fornecedor', f.id);
    guardar();
    return f;
  }],

  // Encomendas
  ['GET', '/encomendas', () => {
    exigir('pecas.editar');
    return [...db().encomendas].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }],
  ['GET', '/encomendas/sugestao', () => {
    exigir('pecas.editar');
    return sugestao();
  }],
  ['POST', '/encomendas', ({ body }) => {
    const u = exigir('pecas.editar');
    const fornecedor = obterFornecedor(String(body?.fornecedorId ?? ''));
    const seq = novoId('encomenda', '');
    const e: Encomenda = {
      id: `e${seq}`,
      numero: `ENC-${new Date().getFullYear()}-${seq.padStart(3, '0')}`,
      fornecedorId: fornecedor.id,
      estado: 'rascunho',
      linhas: validarLinhas(body?.linhas),
      processosIds: Array.isArray(body?.processosIds) ? body.processosIds.filter((id: string) => db().processos.some((p) => p.id === id)) : [],
      notas: body?.notas ? String(body.notas).slice(0, 500) : undefined,
      criadoEm: new Date().toISOString(),
      criadoPorId: u.id,
    };
    db().encomendas.push(e);
    auditar(u.id, 'criar', 'encomenda', e.id, e.numero);
    guardar();
    return e;
  }],
  ['PUT', '/encomendas/:id', ({ params, body }) => {
    const u = exigir('pecas.editar');
    const e = obterEncomenda(params.id);
    if (e.estado !== 'rascunho') throw new ApiError(422, 'Só é possível alterar encomendas em rascunho.');
    e.linhas = validarLinhas(body?.linhas);
    e.notas = body?.notas ? String(body.notas).slice(0, 500) : undefined;
    auditar(u.id, 'editar', 'encomenda', e.id);
    guardar();
    return e;
  }],
  ['POST', '/encomendas/:id/enviar', ({ params }) => {
    const u = exigir('pecas.editar');
    const e = obterEncomenda(params.id);
    if (e.estado !== 'rascunho') throw new ApiError(422, 'Esta encomenda já foi enviada.');
    const f = obterFornecedor(e.fornecedorId);
    e.estado = 'enviada';
    e.enviadaEm = new Date().toISOString();
    e.previsaoEntrega = new Date(Date.now() + f.prazoEntregaDias * 86400000).toISOString();
    auditar(u.id, 'enviar', 'encomenda', e.id, e.numero);
    guardar();
    return e;
  }],
  ['POST', '/encomendas/:id/cancelar', ({ params }) => {
    const u = exigir('pecas.editar');
    const e = obterEncomenda(params.id);
    if (e.estado === 'recebida' || e.estado === 'cancelada') throw new ApiError(422, 'Esta encomenda já está encerrada.');
    e.estado = 'cancelada';
    auditar(u.id, 'cancelar', 'encomenda', e.id, e.numero);
    guardar();
    return e;
  }],
  // Receção: entrada em stock das quantidades recebidas, custo médio ponderado e desbloqueio de processos.
  ['POST', '/encomendas/:id/receber', ({ params, body }) => {
    const u = exigir('pecas.editar');
    const e = obterEncomenda(params.id);
    if (e.estado !== 'enviada') throw new ApiError(422, 'Só é possível receber encomendas enviadas.');
    const recebidas = new Map<string, number>((Array.isArray(body?.linhas) ? body.linhas : []).map((l: any) => [String(l.pecaId), Number(l.quantidadeRecebida)]));
    let diferencas = 0;
    e.linhas.forEach((l) => {
      const q = numero(recebidas.get(l.pecaId) ?? l.quantidade, 'Quantidade recebida', { min: 0, max: 100000, inteiro: true });
      l.quantidadeRecebida = q;
      if (q !== l.quantidade) diferencas++;
      if (q === 0) return;
      const p = obterPeca(l.pecaId);
      // Custo médio ponderado: (stock × custo atual + recebido × custo da encomenda) / total.
      const total = p.stock + q;
      p.precoCusto = Math.round((p.stock * p.precoCusto + q * l.precoCusto) / total);
      movimentar(p, q, 'entrada', u, { encomendaId: e.id, motivo: `Receção ${e.numero}` });
    });
    e.estado = 'recebida';
    e.recebidaEm = new Date().toISOString();

    // Processos à espera de peças que agora têm tudo disponível ficam desbloqueados.
    const desbloqueados: string[] = [];
    db().processos.filter((p) => p.aguardaPecas && p.estado === 'em_reparacao').forEach((p) => {
      const precisaDesta = (p.tarefas ?? []).some((t) => !t.feita && e.linhas.some((l) => l.pecaId === t.pecaId)) || e.processosIds.includes(p.id);
      if (precisaDesta && faltasDoProcesso(p).length === 0) {
        p.aguardaPecas = false;
        p.notaPecas = undefined;
        registarHistorico(p, u.nome, `Peças recebidas (${e.numero}) — reparação desbloqueada`, 'nota');
        notificar({ utilizadores: [p.mecanicoId], perfis: ['chefe_oficina'] }, 'Peças chegaram', `${p.numero} — a reparação pode continuar.`, `/processos/${p.id}`, u.id);
        desbloqueados.push(p.numero);
      }
    });
    auditar(u.id, 'receber', 'encomenda', e.id, `${e.numero}${diferencas ? ` · ${diferencas} linha(s) com diferenças` : ''}${desbloqueados.length ? ` · desbloqueou ${desbloqueados.join(', ')}` : ''}`);
    guardar();
    return { encomenda: e, desbloqueados };
  }],
];
