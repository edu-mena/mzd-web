// Tipos centrais do sistema de gestão de oficina MZD Carros e Motores.
// Estes tipos são também o contrato com a API (PHP): o backend deve devolver estas formas.

// ---------- Processo: estados ----------
// A aprovação do diagnóstico e do orçamento é feita num único passo pelo cliente ("aguarda_aprovacao").

export type EstadoProcesso =
  | 'recepcao'
  | 'diagnostico'
  | 'orcamentacao'
  | 'aguarda_aprovacao'
  | 'em_reparacao'
  | 'controlo_qualidade'
  | 'pronta_entrega'
  | 'entregue'
  | 'cancelado';

/** Percurso normal de um processo (o estado "cancelado" é terminal e fica fora do percurso). */
export const ESTADOS_ORDEM: EstadoProcesso[] = [
  'recepcao',
  'diagnostico',
  'orcamentacao',
  'aguarda_aprovacao',
  'em_reparacao',
  'controlo_qualidade',
  'pronta_entrega',
  'entregue',
];

/** Estados em que a viatura ainda está a ser trabalhada na oficina. */
export const ESTADOS_ATIVOS = ESTADOS_ORDEM.filter((e) => e !== 'entregue');

export const ESTADO_LABEL: Record<EstadoProcesso, string> = {
  recepcao: 'Receção',
  diagnostico: 'Em Diagnóstico',
  orcamentacao: 'Em Orçamentação',
  aguarda_aprovacao: 'Aguarda Aprovação',
  em_reparacao: 'Em Reparação',
  controlo_qualidade: 'Controlo de Qualidade',
  pronta_entrega: 'Pronta para Entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export function estaAtivo(estado: EstadoProcesso) {
  return estado !== 'entregue' && estado !== 'cancelado';
}

// ---------- Utilizadores e permissões ----------

export type Perfil =
  | 'admin'
  | 'direcao'
  | 'chefe_oficina'
  | 'administrativa'
  | 'rececionista'
  | 'mecanico';

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: 'Administrador do Sistema',
  direcao: 'Direção',
  chefe_oficina: 'Chefe de Oficina',
  administrativa: 'Assistente Administrativa',
  rececionista: 'Rececionista',
  mecanico: 'Mecânico',
};

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  perfil: Perfil;
  avatarIniciais: string;
  ativo: boolean;
  osConcluidas?: number;
  tempoMedioHoras?: number;
}

// ---------- Clientes e viaturas ----------

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  nif?: string;
  morada?: string;
  desde: string;
  /** Consentimento para receber mensagens por WhatsApp/email (Lei 22/11 de Proteção de Dados). */
  consentimentoMensagens: boolean;
}

export interface Viatura {
  id: string;
  clienteId: string;
  matricula: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  chassi: string;
  km: number;
}

// ---------- Documentos do processo ----------

export interface ItemDano {
  x: number;
  y: number;
  tipo: 'risco' | 'mossa' | 'outro';
  vista: 'topo' | 'perfil';
  nota?: string;
}

export interface FichaRecepcao {
  queixaCliente: string;
  km: number;
  combustivel: number; // 0-100
  bateria: 'boa' | 'fraca' | 'a_testar';
  danos: ItemDano[];
  pertences: string;
  dataHora: string;
  assinaturaCliente: boolean;
  /** Imagem da assinatura do cliente na receção. */
  assinaturaAnexoId?: string;
  atendenteId: string;
}

export type EstadoItem = 'ok' | 'atencao' | 'critico';

export interface ItemDiagnostico {
  sistema: string;
  estado: EstadoItem;
  observacao?: string;
}

export interface Diagnostico {
  itens: ItemDiagnostico[];
  parecerGeral: string;
  recomendacao: 'reparar' | 'substituir' | 'ambos';
  urgencia: 'baixo' | 'medio' | 'alto' | 'seguranca';
  mecanicoId: string;
  concluidoEm?: string;
}

export interface ItemOrcamentoPeca {
  pecaId?: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
}

export interface ItemOrcamentoMaoObra {
  descricao: string;
  horas: number;
  valorHora: number;
}

export interface Orcamento {
  pecas: ItemOrcamentoPeca[];
  maoObra: ItemOrcamentoMaoObra[];
  /** Taxa de IVA em vigor no momento da emissão (%), guardada com o orçamento. */
  taxaIva: number;
  validadeDias: number;
  condicoesPagamento: string;
  enviadoEm?: string;
  estado: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  motivoRecusa?: string;
  desconto?: Desconto;
}

