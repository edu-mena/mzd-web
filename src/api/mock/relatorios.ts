// Relatórios por período e alertas do painel.
//
// Regras (o PHP deve replicá-las, idealmente em SQL agregado):
// - O período é [de, ate] em dias locais, inclusive; o "anterior" tem a mesma duração e termina na véspera de `de`.
// - Faturado conta pela data da fatura (serviço e parqueamento); recebido pela data de cada pagamento não anulado;
//   entregas pela data da entrega; entradas pela data de receção.
// - Valores só para `valores.ver`; custos e margens só para `pecas.editar`.
// - Os alertas do painel são filtrados pelas permissões de quem pede.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db } from './db';
import type { UtilizadorComSenha } from './seed';
import { exigir, utilizadorAtual } from './contexto';
import type { Handler } from './contexto';
import { diaLocal } from './financeiro';
import { reservado } from './stock';
import { can } from '../../auth/permissions';
import { calcularTotais, faltaPagamentoAceitacao, faturasDe, saldoEmAberto } from '../../lib/calculos';
import { parqueamentoPorFaturar } from '../../lib/parqueamento';
import { ESTADOS_ORDEM, estaAtivo } from '../../types';
import type { AlertaPainel, Comparacao, EstadoProcesso, Processo, Relatorio } from '../../types';

const DIA = 86400000;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

interface Intervalo { ini: number; fim: number }
const dentro = (iso: string | undefined, i: Intervalo) => !!iso && new Date(iso).getTime() >= i.ini && new Date(iso).getTime() <= i.fim;
const somaDias = (dia: string, n: number) => diaLocal(new Date(new Date(`${dia}T12:00:00`).getTime() + n * DIA));
const intervalo = (de: string, ate: string): Intervalo => ({ ini: new Date(`${de}T00:00:00`).getTime(), fim: new Date(`${ate}T23:59:59.999`).getTime() });
const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
/** Média ou taxa só existe com base de cálculo. */
const mediaOuNulo = (v: number[]) => (v.length ? um(media(v)) : null);
const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 1000) / 10 : 0);
const pctOuNulo = (parte: number, todo: number) => (todo ? pct(parte, todo) : null);
const um = (n: number) => Math.round(n * 10) / 10;

const dataEntrega = (p: Processo) => p.entrega?.data ?? p.historico.find((h) => h.estado === 'entregue')?.data;
const pagamentos = (p: Processo) => [...faturasDe(p).flatMap((f) => f.pagamentos), ...(p.adiantamentos ?? [])].filter((x) => !x.anulado);
const parqueamentoFaturado = (ps: Processo[], dentroDe: (iso: string) => boolean) =>
  ps.flatMap((p) => p.faturasParqueamento ?? []).filter((f) => dentroDe(f.data)).reduce((s, f) => s + f.valorTotal, 0);
/** Linhas aprovadas (orçamento + adicionais aprovados). */
const linhasAprovadas = (p: Processo) => [
  ...(p.orcamento?.estado === 'aprovado' ? [p.orcamento] : []),
  ...(p.orcamentosAdicionais ?? []).filter((a) => a.estado === 'aprovado'),
];

/** Indicadores que se comparam entre períodos. */
function indicadores(i: Intervalo) {
  const ps = db().processos;
  const faturas = ps.filter((p) => dentro(p.fatura?.data, i));
  const servicos = faturas.reduce((s, p) => s + p.fatura!.valorTotal, 0);
  const faturado = servicos + parqueamentoFaturado(ps, (d) => dentro(d, i));
  const recebido = ps.flatMap(pagamentos).filter((x) => dentro(x.data, i)).reduce((s, x) => s + x.valor, 0);
  const entregues = ps.filter((p) => dentro(dataEntrega(p), i));
  const noPrazo = entregues.filter((p) => dataEntrega(p)! <= p.prazoEntrega).length;
  const qualidade = ps.filter((p) => dentro(p.checklistQualidade?.dataHora, i));
  const comRetrabalho = entregues.filter((p) => (p.retrabalhos ?? 0) > 0).length;
  const aprovados = ps.filter((p) => dentro(p.autorizacao?.data, i)).length;
  const recusados = ps.filter((p) => p.orcamento?.estado === 'recusado' && dentro(p.cancelamento?.data, i)).length;
  return {
    faturado,
    recebido,
    // Valor médio por serviço (o parqueamento fica de fora).
    ticketMedio: faturas.length ? Math.round(servicos / faturas.length) : null,
    entradas: ps.filter((p) => dentro(p.criadoEm, i)).length,
    entregas: entregues.length,
    cumprimentoPrazo: pctOuNulo(noPrazo, entregues.length),
    cicloMedioDias: mediaOuNulo(entregues.map((p) => (new Date(dataEntrega(p)!).getTime() - new Date(p.criadoEm).getTime()) / DIA)),
    // Retrabalho: entregues que voltaram atrás no controlo de qualidade (ou, sem entregas, reprovações registadas).
    retrabalhoPct: entregues.length ? pct(comRetrabalho, entregues.length) : pctOuNulo(qualidade.filter((p) => !p.checklistQualidade!.aprovado).length, qualidade.length),
    aprovacaoPct: pctOuNulo(aprovados, aprovados + recusados),
    novos: db().clientes.filter((c) => dentro(c.desde.length === 10 ? `${c.desde}T12:00:00` : c.desde, i)).length,
  };
}

