import type { EstadoProcesso } from '../types';

/**
 * Tonalidade visual de cada estado. Poucas cores, cada uma com significado:
 * - curso: a oficina está a trabalhar (neutro, tinta)
 * - espera: depende de alguém de fora — cliente ou fornecedor (âmbar)
 * - pronto: pronto para o cliente (verde)
 * - fechado / cancelado: encerrado (apagado)
 * O vermelho não é um estado: é reservado para atrasos e situações críticas.
 */
export type TomEstado = 'curso' | 'espera' | 'pronto' | 'fechado' | 'cancelado';

export const TOM_ESTADO: Record<EstadoProcesso, TomEstado> = {
  recepcao: 'curso',
  diagnostico: 'curso',
  orcamentacao: 'curso',
  aguarda_aprovacao: 'espera',
  em_reparacao: 'curso',
  controlo_qualidade: 'curso',
  pronta_entrega: 'pronto',
  entregue: 'fechado',
  cancelado: 'cancelado',
};
