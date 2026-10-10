// Financeiro: recibos, anulação de pagamentos, descontos, fecho de caixa, dívidas e conta corrente.
//
// Regras (o PHP deve replicá-las):
// - Pagamentos nunca se apagam; anulam-se com motivo, no próprio dia e com a caixa aberta.
// - Com a caixa de um dia fechada, não se registam nem anulam pagamentos nesse dia (só a Direção reabre).
// - Descontos acima do limite configurado ficam pendentes até a Direção decidir.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { UtilizadorComSenha } from './seed';
import { auditar, exigir, exigirEstado, novoId, numero, obterProcesso, registarHistorico, texto, umDe } from './contexto';
import type { Handler } from './contexto';
import { notificar } from './comunicacoes';
import { can } from '../../auth/permissions';
import { faturasDe, saldoEmAberto } from '../../lib/calculos';
import type { Desconto, DividaCliente, FechoCaixa, FormaPagamento, MovimentoContaCorrente, Pagamento, Processo } from '../../types';

export function diaLocal(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const caixaFechada = (dia: string) => db().fechos.some((f) => f.dia === dia);

/** Garante que a caixa do dia está aberta antes de mexer em pagamentos. */
export function exigirCaixaAberta(dia = diaLocal(new Date())) {
  if (caixaFechada(dia)) {
    throw new ApiError(422, dia === diaLocal(new Date())
      ? 'A caixa de hoje já foi fechada. Peça à Direção para a reabrir antes de registar este pagamento.'
      : 'A caixa desse dia já foi fechada. Só a Direção a pode reabrir.');
  }
}

export function proximoRecibo(): string {
  return `RC-${new Date().getFullYear()}-${novoId('recibo', '').padStart(4, '0')}`;
}

/** Desconto pedido no orçamento: até ao limite aplica-se logo; acima fica pendente (exceto para a Direção). */
export function avaliarDesconto(body: any, atual: Desconto | undefined, u: UtilizadorComSenha): Desconto | undefined {
  const pct = Number(body?.percentagem ?? 0);
  if (!pct) return undefined;
  const percentagem = numero(pct, 'Desconto (%)', { min: 0.5, max: 50 });
  const motivo = texto(body?.motivo, 'Motivo do desconto', 5, 200);
  // Mesma percentagem já decidida: mantém a decisão.
  if (atual && atual.percentagem === percentagem && atual.estado !== 'recusado') return { ...atual, motivo };
  const agora = new Date().toISOString();
  const limite = db().configuracao.descontoMaximoPct;
  const automatico = percentagem <= limite || can(u, 'financeiro.supervisionar');
  return {
    percentagem,
    motivo,
    estado: automatico ? 'aprovado' : 'pendente',
    pedidoPorId: u.id,
    pedidoEm: agora,
    ...(automatico ? { decididoPorId: u.id, decididoEm: agora, motivoDecisao: percentagem <= limite ? `Dentro do limite de ${limite}%` : 'Aplicado pela Direção' } : {}),
  };
}

/** Pagamentos de um processo: das faturas (serviço e parqueamento) e adiantamentos. */
const pagamentosDe = (p: Processo) => [...faturasDe(p).flatMap((f) => f.pagamentos), ...(p.adiantamentos ?? [])];

function todosPagamentos(): { pg: Pagamento; p: Processo }[] {
  return db().processos.flatMap((p) => pagamentosDe(p).map((pg) => ({ pg, p })));
}

export const rotasFinanceiro: [Metodo, string, Handler][] = [
  // Decisão da Direção sobre um desconto acima do limite.
  ['POST', '/processos/:id/desconto', ({ params, body }) => {
    const u = exigir('financeiro.supervisionar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'orcamentacao');
    const d = p.orcamento?.desconto;
    if (!d || d.estado !== 'pendente') throw new ApiError(422, 'Não há nenhum desconto pendente neste processo.');
    // Validar tudo antes de alterar (um pedido rejeitado não pode deixar o desconto meio decidido).
    const decisao = umDe(body?.decisao, ['aprovado', 'recusado'] as const, 'Decisão');
    const motivoDecisao = decisao === 'recusado' ? texto(body?.motivo, 'Motivo da recusa', 3, 200) : body?.motivo ? String(body.motivo).slice(0, 200) : undefined;
    d.estado = decisao;
    d.decididoPorId = u.id;
    d.decididoEm = new Date().toISOString();
    d.motivoDecisao = motivoDecisao;
    registarHistorico(p, u.nome, `Desconto de ${d.percentagem}% ${decisao} pela Direção${d.motivoDecisao ? ` (${d.motivoDecisao})` : ''}`, decisao === 'recusado' ? 'rejeicao' : 'nota');
    auditar(u.id, `desconto_${decisao}`, 'processo', p.id, `${d.percentagem}%`);
    notificar({ utilizadores: [d.pedidoPorId] }, `Desconto ${decisao}`, `${p.numero} — ${d.percentagem}%${motivoDecisao ? `: ${motivoDecisao}` : ''}`, `/processos/${p.id}`, u.id);
    guardar();
    return { id: p.id };
  }],

  ['POST', '/processos/:id/pagamentos/:pid/anular', ({ params, body }) => {
    const u = exigir('pagamentos.registar');
    const p = obterProcesso(params.id);
    if (p.estado === 'entregue') throw new ApiError(422, 'A viatura já foi entregue — não é possível anular pagamentos deste processo.');
    const pg = pagamentosDe(p).find((x) => x.id === params.pid);
    if (!pg) throw new ApiError(404, 'Pagamento não encontrado.');
    if (pg.anulado) throw new ApiError(422, 'Este pagamento já está anulado.');
    const dia = diaLocal(pg.data);
    if (dia !== diaLocal(new Date()) && !can(u, 'financeiro.supervisionar')) {
      throw new ApiError(422, 'Só é possível anular pagamentos do próprio dia. Para dias anteriores, fale com a Direção.');
    }
    exigirCaixaAberta(dia);
    pg.anulado = { motivo: texto(body?.motivo, 'Motivo da anulação', 5, 200), data: new Date().toISOString(), porId: u.id };
    registarHistorico(p, u.nome, `Recibo ${pg.numeroRecibo} anulado (${pg.anulado.motivo})`, 'rejeicao');
    auditar(u.id, 'anular_pagamento', 'processo', p.id, `${pg.numeroRecibo} · ${pg.valor} · ${pg.anulado.motivo}`);
    guardar();
    return { id: p.id };
  }],

  // Caixa de um dia: recebimentos, totais por forma e fecho (se existir).
  ['GET', '/caixa', ({ query }) => {
    exigir('faturacao.ver');
    const dia = query.get('dia') ?? diaLocal(new Date());
    const base = db();
    const doDia = todosPagamentos().filter(({ pg }) => diaLocal(pg.data) === dia);
    const totais: Record<FormaPagamento, number> = { numerario: 0, transferencia: 0, tpa: 0, multicaixa: 0 };
    doDia.filter(({ pg }) => !pg.anulado).forEach(({ pg }) => { totais[pg.forma] += pg.valor; });
    return {
      dia,
      totais,
      fecho: base.fechos.find((f) => f.dia === dia) ?? null,
      pagamentos: doDia
        .sort((a, b) => a.pg.data.localeCompare(b.pg.data))
        .map(({ pg, p }) => {
          const c = base.clientes.find((x) => x.id === p.clienteId);
          return {
            ...pg,
            processoId: p.id,
            processoNumero: p.numero,
            processoEstado: p.estado,
            cliente: c?.nome ?? '—',
            clienteNif: c?.nif,
            matricula: base.viaturas.find((v) => v.id === p.viaturaId)?.matricula,
            // Pagamento de fatura (ou adiantamento, se ainda não havia fatura).
            faturaNumero: faturasDe(p).find((f) => f.pagamentos.some((x) => x.id === pg.id))?.numero,
          };
        }),
    };
  }],
  ['GET', '/caixa/fechos', () => {
    exigir('faturacao.ver');
    return [...db().fechos].sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 60);
  }],
  ['POST', '/caixa/fechar', ({ body }) => {
    const u = exigir('pagamentos.registar');
    const dia = String(body?.dia ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new ApiError(422, 'Dia inválido.');
    if (dia > diaLocal(new Date())) throw new ApiError(422, 'Não é possível fechar a caixa de um dia futuro.');
    if (caixaFechada(dia)) throw new ApiError(422, 'A caixa deste dia já está fechada.');
    const doDia = todosPagamentos().filter(({ pg }) => diaLocal(pg.data) === dia && !pg.anulado);
    const totais: Record<FormaPagamento, number> = { numerario: 0, transferencia: 0, tpa: 0, multicaixa: 0 };
    doDia.forEach(({ pg }) => { totais[pg.forma] += pg.valor; });
    const numerarioContado = numero(body?.numerarioContado, 'Numerário contado', { min: 0 });
    const diferenca = Math.round((numerarioContado - totais.numerario) * 100) / 100;
    const notas = body?.notas ? String(body.notas).trim().slice(0, 500) || undefined : undefined;
    if (diferenca !== 0 && (!notas || notas.length < 5)) throw new ApiError(422, 'Há diferença no numerário — explique-a nas notas antes de fechar.');
    const f: FechoCaixa = {
      id: novoId('fecho', 'fc'), dia, totais, numerarioContado, diferenca, nRecibos: doDia.length, notas,
      fechadoPorId: u.id, fechadoEm: new Date().toISOString(),
    };
    db().fechos.push(f);
    auditar(u.id, 'fechar_caixa', 'caixa', dia, diferenca ? `diferença ${diferenca}` : undefined);
    guardar();
    return f;
  }],
  ['POST', '/caixa/reabrir', ({ body }) => {
    const u = exigir('financeiro.supervisionar');
    const dia = String(body?.dia ?? '');
    if (!caixaFechada(dia)) throw new ApiError(422, 'A caixa deste dia não está fechada.');
    const motivo = texto(body?.motivo, 'Motivo da reabertura', 5, 200);
    db().fechos = db().fechos.filter((f) => f.dia !== dia);
    auditar(u.id, 'reabrir_caixa', 'caixa', dia, motivo);
    guardar();
    return { dia };
  }],

  // Dívidas de clientes por antiguidade (dias desde a emissão da fatura).
  ['GET', '/financeiro/dividas', () => {
    exigir('faturacao.ver');
    const base = db();
    const agora = Date.now();
    const porCliente = new Map<string, DividaCliente>();
    base.processos.flatMap((p) => faturasDe(p).filter((f) => saldoEmAberto(f) > 0).map((f) => ({ p, f }))).forEach(({ p, f }) => {
      const c = base.clientes.find((x) => x.id === p.clienteId)!;
      const saldo = saldoEmAberto(f);
      const dias = Math.floor((agora - new Date(f.data).getTime()) / 86400000);
      const d = porCliente.get(c.id) ?? {
        cliente: { id: c.id, nome: c.nome, telefone: c.telefone, consentimentoMensagens: c.consentimentoMensagens },
        total: 0,
        escaloes: [0, 0, 0, 0] as [number, number, number, number],
        faturas: [],
      };
      d.total += saldo;
      d.escaloes[dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3] += saldo;
      d.faturas.push({ processoId: p.id, processoNumero: p.numero, numero: f.numero, data: f.data, dias, saldo });
      porCliente.set(c.id, d);
    });
    return [...porCliente.values()].sort((a, b) => b.total - a.total);
  }],

  // Conta corrente: faturas (débito), pagamentos (crédito) e anulações, com saldo acumulado.
  ['GET', '/clientes/:id/conta-corrente', ({ params }) => {
    exigir('valores.ver');
    const movs: Omit<MovimentoContaCorrente, 'saldo'>[] = [];
    db().processos.filter((p) => p.clienteId === params.id).forEach((p) => {
      faturasDe(p).forEach((f) => movs.push({ data: f.data, tipo: 'fatura', documento: f.numero, processoId: p.id, processoNumero: p.numero, debito: f.valorTotal, credito: 0 }));
      pagamentosDe(p).forEach((pg) => {
        movs.push({ data: pg.data, tipo: 'pagamento', documento: pg.numeroRecibo, processoId: p.id, processoNumero: p.numero, debito: 0, credito: pg.valor });
        if (pg.anulado) movs.push({ data: pg.anulado.data, tipo: 'anulacao', documento: `Anulação ${pg.numeroRecibo}`, processoId: p.id, processoNumero: p.numero, debito: pg.valor, credito: 0 });
      });
    });
    let saldo = 0;
    return movs
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((m) => {
        saldo = Math.round((saldo + m.debito - m.credito) * 100) / 100;
        return { ...m, saldo };
      });
  }],
];