function calcular(de: string, ate: string, u: UtilizadorComSenha): Relatorio {
  const base = db();
  const dias = Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / DIA) + 1;
  const anteriorAte = somaDias(de, -1);
  const anteriorDe = somaDias(anteriorAte, -(dias - 1));
  const i = intervalo(de, ate);
  const a = indicadores(i);
  const b = indicadores(intervalo(anteriorDe, anteriorAte));
  const par = (k: keyof typeof a): Comparacao => ({ atual: a[k], anterior: b[k] });
  const valores = can(u, 'valores.ver');
  const custos = can(u, 'pecas.editar');
  const ps = base.processos;
  const faturados = ps.filter((p) => dentro(p.fatura?.data, i));

  // Negócio
  let negocio: Relatorio['negocio'];
  if (valores) {
    const totais = faturados.flatMap(linhasAprovadas).map((o) => calcularTotais(o));
    let venda = 0;
    let custo = 0;
    faturados.flatMap(linhasAprovadas).flatMap((o) => o.pecas).forEach((l) => {
      const peca = l.pecaId ? base.pecas.find((x) => x.id === l.pecaId) : undefined;
      if (!peca) return;
      venda += l.quantidade * l.precoUnitario;
      custo += l.quantidade * peca.precoCusto;
    });
    const fimMes = new Date(`${ate}T12:00:00`);
    const porMes = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(fimMes.getFullYear(), fimMes.getMonth() - 11 + k, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        mes,
        faturado: ps.flatMap(faturasDe).filter((f) => diaLocal(f.data).startsWith(mes)).reduce((s, f) => s + f.valorTotal, 0),
        recebido: ps.flatMap(pagamentos).filter((x) => diaLocal(x.data).startsWith(mes)).reduce((s, x) => s + x.valor, 0),
      };
    });
    negocio = {
      faturado: par('faturado'),
      recebido: par('recebido'),
      ticketMedio: par('ticketMedio'),
      pecas: totais.reduce((s, t) => s + t.pecas, 0),
      maoObra: totais.reduce((s, t) => s + t.maoObra, 0),
      descontos: totais.reduce((s, t) => s + t.desconto, 0),
      parqueamento: parqueamentoFaturado(ps, (d) => dentro(d, i)),
      margemPecas: custos && venda ? { venda, custo } : undefined,
      porMes,
    };
  }

  // Tempo em cada etapa: das entradas consecutivas no histórico, contando as saídas dentro do período.
  const duracoes = new Map<EstadoProcesso, number[]>();
  ps.forEach((p) => {
    const evs = p.historico.filter((h) => h.estado).sort((x, y) => x.data.localeCompare(y.data));
    for (let k = 0; k < evs.length - 1; k++) {
      const estado = evs[k].estado!;
      if (!ESTADOS_ORDEM.includes(estado) || estado === 'entregue' || !dentro(evs[k + 1].data, i)) continue;
      const h = (new Date(evs[k + 1].data).getTime() - new Date(evs[k].data).getTime()) / 3600000;
      duracoes.set(estado, [...(duracoes.get(estado) ?? []), h]);
    }
  });
  const tempoPorEtapa = ESTADOS_ORDEM.filter((e) => e !== 'entregue').map((estado) => {
    const v = duracoes.get(estado) ?? [];
    return { estado, mediaHoras: um(media(v)), n: v.length };
  });
  const respostas = ps.filter((p) => p.orcamento?.enviadoEm && (dentro(p.autorizacao?.data, i) || (p.orcamento.estado === 'recusado' && dentro(p.cancelamento?.data, i))))
    .map((p) => (new Date((p.autorizacao?.data ?? p.cancelamento!.data)).getTime() - new Date(p.orcamento!.enviadoEm!).getTime()) / 3600000);
  const motivos = new Map<string, number>();
  ps.filter((p) => p.orcamento?.estado === 'recusado' && dentro(p.cancelamento?.data, i))
    .forEach((p) => motivos.set(p.orcamento!.motivoRecusa ?? 'Sem motivo registado', (motivos.get(p.orcamento!.motivoRecusa ?? 'Sem motivo registado') ?? 0) + 1));

  // Equipa
  const entregues = ps.filter((p) => dentro(dataEntrega(p), i));
  const equipa = base.utilizadores.filter((x) => x.perfil === 'mecanico').map((m) => {
    const seus = entregues.filter((p) => p.mecanicoId === m.id);
    const horasTrabalhadas = ps.flatMap((p) => p.registosTempo ?? []).filter((r) => r.mecanicoId === m.id && dentro(r.inicio, i))
      .reduce((s, r) => s + ((r.fim ? new Date(r.fim).getTime() : Date.now()) - new Date(r.inicio).getTime()) / 3600000, 0);
    const maoObra = seus.flatMap(linhasAprovadas).flatMap((o) => o.maoObra);
    return {
      mecanicoId: m.id,
      nome: m.nome,
      concluidos: seus.length,
      horasTrabalhadas: um(horasTrabalhadas),
      horasFaturadas: um(maoObra.reduce((s, l) => s + l.horas, 0)),
      retrabalhos: seus.reduce((s, p) => s + (p.retrabalhos ?? 0), 0),
      maoObraFaturada: valores ? maoObra.reduce((s, l) => s + l.horas * l.valorHora, 0) : undefined,
    };
  });

  // Clientes e serviços
  const entradas = ps.filter((p) => dentro(p.criadoEm, i));
  const clientesPeriodo = [...new Set(entradas.map((p) => p.clienteId))];
  const recorrentes = clientesPeriodo.filter((c) => ps.some((p) => p.clienteId === c && p.criadoEm < new Date(i.ini).toISOString())).length;
  const porCliente = new Map<string, { processos: number; faturado: number }>();
  entradas.forEach((p) => { const x = porCliente.get(p.clienteId) ?? { processos: 0, faturado: 0 }; x.processos++; porCliente.set(p.clienteId, x); });
  faturados.forEach((p) => { const x = porCliente.get(p.clienteId) ?? { processos: 0, faturado: 0 }; x.faturado += p.fatura!.valorTotal; porCliente.set(p.clienteId, x); });
  const top = [...porCliente].map(([clienteId, x]) => ({ clienteId, nome: base.clientes.find((c) => c.id === clienteId)?.nome ?? '—', processos: x.processos, faturado: valores ? x.faturado : undefined }))
    .sort((x, y) => (y.faturado ?? 0) - (x.faturado ?? 0) || y.processos - x.processos).slice(0, 10);
  const sistemas = new Map<string, number>();
  ps.filter((p) => dentro(p.diagnostico?.concluidoEm, i)).flatMap((p) => p.diagnostico!.itens).filter((x) => x.estado !== 'ok')
    .forEach((x) => sistemas.set(x.sistema, (sistemas.get(x.sistema) ?? 0) + 1));
  const pecasMap = new Map<string, { quantidade: number; valor: number }>();
  faturados.flatMap(linhasAprovadas).flatMap((o) => o.pecas).forEach((l) => {
    const x = pecasMap.get(l.descricao) ?? { quantidade: 0, valor: 0 };
    x.quantidade += l.quantidade;
    x.valor += l.quantidade * l.precoUnitario;
    pecasMap.set(l.descricao, x);
  });

  return {
    periodo: { de, ate, anteriorDe, anteriorAte },
    negocio,
    operacao: {
      entradas: par('entradas'),
      entregas: par('entregas'),
      cumprimentoPrazo: par('cumprimentoPrazo'),
      cicloMedioDias: par('cicloMedioDias'),
      retrabalhoPct: par('retrabalhoPct'),
      aprovacaoPct: par('aprovacaoPct'),
      respostaClienteHoras: respostas.length ? um(mediana(respostas)!) : null,
      tempoPorEtapa,
      motivosRecusa: [...motivos].map(([motivo, total]) => ({ motivo, total })).sort((x, y) => y.total - x.total),
    },
    equipa,
    clientes: {
      novos: par('novos'),
      recorrentesPct: pct(recorrentes, clientesPeriodo.length),
      top,
      sistemas: [...sistemas].map(([sistema, total]) => ({ sistema, total })).sort((x, y) => y.total - x.total),
      pecasTop: [...pecasMap].map(([descricao, x]) => ({ descricao, quantidade: x.quantidade, valor: valores ? x.valor : undefined }))
        .sort((x, y) => y.quantidade - x.quantidade).slice(0, 10),
    },
  };
}