/** Aprovação do cliente — cobre o diagnóstico e o orçamento em conjunto. */
export interface Autorizacao {
  valorTotal: number;
  metodo: MetodoAprovacao;
  comprovativoAnexoId?: string;
  assinaturaAnexoId?: string;
  data: string;
  autorizadoPor: string;
  registadoPorId?: string;
}

export type MetodoAprovacao = 'presencial' | 'email' | 'whatsapp' | 'telefone' | 'portal';

export const METODO_APROVACAO_LABEL: Record<MetodoAprovacao, string> = {
  presencial: 'Presencial, com assinatura',
  whatsapp: 'Por WhatsApp',
  email: 'Por email',
  telefone: 'Por telefone',
  portal: 'No portal do cliente',
};

/** Trabalho descoberto durante a reparação que precisa de nova aprovação do cliente. */
export interface OrcamentoAdicional {
  id: string;
  justificacao: string;
  pecas: ItemOrcamentoPeca[];
  maoObra: ItemOrcamentoMaoObra[];
  taxaIva: number;
  criadoEm: string;
  criadoPorId: string;
  estado: 'enviado' | 'aprovado' | 'recusado';
  decisao?: { metodo: MetodoAprovacao; data: string; autorizadoPor: string };
}

/** Tarefa de reparação, gerada a partir das linhas aprovadas do orçamento. */
export interface Tarefa {
  id: string;
  descricao: string;
  origem: 'peca' | 'mao_obra';
  /** Tarefas de montagem: peça do catálogo e quantidade (dão baixa no stock quando feitas). */
  pecaId?: string;
  quantidade?: number;
  adicionalId?: string;
  feita: boolean;
  feitaPorId?: string;
  feitaEm?: string;
}

/** Período de trabalho registado por um mecânico (cronómetro). */
export interface RegistoTempo {
  id: string;
  mecanicoId: string;
  inicio: string;
  fim?: string;
}

export interface Entrega {
  data: string;
  km: number;
  combustivel: number;
  observacoes?: string;
  assinaturaAnexoId?: string;
  entreguePorId: string;
}

export interface ItemChecklistQualidade {
  item: string;
  conforme: boolean | null;
  nota?: string;
}

export interface ChecklistQualidade {
  itens: ItemChecklistQualidade[];
  responsavelId: string;
  dataHora?: string;
  aprovado: boolean;
  observacoes?: string;
}

/** Verificações de segurança feitas em todas as viaturas no controlo de qualidade. */
export const VERIFICACOES_SEGURANCA = ['Travões', 'Luzes', 'Níveis de fluidos', 'Aperto de rodas e fixações', 'Ausência de fugas', 'Teste de estrada'];

/** Sistemas inspecionados no diagnóstico. */
export const SISTEMAS_VEICULO = ['Motor', 'Travões', 'Suspensão/Direção', 'Sistema Elétrico', 'Ar Condicionado', 'Transmissão/Caixa', 'Pneus', 'Fluidos', 'Carroçaria'];

export type FormaPagamento = 'numerario' | 'transferencia' | 'tpa' | 'multicaixa';

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  numerario: 'Numerário',
  transferencia: 'Transferência Bancária',
  tpa: 'TPA',
  multicaixa: 'Multicaixa Express',
};

export interface Pagamento {
  id: string;
  /** Nº do recibo entregue ao cliente (RC-AAAA-NNNN). */
  numeroRecibo: string;
  data: string;
  valor: number;
  forma: FormaPagamento;
  referencia?: string;
  registadoPorId: string;
  /** Pagamentos nunca se apagam: um erro anula-se, com motivo e autor. */
  anulado?: { motivo: string; data: string; porId: string };
}

/** Desconto sobre o orçamento (antes do IVA). Acima do limite configurado precisa de aprovação da Direção. */
export interface Desconto {
  percentagem: number;
  motivo: string;
  estado: 'aprovado' | 'pendente' | 'recusado';
  pedidoPorId: string;
  pedidoEm: string;
  decididoPorId?: string;
  decididoEm?: string;
  motivoDecisao?: string;
}

/** Fecho de caixa de um dia: totais por forma de pagamento e conferência do numerário. */
export interface FechoCaixa {
  id: string;
  /** "AAAA-MM-DD". */
  dia: string;
  totais: Record<FormaPagamento, number>;
  numerarioContado: number;
  /** numerarioContado − totais.numerario (negativo = falta dinheiro). */
  diferenca: number;
  nRecibos: number;
  notas?: string;
  fechadoPorId: string;
  fechadoEm: string;
}

