import type { ProcessoDetalhado } from '../types';
import { calcularTotais, emDivida } from './calculos';
import { formatAOA, formatDate } from './format';

/** Mensagem sugerida ao cliente conforme a etapa do processo (editável antes de enviar). */
export function mensagemSugerida(p: ProcessoDetalhado, comValores = true): string {
  const nome = p.cliente.nome.split(' ')[0];
  const viatura = `${p.viatura.marca} ${p.viatura.modelo} (${p.viatura.matricula})`;
  switch (p.estado) {
    case 'recepcao':
      return `Olá ${nome}, confirmamos a receção da sua viatura ${viatura} na MZD Carros e Motores. Processo nº ${p.numero}. Entregaremos até ${formatDate(p.prazoEntrega)}.`;
    case 'diagnostico':
      return `Olá ${nome}, a sua viatura ${viatura} está em diagnóstico. Entraremos em contacto assim que tivermos o resultado.`;
    case 'orcamentacao':
      return `Olá ${nome}, o diagnóstico da sua viatura ${viatura} está concluído e estamos a preparar o orçamento.`;
    case 'aguarda_aprovacao': {
      const problemas = (p.diagnostico?.itens ?? []).filter((i) => i.estado !== 'ok').map((i) => `• ${i.sistema}: ${i.observacao ?? ''}`).join('\n');
      const total = comValores && p.orcamento ? `\n\nValor total: ${formatAOA(calcularTotais(p.orcamento).total)} (IVA incluído). Orçamento válido ${p.orcamento.validadeDias} dias.` : '';
      return `Olá ${nome}, o diagnóstico da sua viatura ${viatura} está concluído.\n\nEncontrámos:\n${problemas || '• Ver relatório em anexo'}${total}\n\nPodemos avançar com a reparação? Responda SIM para aprovar.`;
    }
    case 'em_reparacao':
    case 'controlo_qualidade':
      return `Olá ${nome}, a reparação da sua viatura ${viatura} está em curso. Prazo previsto: ${formatDate(p.prazoEntrega)}.`;
    case 'pronta_entrega': {
      const saldo = comValores ? emDivida(p) : 0;
      return `Olá ${nome}, a sua viatura ${viatura} está pronta para levantamento.${saldo > 0 ? ` Valor a pagar: ${formatAOA(saldo)}.` : ''} Estamos ao seu dispor de segunda a sábado, das 08h às 18h.`;
    }
    case 'entregue':
      return `Olá ${nome}, obrigado pela confiança na MZD Carros e Motores. Como correu a experiência com a reparação da sua viatura ${viatura}?`;
    default:
      return `Olá ${nome}, `;
  }
}

export function linkWhatsApp(telefone: string, texto: string) {
  return `https://wa.me/${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}
