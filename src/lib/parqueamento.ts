import type { Orcamento, PeriodoParqueamento, Processo } from '../types';
import { diaISO, diasInclusive, somarDiasISO, somarDiasUteis } from './datas';
import { formatDateTime, formatDia } from './format';

// Parqueamento: a viatura ocupa a oficina por demora do cliente e paga-se por dia (valor das condições
// do orçamento, sem IVA; o IVA segue o regime do orçamento). Conta em dois casos:
// 1) orçamento sem resposta: a partir do dia seguinte ao fim da validade, até ao dia da decisão;
// 2) viatura pronta: o cliente é avisado e tem N dias úteis para a levantar; depois, até ao dia do levantamento.
// Os dias contam-se por inteiro (o dia da decisão ou do levantamento conta).

type DadosParqueamento = Pick<Processo,
  'estado' | 'orcamento' | 'autorizacao' | 'cancelamento' | 'avisoLevantamento' | 'entrega' | 'faturasParqueamento' | 'dispensaParqueamento'>;

/** Último dia para aceitar o orçamento sem parqueamento ("AAAA-MM-DD"). */
export function aceitarAte(o?: Pick<Orcamento, 'enviadoEm' | 'validadeDias'>): string | undefined {
  return o?.enviadoEm ? somarDiasISO(diaISO(o.enviadoEm), o.validadeDias) : undefined;
}

/** Último dia para levantar a viatura sem parqueamento, contado do aviso de que está pronta. */
export function levantarAte(p: Pick<Processo, 'avisoLevantamento' | 'orcamento'>): string | undefined {
  return p.avisoLevantamento && p.orcamento
    ? somarDiasUteis(diaISO(p.avisoLevantamento.data), p.orcamento.condicoes.diasUteisLevantamento)
    : undefined;
}

/** "Cliente avisado … — levantar até …", ou null se ainda não foi avisado. */
export function textoAvisoLevantamento(p: Pick<Processo, 'avisoLevantamento' | 'orcamento'>): string | null {
  if (!p.avisoLevantamento) return null;
  const ate = levantarAte(p);
  const como = { whatsapp: 'por WhatsApp', email: 'por email', telefone: 'por telefone', presencial: 'ao balcão' }[p.avisoLevantamento.canal];
  return `Cliente avisado ${como} a ${formatDateTime(p.avisoLevantamento.data)}${ate ? ` — levantar até ${formatDia(ate)}` : ''}`;
}

/** Todos os dias de parqueamento até `hoje` (inclusive), antes de descontar o que já foi faturado. */
export function periodosParqueamento(p: DadosParqueamento, hoje = diaISO(new Date())): PeriodoParqueamento[] {
  const r: PeriodoParqueamento[] = [];
  const periodo = (motivo: PeriodoParqueamento['motivo'], ultimoLivre: string | undefined, fim: string | undefined) => {
    if (!ultimoLivre || !fim) return;
    const de = somarDiasISO(ultimoLivre, 1);
    if (fim >= de) r.push({ motivo, de, ate: fim, dias: diasInclusive(de, fim) });
  };
  // Decisão: aceitação, recusa ou cancelamento enquanto esperava pelo cliente.
  const decisao = p.autorizacao?.data ?? (p.cancelamento?.estadoAnterior === 'aguarda_aprovacao' ? p.cancelamento.data : undefined);
  periodo('orcamento', aceitarAte(p.orcamento), decisao ? diaISO(decisao) : p.estado === 'aguarda_aprovacao' ? hoje : undefined);
  periodo('levantamento', levantarAte(p), p.entrega ? diaISO(p.entrega.data) : p.estado === 'pronta_entrega' ? hoje : undefined);
  return r;
}

/** Dias ainda por faturar (descontando as faturas de parqueamento já emitidas). Nada, se a Direção dispensou. */
export function parqueamentoPorFaturar(p: DadosParqueamento, hoje = diaISO(new Date())): PeriodoParqueamento[] {
  if (p.dispensaParqueamento) return [];
  const faturados = (p.faturasParqueamento ?? []).flatMap((f) => f.periodos);
  return periodosParqueamento(p, hoje).flatMap((per) => {
    const ultimo = faturados.filter((f) => f.motivo === per.motivo).reduce((m, f) => (f.ate > m ? f.ate : m), '');
    const de = ultimo >= per.de ? somarDiasISO(ultimo, 1) : per.de;
    return de <= per.ate ? [{ ...per, de, dias: diasInclusive(de, per.ate) }] : [];
  });
}

/** Valor de um conjunto de dias de parqueamento, com o regime de IVA do orçamento. */
export function valorParqueamento(periodos: PeriodoParqueamento[], o?: Pick<Orcamento, 'condicoes' | 'taxaIva'>) {
  const dias = periodos.reduce((s, x) => s + x.dias, 0);
  const valorDia = o?.condicoes.parqueamentoDia ?? 0;
  const taxaIva = o?.taxaIva ?? 0;
  const subtotal = dias * valorDia;
  const iva = Math.round(subtotal * taxaIva) / 100;
  return { dias, valorDia, taxaIva, subtotal, iva, total: Math.round((subtotal + iva) * 100) / 100 };
}