export interface MovimentoContaCorrente {
  data: string;
  tipo: 'fatura' | 'pagamento' | 'anulacao';
  documento: string;
  processoId: string;
  processoNumero: string;
  debito: number;
  credito: number;
  saldo: number;
}

export interface DividaCliente {
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone' | 'consentimentoMensagens'>;
  total: number;
  /** Por antiguidade da fatura: até 30 dias, 31–60, 61–90, mais de 90. */
  escaloes: [number, number, number, number];
  faturas: { processoId: string; processoNumero: string; numero: string; data: string; dias: number; saldo: number }[];
}

export interface Fatura {
  numero: string;
  data: string;
  /** Total com IVA. */
  valorTotal: number;
  pagamentos: Pagamento[];
}

export interface Garantia {
  item: string;
  tipo: 'peca' | 'mao_obra';
  prazoMeses: number;
}

export interface Cancelamento {
  motivo: string;
  data: string;
  autorId: string;
  /** Estado em que o processo estava quando foi cancelado. */
  estadoAnterior: EstadoProcesso;
}

export interface HistoricoEvento {
  id: string;
  data: string;
  autor: string;
  descricao: string;
  tipo: 'estado' | 'nota' | 'documento' | 'rejeicao' | 'cancelamento';
  /** Estado para o qual o processo passou (eventos de mudança de estado e cancelamento). */
  estado?: EstadoProcesso;
}

export interface Processo {
  id: string;
  numero: string;
  clienteId: string;
  viaturaId: string;
  estado: EstadoProcesso;
  criadoEm: string;
  prazoEntrega: string;
  mecanicoId?: string;
  atendenteId: string;
  urgente: boolean;
  aguardaPecas?: boolean;
  fichaRecepcao: FichaRecepcao;
  diagnostico?: Diagnostico;
  orcamento?: Orcamento;
  autorizacao?: Autorizacao;
  checklistQualidade?: ChecklistQualidade;
  orcamentosAdicionais?: OrcamentoAdicional[];
  tarefas?: Tarefa[];
  registosTempo?: RegistoTempo[];
  /** Nº de vezes que a viatura voltou à reparação por reprovação no controlo de qualidade. */
  retrabalhos?: number;
  notaPecas?: string;
  /** Pagamentos recebidos antes da emissão da fatura; passam para a fatura quando é emitida. */
  adiantamentos?: Pagamento[];
  fatura?: Fatura;
  garantias?: Garantia[];
  entrega?: Entrega;
  cancelamento?: Cancelamento;
  historico: HistoricoEvento[];
}

// ---------- Stock ----------

export interface Fornecedor {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  nif?: string;
  /** Prazo habitual de entrega, em dias (para prever a chegada das encomendas). */
  prazoEntregaDias: number;
  ativo: boolean;
}

export interface Peca {
  id: string;
  /** Código interno ou do fabricante. */
  referencia: string;
  nome: string;
  categoria: string;
  fornecedorId: string;
  /** Custo médio ponderado de compra (sem IVA). Só visível a quem gere o stock. */
  precoCusto: number;
  /** Preço de venda ao cliente (sem IVA). */
  precoBase: number;
  /** Stock físico na prateleira. */
  stock: number;
  stockMinimo: number;
  localizacao?: string;
}

/** Peça com os valores calculados pelo servidor. */
export interface PecaResumo extends Peca {
  fornecedor: string;
  /** Unidades reservadas para processos aprovados e ainda não montadas. */
  reservado: number;
  /** stock − reservado (pode ser negativo: falta comprar). */
  disponivel: number;
  /** Unidades já encomendadas e ainda não recebidas. */
  encomendado: number;
}

export type TipoMovimento = 'entrada' | 'saida' | 'acerto' | 'devolucao';
export const TIPO_MOVIMENTO_LABEL: Record<TipoMovimento, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  acerto: 'Acerto de inventário',
  devolucao: 'Devolução ao stock',
};

export interface MovimentoStock {
  id: string;
  pecaId: string;
  tipo: TipoMovimento;
  /** Positivo entra, negativo sai. */
  quantidade: number;
  /** Stock depois do movimento. */
  stockApos: number;
  data: string;
  utilizadorId: string;
  processoId?: string;
  encomendaId?: string;
  motivo?: string;
}

