import type { ChaveModelo, Configuracao, EstadoProcesso, Marcacao, ModeloMensagem, ProcessoDetalhado } from '../types';
import { calcularTotais, emDivida } from './calculos';
import { formatAOA, formatDate } from './format';
import { horaCurta } from './datas';

// Modelos de mensagem com variáveis entre chavetas, ex.: "Olá {cliente}, a viatura {matricula} está pronta."
// Uma linha cuja variável não tem valor (ex.: {total} para quem não vê preços) é omitida por inteiro,
// para a mensagem nunca sair com buracos.

export const VARIAVEIS_MODELO: { chave: string; descricao: string; exemplo: string }[] = [
  { chave: 'cliente', descricao: 'Primeiro nome do cliente', exemplo: 'Ana' },
  { chave: 'cliente_nome', descricao: 'Nome completo do cliente', exemplo: 'Ana Domingos' },
  { chave: 'viatura', descricao: 'Marca e modelo', exemplo: 'Toyota Hilux' },
  { chave: 'matricula', descricao: 'Matrícula', exemplo: 'LD-88-77-CD' },
  { chave: 'processo', descricao: 'Número do processo', exemplo: 'MZD-1042' },
  { chave: 'prazo', descricao: 'Previsão de entrega', exemplo: '08/10/2026' },
  { chave: 'problemas', descricao: 'Problemas encontrados no diagnóstico (um por linha)', exemplo: '• Travões: pastilhas gastas' },
  { chave: 'total', descricao: 'Total do orçamento com IVA', exemplo: '185 000 Kz' },
  { chave: 'validade', descricao: 'Validade do orçamento (dias)', exemplo: '15' },
  { chave: 'adicional_motivo', descricao: 'Justificação do trabalho adicional', exemplo: 'Disco de travão empenado' },
  { chave: 'adicional_total', descricao: 'Valor do trabalho adicional com IVA', exemplo: '42 000 Kz' },
  { chave: 'saldo', descricao: 'Valor ainda por pagar', exemplo: '60 000 Kz' },
  { chave: 'divida_total', descricao: 'Total em dívida do cliente', exemplo: '120 000 Kz' },
  { chave: 'faturas', descricao: 'Faturas em aberto', exemplo: 'FT 2026/2031' },
  { chave: 'data_marcacao', descricao: 'Dia da marcação', exemplo: 'segunda-feira, 6 de outubro' },
  { chave: 'hora_marcacao', descricao: 'Hora da marcação', exemplo: '09:30' },
  { chave: 'oficina', descricao: 'Nome da oficina', exemplo: 'MZD Carros e Motores' },
  { chave: 'telefone_oficina', descricao: 'Telefone da oficina', exemplo: '+244 923 000 000' },
  { chave: 'iban', descricao: 'IBAN para transferências', exemplo: 'AO06 0040 0000 …' },
];

const CHAVES = new Set(VARIAVEIS_MODELO.map((v) => v.chave));
const PADRAO_VARIAVEL = /\{([a-z_]+)\}/g;

/** Variáveis usadas no texto que não existem (o servidor recusa guardar modelos com estas). */
export function variaveisDesconhecidas(texto: string): string[] {
  return [...new Set([...texto.matchAll(PADRAO_VARIAVEL)].map((m) => m[1]).filter((c) => !CHAVES.has(c)))];
}