// ---------- Alertas do painel ----------

function alertas(u: UtilizadorComSenha): AlertaPainel[] {
  const base = db();
  const agora = Date.now();
  const hoje = diaLocal(new Date());
  const ativos = base.processos.filter((p) => estaAtivo(p.estado));
  const lista: AlertaPainel[] = [];
  const add = (cond: boolean, a: AlertaPainel) => { if (cond && a.total > 0) lista.push(a); };
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  if (can(u, 'financeiro.supervisionar')) {
    const n = ativos.filter((p) => p.orcamento?.desconto?.estado === 'pendente').length;
    add(true, { id: 'descontos', gravidade: 'aviso', titulo: plural(n, 'desconto para aprovar', 'descontos para aprovar'), texto: 'O orçamento não segue para o cliente sem a sua decisão.', link: '/faturacao', total: n });
  }
  if (can(u, 'pagamentos.registar')) {
    const diasAbertos = [...new Set(base.processos.flatMap(pagamentos).map((x) => diaLocal(x.data)))]
      .filter((d) => d < hoje && d >= somaDias(hoje, -7) && !base.fechos.some((f) => f.dia === d)).sort();
    add(true, { id: 'caixa', gravidade: 'critico', titulo: diasAbertos.length === 1 ? `Caixa de ${diasAbertos[0].split('-').reverse().slice(0, 2).join('/')} por fechar` : plural(diasAbertos.length, 'dia', 'dias') + ' com a caixa por fechar', texto: 'Feche a caixa com a contagem do numerário.', link: '/faturacao', total: diasAbertos.length });
  }
  if (can(u, 'pagamentos.registar')) {
    const n = ativos.filter((p) => p.estado === 'em_reparacao' && faltaPagamentoAceitacao(p) > 0).length;
    add(true, { id: 'pagamento-aceitacao', gravidade: 'aviso', titulo: plural(n, 'orçamento aceite sem o pagamento da aceitação', 'orçamentos aceites sem o pagamento da aceitação'), texto: 'A reparação só começa depois de receber este pagamento.', link: '/processos?estado=em_reparacao', total: n });
    const parque = base.processos.filter((p) => (estaAtivo(p.estado) || p.estado === 'cancelado') && parqueamentoPorFaturar(p).length > 0).length;
    add(true, { id: 'parqueamento', gravidade: 'info', titulo: plural(parque, 'viatura com parqueamento a contar', 'viaturas com parqueamento a contar'), texto: 'Cobrado à parte, antes de a viatura sair.', link: '/processos', total: parque });
  }
  if (can(u, 'processos.criar')) {
    const n = ativos.filter((p) => p.estado === 'recepcao' && !p.fichaRecepcao.assinaturaCliente).length;
    add(true, { id: 'fichas', gravidade: 'aviso', titulo: plural(n, 'ficha de entrada por digitalizar', 'fichas de entrada por digitalizar'), texto: 'O diagnóstico só começa com a ficha assinada pelo cliente.', link: '/processos?estado=recepcao', total: n });
  }
  if (can(u, 'processos.ver')) {
    const n = ativos.filter((p) => new Date(p.prazoEntrega).getTime() < agora).length;
    add(true, { id: 'atrasos', gravidade: 'critico', titulo: plural(n, 'viatura com o prazo ultrapassado', 'viaturas com o prazo ultrapassado'), texto: 'A entrega prometida ao cliente já passou.', link: '/processos?filtro=atrasados', total: n });
  }
  if (can(u, 'processos.atribuir')) {
    const n = ativos.filter((p) => p.estado === 'recepcao' && !p.mecanicoId).length;
    add(true, { id: 'sem-mecanico', gravidade: 'aviso', titulo: plural(n, 'viatura sem mecânico', 'viaturas sem mecânico'), texto: 'Atribua para o diagnóstico começar.', link: '/oficina', total: n });
  }
  if (can(u, 'qualidade.validar')) {
    const n = ativos.filter((p) => p.estado === 'controlo_qualidade').length;
    add(true, { id: 'qualidade', gravidade: 'info', titulo: plural(n, 'viatura para controlo de qualidade', 'viaturas para controlo de qualidade'), texto: 'A reparação terminou; falta a verificação final.', link: '/processos?estado=controlo_qualidade', total: n });
  }
  if (can(u, 'aprovacao.registar')) {
    const n = ativos.filter((p) => p.estado === 'aguarda_aprovacao' && p.orcamento?.enviadoEm && agora - new Date(p.orcamento.enviadoEm).getTime() > 2 * DIA).length;
    add(true, { id: 'sem-resposta', gravidade: 'aviso', titulo: plural(n, 'orçamento sem resposta há mais de 2 dias', 'orçamentos sem resposta há mais de 2 dias'), texto: 'Contacte o cliente; a viatura está parada.', link: '/processos?estado=aguarda_aprovacao', total: n });
  }
  if (can(u, 'pecas.editar')) {
    const n = base.pecas.filter((p) => p.stock - reservado(p.id) <= p.stockMinimo).length;
    add(true, { id: 'stock', gravidade: 'aviso', titulo: plural(n, 'peça abaixo do mínimo', 'peças abaixo do mínimo'), texto: 'Veja a sugestão de encomenda.', link: '/pecas', total: n });
    const atrasadas = base.encomendas.filter((e) => e.estado === 'enviada' && e.previsaoEntrega && new Date(e.previsaoEntrega).getTime() < agora).length;
    add(true, { id: 'encomendas', gravidade: 'aviso', titulo: plural(atrasadas, 'encomenda atrasada', 'encomendas atrasadas'), texto: 'Já passou a data prevista de entrega do fornecedor.', link: '/pecas', total: atrasadas });
  }
  if (can(u, 'faturacao.ver')) {
    const limite = agora - 60 * DIA;
    const antigas = base.processos.flatMap(faturasDe).filter((f) => saldoEmAberto(f) > 0 && new Date(f.data).getTime() < limite);
    add(true, { id: 'dividas', gravidade: 'aviso', titulo: plural(antigas.length, 'fatura por pagar há mais de 60 dias', 'faturas por pagar há mais de 60 dias'), texto: 'Veja as dívidas por antiguidade.', link: '/faturacao', total: antigas.length });
  }
  if (can(u, 'mensagens.enviar')) {
    const n = base.pedidos.filter((p) => p.estado === 'novo').length;
    add(true, { id: 'pedidos-site', gravidade: 'aviso', titulo: plural(n, 'pedido do site por responder', 'pedidos do site por responder'), texto: 'Ligue ao cliente e marque, se for o caso.', link: '/comunicacoes', total: n });
  }
  if (can(u, 'agenda.gerir')) {
    const n = base.marcacoes.filter((m) => m.estado === 'agendada' && diaLocal(m.data) === hoje).length;
    add(true, { id: 'marcacoes', gravidade: 'info', titulo: plural(n, 'marcação de hoje por confirmar', 'marcações de hoje por confirmar'), texto: 'Ligue ou envie um lembrete.', link: '/agenda', total: n });
  }
  const ordem = { critico: 0, aviso: 1, info: 2 };
  return lista.sort((x, y) => ordem[x.gravidade] - ordem[y.gravidade]);
}

export const rotasRelatorios: [Metodo, string, Handler][] = [
  ['GET', '/relatorios', ({ query }) => {
    const u = exigir('relatorios.ver');
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    if (!DIA_ISO.test(de) || !DIA_ISO.test(ate) || de > ate) throw new ApiError(422, 'Período inválido.');
    if (new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime() > 3 * 366 * DIA) throw new ApiError(422, 'O período máximo é de 3 anos.');
    return calcular(de, ate, u);
  }],
  ['GET', '/painel/alertas', () => alertas(utilizadorAtual())],
];
