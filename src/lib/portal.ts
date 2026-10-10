import type { Desconto, PortalProcesso } from '../types';
import { calcularTotais } from './calculos';

/** Horário de entrada e levantamento (o mesmo da agenda). */
export const HORARIO_OFICINA = 'De segunda a sexta, das 07h30 às 18h; ao sábado, até às 13h.';

export type LinhasPortal = Pick<NonNullable<PortalProcesso['orcamento']>, 'pecas' | 'maoObra' | 'taxaIva' | 'isencaoIva'> & { descontoPct?: number };

export const totalDe = (o: LinhasPortal) =>
  calcularTotais({ ...o, desconto: o.descontoPct ? ({ percentagem: o.descontoPct, estado: 'aprovado' } as Desconto) : undefined });

/** Frase principal do portal: o que se passa com a viatura, em linguagem do cliente. */
export function frasePrincipal(p: PortalProcesso): { titulo: string; texto?: string } {
  switch (p.estado) {
    case 'recepcao':
      return { titulo: 'Recebemos a sua viatura.', texto: 'O mecânico vai começar o diagnóstico em breve.' };
    case 'diagnostico':
      return { titulo: 'Estamos a fazer o diagnóstico.', texto: 'Quando terminarmos, enviamos o orçamento para aprovar.' };
    case 'orcamentacao':
      return { titulo: 'Estamos a preparar o orçamento.', texto: 'O diagnóstico está feito. Avisamos assim que o orçamento estiver pronto.' };
    case 'aguarda_aprovacao':
      return p.orcamento?.expirado
        ? { titulo: 'O prazo para aceitar terminou.', texto: 'A viatura está em parqueamento. Ainda pode aceitar o orçamento aqui, ou falar connosco.' }
        : { titulo: 'O orçamento está pronto.', texto: 'Veja o que encontrámos e decida se avançamos com a reparação.' };
    case 'em_reparacao':
      if (p.aguardaPagamentoAceitacao !== undefined) {
        return { titulo: 'Orçamento aceite.', texto: 'Começamos a reparação assim que recebermos o pagamento da aceitação.' };
      }
      return p.aguardaPecas
        ? { titulo: 'Estamos à espera de uma peça.', texto: 'A reparação continua assim que a peça chegar.' }
        : { titulo: 'A sua viatura está em reparação.' };
    case 'controlo_qualidade':
      return { titulo: 'Estamos a fazer a verificação final.', texto: 'Testamos a reparação e os pontos de segurança antes de a entregar.' };
    case 'pronta_entrega':
      return {
        titulo: 'A sua viatura está pronta a levantar.',
        texto: p.parqueamento ? 'O prazo para levantar sem custos já passou: o parqueamento conta até levantar a viatura.'
          : p.levantarAte ? 'Veja abaixo até quando pode levantar sem custos de parqueamento.' : undefined,
      };
    case 'entregue':
      return { titulo: 'Viatura entregue.', texto: 'Obrigado pela confiança.' };
    default:
      return { titulo: 'Este processo foi encerrado.', texto: 'Se tiver dúvidas, contacte-nos.' };
  }
}
