import type { CondicoesComerciais, Fatura, Orcamento, Processo } from '../types';

// Regra única de cálculo de valores. Todo o sistema (documentos, listas, painéis)
// deve usar estas funções, para que os totais coincidam em todo o lado.

export interface Totais {
  pecas: number;
  maoObra: number;
  /** Desconto aprovado (valor, antes do IVA). */
  desconto: number;
  /** Sem IVA, já com o desconto. */
  subtotal: number;
  iva: number;
  /** Com IVA. */
  total: number;
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

/** Totais de um orçamento. O desconto só conta depois de aprovado e aplica-se antes do IVA. */
export function calcularTotais(orcamento?: Pick<Orcamento, 'pecas' | 'maoObra' | 'taxaIva'> & { desconto?: Orcamento['desconto'] }): Totais {
  if (!orcamento) return { pecas: 0, maoObra: 0, desconto: 0, subtotal: 0, iva: 0, total: 0 };
  const pecas = orcamento.pecas.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const maoObra = orcamento.maoObra.reduce((s, i) => s + i.horas * i.valorHora, 0);
  const d = orcamento.desconto;
  const desconto = d && d.estado === 'aprovado' ? arredondar((pecas + maoObra) * (d.percentagem / 100)) : 0;
  const subtotal = pecas + maoObra - desconto;
  const iva = arredondar(subtotal * (orcamento.taxaIva / 100));
  return { pecas, maoObra, desconto, subtotal, iva, total: arredondar(subtotal + iva) };
}

/** Total a faturar: orçamento aprovado + trabalhos adicionais aprovados (com IVA). */
export function totalFaturavel(p: Pick<Processo, 'orcamento' | 'orcamentosAdicionais'>): number {
  const adicionais = (p.orcamentosAdicionais ?? [])
    .filter((a) => a.estado === 'aprovado')
    .reduce((s, a) => s + calcularTotais(a).total, 0);
  return arredondar(calcularTotais(p.orcamento).total + adicionais);
}

/**
 * Valor a pagar na aceitação do orçamento: a % das peças e a % da mão de obra das condições,
 * com o desconto e o IVA aplicados na mesma proporção. Arredondado ao kwanza.
 */
export function valorAceitacao(o?: Pick<Orcamento, 'pecas' | 'maoObra' | 'taxaIva' | 'desconto' | 'condicoes'>): number {
  if (!o) return 0;
  const t = calcularTotais(o);
  const bruto = t.pecas + t.maoObra;
  if (bruto === 0) return 0;
  const parte = (t.pecas * o.condicoes.pecasAceitacaoPct + t.maoObra * o.condicoes.maoObraAceitacaoPct) / 100;
  return Math.min(t.total, Math.round(parte * (t.subtotal / bruto) * (1 + o.taxaIva / 100)));
}

/** Condições de pagamento em texto corrido (pró-forma, portal e mensagens). */
export function textoCondicoes(c: CondicoesComerciais): string {
  const partes = (pecas: number, maoObra: number) =>
    [pecas > 0 && `${pecas}% das peças`, maoObra > 0 && `${maoObra}% da mão de obra`].filter(Boolean).join(' e ');
  const aceitacao = partes(c.pecasAceitacaoPct, c.maoObraAceitacaoPct);
  const levantamento = partes(100 - c.pecasAceitacaoPct, 100 - c.maoObraAceitacaoPct);
  if (!aceitacao) return 'Pagamento total no levantamento da viatura.';
  return `Na aceitação do orçamento: ${aceitacao}.${levantamento ? ` No levantamento da viatura: ${levantamento}.` : ''}`;
}

/**
 * Quanto falta receber do pagamento da aceitação (0 = a reparação pode começar).
 * Só conta depois de o cliente aceitar e deixa de contar se a Direção o dispensar.
 */
export function faltaPagamentoAceitacao(p: Pick<Processo, 'orcamento' | 'autorizacao' | 'adiantamentos' | 'fatura' | 'dispensaPagamentoAceitacao'>): number {
  if (!p.autorizacao || p.dispensaPagamentoAceitacao) return 0;
  return Math.max(0, arredondar(valorAceitacao(p.orcamento) - recebidoProcesso(p)));
}

/** Todas as faturas do processo: a do serviço e as de parqueamento. */
export function faturasDe(p: Pick<Processo, 'fatura' | 'faturasParqueamento'>): Fatura[] {
  return [...(p.fatura ? [p.fatura] : []), ...(p.faturasParqueamento ?? [])];
}

/** Valor já recebido de um processo: pagamentos da fatura ou, antes dela, adiantamentos. */
export function recebidoProcesso(p: Pick<Processo, 'fatura' | 'adiantamentos'>): number {
  return p.fatura ? valorPago(p.fatura) : (p.adiantamentos ?? []).filter((x) => !x.anulado).reduce((s, x) => s + x.valor, 0);
}

/** Horas trabalhadas registadas pelo cronómetro (períodos em curso contam até agora). */
export function horasTrabalhadas(p: Pick<Processo, 'registosTempo'>, agora = Date.now()): number {
  const ms = (p.registosTempo ?? []).reduce(
    (s, r) => s + ((r.fim ? new Date(r.fim).getTime() : agora) - new Date(r.inicio).getTime()),
    0
  );
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export function valorPago(fatura?: Fatura): number {
  return fatura ? fatura.pagamentos.filter((p) => !p.anulado).reduce((s, p) => s + p.valor, 0) : 0;
}

export function saldoEmAberto(fatura?: Fatura): number {
  return fatura ? Math.max(arredondar(fatura.valorTotal - valorPago(fatura)), 0) : 0;
}

export function faturaPaga(fatura?: Fatura): boolean {
  return !!fatura && saldoEmAberto(fatura) === 0;
}

/** Quanto falta pagar num processo (saldo da fatura, ou total aprovado menos adiantamentos). */
export function emDivida(p: Pick<Processo, 'fatura' | 'adiantamentos' | 'orcamento' | 'orcamentosAdicionais'>): number {
  return p.fatura ? saldoEmAberto(p.fatura) : Math.max(arredondar(totalFaturavel(p) - recebidoProcesso(p)), 0);
}

/** Margem sobre o preço de venda, em % (venda − custo) / venda. */
export function margem(custo: number, venda: number): number {
  return venda > 0 ? Math.round(((venda - custo) / venda) * 100) : 0;
}