export type EstadoEncomenda = 'rascunho' | 'enviada' | 'recebida' | 'cancelada';
export const ESTADO_ENCOMENDA_LABEL: Record<EstadoEncomenda, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  recebida: 'Recebida',
  cancelada: 'Cancelada',
};

export interface LinhaEncomenda {
  pecaId: string;
  quantidade: number;
  /** Custo unitário acordado com o fornecedor (sem IVA). */
  precoCusto: number;
  quantidadeRecebida?: number;
}

export interface Encomenda {
  id: string;
  numero: string;
  fornecedorId: string;
  estado: EstadoEncomenda;
  linhas: LinhaEncomenda[];
  /** Processos à espera destas peças (são desbloqueados na receção). */
  processosIds: string[];
  notas?: string;
  criadoEm: string;
  criadoPorId: string;
  enviadaEm?: string;
  previsaoEntrega?: string;
  recebidaEm?: string;
}

// ---------- Multimédia, comunicações e auditoria ----------

export interface Anexo {
  id: string;
  processoId: string;
  tipo: 'foto' | 'video' | 'documento' | 'assinatura';
  etapa: EstadoProcesso;
  /** Para que serve o ficheiro, quando tem um papel específico no processo. */
  finalidade?: FinalidadeAnexo;
  legenda?: string;
  nome: string;
  /** URL servida pelo backend após verificação de permissões (nunca acesso direto à pasta). */
  url: string;
  tamanhoBytes: number;
  criadoEm: string;
  autorId: string;
}

export type FinalidadeAnexo = 'assinatura_recepcao' | 'assinatura_aprovacao' | 'comprovativo_aprovacao' | 'assinatura_entrega';

export interface Mensagem {
  id: string;
  processoId?: string;
  clienteId: string;
  canal: 'whatsapp' | 'email';
  texto: string;
  estado: 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falhada';
  criadoEm: string;
  autorId?: string;
}

export interface EventoAuditoria {
  id: string;
  data: string;
  utilizadorId: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhe?: string;
}

// ---------- Configuração ----------

export interface Configuracao {
  empresa: {
    nome: string;
    nif: string;
    morada: string;
    telefone: string;
    email: string;
    iban?: string;
  };
  /** Taxa de IVA (%) aplicada a novos orçamentos. */
  taxaIva: number;
  valorHora: number;
  validadeOrcamentoDias: number;
  garantiaPecasMeses: number;
  garantiaMaoObraMeses: number;
  /** Nº de viaturas que a oficina consegue receber por dia (marcações). */
  capacidadeDiaria: number;
  /** Desconto máximo (%) que se aplica sem aprovação da Direção. */
  descontoMaximoPct: number;
}

// ---------- Agenda ----------

export type TipoMarcacao = 'revisao' | 'diagnostico' | 'reparacao' | 'outro';
export const TIPO_MARCACAO_LABEL: Record<TipoMarcacao, string> = {
  revisao: 'Revisão',
  diagnostico: 'Diagnóstico',
  reparacao: 'Reparação',
  outro: 'Outro',
};

export type EstadoMarcacao = 'agendada' | 'confirmada' | 'chegou' | 'faltou' | 'cancelada';
export const ESTADO_MARCACAO_LABEL: Record<EstadoMarcacao, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  chegou: 'Chegou',
  faltou: 'Faltou',
  cancelada: 'Cancelada',
};

/** Marcação de entrada de uma viatura na oficina. Cliente/viatura podem ainda não estar registados. */
export interface Marcacao {
  id: string;
  /** Data e hora de chegada prevista (ISO). */
  data: string;
  tipo: TipoMarcacao;
  estado: EstadoMarcacao;
  clienteId?: string;
  viaturaId?: string;
  /** Contacto para quem ainda não é cliente (ou para confirmar). */
  nome: string;
  telefone: string;
  matricula?: string;
  notas?: string;
  processoId?: string;
  criadoPorId: string;
  criadoEm: string;
}

// ---------- Formas devolvidas pela API (com dados relacionados) ----------

export interface ProcessoDetalhado extends Processo {
  cliente: Cliente;
  viatura: Viatura;
  mecanico?: Utilizador;
}

export interface ClienteResumo extends Cliente {
  nViaturas: number;
  nProcessos: number;
}

export interface ViaturaResumo extends Viatura {
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone'>;
  nServicos: number;
}