export function preencherModelo(texto: string, valores: Record<string, string | undefined>): string {
  return texto
    .split('\n')
    .filter((linha) => [...linha.matchAll(PADRAO_VARIAVEL)].every((m) => !CHAVES.has(m[1]) || !!valores[m[1]]))
    .map((linha) => linha.replace(PADRAO_VARIAVEL, (todo, chave: string) => (CHAVES.has(chave) ? valores[chave]! : todo)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Valores de exemplo, para pré-visualizar um modelo no editor. */
export const VALORES_EXEMPLO: Record<string, string> = Object.fromEntries(VARIAVEIS_MODELO.map((v) => [v.chave, v.exemplo]));

export interface ContextoMensagem {
  nome: string;
  config?: Configuracao;
  processo?: ProcessoDetalhado;
  marcacao?: Marcacao;
  divida?: { total: number; faturas: string[] };
  /** Sem permissão para ver valores, as variáveis de preços ficam vazias (e as linhas omitidas). */
  comValores: boolean;
}

export function valoresDoContexto({ nome, config, processo: p, marcacao: m, divida, comValores }: ContextoMensagem): Record<string, string | undefined> {
  const dinheiro = (v: number | undefined) => (comValores && v ? formatAOA(v) : undefined);
  const adicional = p?.orcamentosAdicionais?.find((a) => a.estado === 'enviado');
  const problemas = (p?.diagnostico?.itens ?? []).filter((i) => i.estado !== 'ok').map((i) => `• ${i.sistema}${i.observacao ? `: ${i.observacao}` : ''}`);
  return {
    cliente: nome.trim().split(/\s+/)[0],
    cliente_nome: nome.trim(),
    viatura: p ? `${p.viatura.marca} ${p.viatura.modelo}` : undefined,
    matricula: p?.viatura.matricula ?? m?.matricula,
    processo: p?.numero,
    prazo: p ? formatDate(p.prazoEntrega) : undefined,
    problemas: problemas.length ? problemas.join('\n') : undefined,
    total: dinheiro(p?.orcamento && calcularTotais(p.orcamento).total),
    validade: p?.orcamento ? String(p.orcamento.validadeDias) : undefined,
    adicional_motivo: adicional?.justificacao,
    adicional_total: dinheiro(adicional && calcularTotais(adicional).total),
    saldo: dinheiro(p && emDivida(p)),
    divida_total: dinheiro(divida?.total),
    faturas: divida?.faturas.join(', ') || undefined,
    data_marcacao: m ? new Date(m.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) : undefined,
    hora_marcacao: m ? horaCurta(m.data) : undefined,
    oficina: config?.empresa.nome ?? 'MZD Carros e Motores',
    telefone_oficina: config?.empresa.telefone,
    iban: config?.empresa.iban,
  };
}

/** Modelo sugerido para avisar o cliente em cada etapa do processo. */
export function modeloDaEtapa(p: Pick<ProcessoDetalhado, 'estado' | 'orcamentosAdicionais'>): ChaveModelo {
  if (p.orcamentosAdicionais?.some((a) => a.estado === 'enviado')) return 'adicional';
  const mapa: Partial<Record<EstadoProcesso, ChaveModelo>> = {
    recepcao: 'rececao',
    diagnostico: 'diagnostico',
    orcamentacao: 'diagnostico',
    aguarda_aprovacao: 'orcamento',
    em_reparacao: 'reparacao',
    controlo_qualidade: 'reparacao',
    pronta_entrega: 'pronta',
    entregue: 'entregue',
  };
  return mapa[p.estado] ?? 'livre';
}

export function linkWhatsApp(telefone: string, texto: string) {
  return `https://wa.me/${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}

/** Modelos com que a oficina começa (o PHP usa os mesmos na instalação). */
export const MODELOS_PADRAO: ModeloMensagem[] = [
  {
    chave: 'rececao', nome: 'Viatura recebida', descricao: 'Ao abrir o processo, depois da receção.',
    assunto: '{oficina} · Processo {processo} — viatura recebida',
    texto: 'Olá {cliente}, confirmamos a receção da sua viatura {viatura} ({matricula}) na {oficina}.\nProcesso nº {processo}.\nPrevisão de entrega: {prazo}.\n\nVamos mantê-lo informado em cada etapa.',
  },
  {
    chave: 'diagnostico', nome: 'Em diagnóstico', descricao: 'Enquanto o mecânico faz o diagnóstico.',
    assunto: '{oficina} · Processo {processo} — em diagnóstico',
    texto: 'Olá {cliente}, a sua viatura {viatura} ({matricula}) está em diagnóstico. Entraremos em contacto assim que tivermos o resultado.',
  },
  {
    chave: 'orcamento', nome: 'Diagnóstico e orçamento', descricao: 'Com o orçamento pronto, para o cliente aprovar.',
    assunto: '{oficina} · Processo {processo} — diagnóstico e orçamento',
    texto: 'Olá {cliente}, o diagnóstico da sua viatura {viatura} ({matricula}) está concluído.\n\nEncontrámos:\n{problemas}\n\nValor total: {total} (IVA incluído).\nOrçamento válido {validade} dias.\n\nPodemos avançar com a reparação? Responda SIM para aprovar.',
  },
  {
    chave: 'adicional', nome: 'Trabalho adicional', descricao: 'Quando aparece trabalho extra durante a reparação.',
    assunto: '{oficina} · Processo {processo} — trabalho adicional',
    texto: 'Olá {cliente}, durante a reparação da sua viatura {matricula} encontrámos trabalho adicional necessário:\n{adicional_motivo}\n\nValor adicional: {adicional_total} (IVA incluído).\n\nPodemos avançar? Responda SIM para aprovar.',
  },
  {
    chave: 'reparacao', nome: 'Em reparação', descricao: 'Ponto de situação durante a reparação.',
    assunto: '{oficina} · Processo {processo} — em reparação',
    texto: 'Olá {cliente}, a reparação da sua viatura {viatura} ({matricula}) está em curso.\nPrevisão de entrega: {prazo}.',
  },
  {
    chave: 'pronta', nome: 'Pronta para levantamento', descricao: 'Depois do controlo de qualidade aprovado.',
    assunto: '{oficina} · Processo {processo} — viatura pronta',
    texto: 'Olá {cliente}, a sua viatura {viatura} ({matricula}) está pronta para levantamento.\nValor a pagar: {saldo}.\n\nEstamos ao dispor de segunda a sábado, das 08h às 18h.',
  },
  {
    chave: 'entregue', nome: 'Agradecimento', descricao: 'Depois da entrega, para saber como correu.',
    assunto: '{oficina} · Obrigado pela confiança',
    texto: 'Olá {cliente}, obrigado pela confiança na {oficina}. Como correu a experiência com a reparação da sua viatura {matricula}? A sua opinião ajuda-nos a melhorar.',
  },
  {
    chave: 'marcacao', nome: 'Lembrete de marcação', descricao: 'Na véspera de uma marcação.',
    assunto: '{oficina} · Lembrete da sua marcação',
    texto: 'Olá {cliente}, lembramos a sua marcação na {oficina} {data_marcacao} às {hora_marcacao}.\nViatura: {matricula}.\n\nPode confirmar respondendo a esta mensagem.',
  },
  {
    chave: 'divida', nome: 'Lembrete de pagamento', descricao: 'Faturas por pagar há mais de 30 dias.',
    assunto: '{oficina} · Faturas em aberto',
    texto: 'Olá {cliente}, lembramos que tem {divida_total} por liquidar na {oficina} ({faturas}).\nPode pagar por TPA, Multicaixa Express ou transferência bancária.\nIBAN: {iban}\n\nObrigado.',
  },
  {
    chave: 'livre', nome: 'Mensagem livre', descricao: 'Ponto de partida para qualquer outro assunto.',
    assunto: '{oficina}',
    texto: 'Olá {cliente}, ',
  },
];
