// Tipos centrais do sistema de gestão de oficina MZD Carros e Motores

export type EstadoProcesso =
  | 'recepcao'
  | 'diagnostico'
  | 'aguarda_aprovacao_diagnostico'
  | 'orcamento_emitido'
  | 'aguarda_autorizacao'
  | 'em_reparacao'
  | 'controlo_qualidade'
  | 'pronta_entrega'
  | 'entregue';

export const ESTADOS_ORDEM: EstadoProcesso[] = [
  'recepcao',
  'diagnostico',
  'aguarda_aprovacao_diagnostico',
  'orcamento_emitido',
  'aguarda_autorizacao',
  'em_reparacao',
  'controlo_qualidade',
  'pronta_entrega',
  'entregue',
];

export const ESTADO_LABEL: Record<EstadoProcesso, string> = {
  recepcao: 'Receção',
  diagnostico: 'Em Diagnóstico',
  aguarda_aprovacao_diagnostico: 'Aguarda Aprovação',
  orcamento_emitido: 'Orçamento Emitido',
  aguarda_autorizacao: 'Aguarda Autorização',
  em_reparacao: 'Em Reparação',
  controlo_qualidade: 'Controlo de Qualidade',
  pronta_entrega: 'Pronta para Entrega',
  entregue: 'Entregue',
};

export type Perfil =
  | 'rececionista'
  | 'mecanico'
  | 'administrativa'
  | 'chefe_oficina'
  | 'direcao';

export const PERFIL_LABEL: Record<Perfil, string> = {
  rececionista: 'Rececionista',
  mecanico: 'Mecânico',
  administrativa: 'Assistente Administrativa',
  chefe_oficina: 'Chefe de Oficina',
  direcao: 'Direção',
};

export interface Utilizador {
  id: string;
  nome: string;
  perfil: Perfil;
  avatarIniciais: string;
  ativo: boolean;
  osConcluidas?: number;
  tempoMedioHoras?: number;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  nif: string;
  morada?: string;
  viaturasIds: string[];
  desde: string;
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
  aprovado: boolean;
  aprovacao?: {
    nomeCliente: string;
    data: string;
    metodo: 'assinatura' | 'digital' | 'foto';
  };
}

export interface ItemOrcamentoPeca {
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
  validadeDias: number;
  condicoesPagamento: string;
  enviadoEm?: string;
  estado: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  motivoRecusa?: string;
}

export interface Autorizacao {
  valorTotal: number;
  metodo: 'presencial' | 'email' | 'whatsapp';
  comprovativo?: string;
  data: string;
  autorizadoPor: string;
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
}

export interface Fatura {
  numero: string;
  data: string;
  formaPagamento: 'numerario' | 'transferencia' | 'tpa' | 'multicaixa';
  pago: boolean;
  valorPago: number;
  valorTotal: number;
}

export interface Garantia {
  item: string;
  tipo: 'peca' | 'mao_obra';
  prazoMeses: number;
}

export interface HistoricoEvento {
  id: string;
  data: string;
  autor: string;
  descricao: string;
  tipo: 'estado' | 'nota' | 'documento' | 'rejeicao';
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
  fichaRecepcao: FichaRecepcao;
  diagnostico?: Diagnostico;
  orcamento?: Orcamento;
  autorizacao?: Autorizacao;
  checklistQualidade?: ChecklistQualidade;
  fatura?: Fatura;
  garantias?: Garantia[];
  historico: HistoricoEvento[];
  aguardaPecas?: boolean;
}

export interface Peca {
  id: string;
  nome: string;
  categoria: string;
  fornecedor: string;
  precoBase: number;
  stock: number;
  stockMinimo: number;
}
