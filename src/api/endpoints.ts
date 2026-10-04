// Catálogo de endpoints da API. Cada função corresponde a uma rota que o backend PHP tem de expor
// em /api (ver também src/api/mock, que é a implementação de referência das regras).

import { enviarFicheiro, request } from './client';
import type {
  Anexo,
  AcessoPortal,
  CopiaSeguranca,
  EstadoSistema,
  PaginaAuditoria,
  Perfil,
  AlertaPainel,
  Relatorio,
  PortalProcesso,
  CanalMensagem,
  ChaveModelo,
  ComunicacaoPendente,
  Mensagem,
  ModeloMensagem,
  Notificacao,
  Cliente,
  ClienteResumo,
  Configuracao,
  FichaRecepcao,
  FinalidadeAnexo,
  FormaPagamento,
  ItemChecklistQualidade,
  ItemDiagnostico,
  ItemOrcamentoMaoObra,
  ItemOrcamentoPeca,
  MetodoAprovacao,
  Peca,
  Diagnostico,
  Marcacao,
  DividaCliente,
  FechoCaixa,
  MovimentoContaCorrente,
  Pagamento,
  Encomenda,
  Fornecedor,
  LinhaEncomenda,
  MovimentoStock,
  PecaResumo,
  TipoMarcacao,
  ProcessoDetalhado,
  Utilizador,
  Viatura,
  ViaturaResumo,
} from '../types';

function qs(filtros: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface DecisaoPortal {
  decisao: 'aprovado' | 'recusado';
  /** Nome de quem decide. */
  nome: string;
  /** Aceitação expressa do orçamento (obrigatória para aprovar). */
  aceito?: boolean;
  /** Motivo da recusa. */
  motivo?: string;
}

export interface DadosUtilizador { nome: string; email: string; telefone?: string; perfil: Perfil }

export interface FiltrosAuditoria { de?: string; ate?: string; utilizadorId?: string; entidade?: string; q?: string; pagina?: number; tamanho?: number }

export interface NovaMensagem {
  canal: CanalMensagem;
  direcao?: 'saida' | 'entrada';
  clienteId?: string;
  processoId?: string;
  marcacaoId?: string;
  assunto?: string;
  texto: string;
  modelo?: ChaveModelo;
}

export type DadosPeca = Omit<Peca, 'id' | 'stock'> & { stock?: number };
export type DadosFornecedor = Omit<Fornecedor, 'id' | 'ativo'> & { ativo?: boolean };
export interface SugestaoEncomenda { fornecedorId: string; linhas: LinhaEncomenda[]; motivos: string[]; processosIds: string[] }
export type DadosCliente = Pick<Cliente, 'nome' | 'telefone' | 'email' | 'nif' | 'morada' | 'consentimentoMensagens'>;
export type DadosViatura = Pick<Viatura, 'matricula' | 'marca' | 'modelo' | 'ano' | 'cor' | 'chassi'>;
export interface ParDuplicado { motivo: string; clientes: [ClienteResumo, ClienteResumo] }

export interface NovoProcesso {
  clienteId?: string;
  novoCliente?: Pick<Cliente, 'nome' | 'telefone' | 'email' | 'nif' | 'morada' | 'consentimentoMensagens'>;
  viaturaId?: string;
  novaViatura?: Pick<Viatura, 'matricula' | 'marca' | 'modelo' | 'ano' | 'cor' | 'chassi'>;
  ficha: Pick<FichaRecepcao, 'queixaCliente' | 'km' | 'combustivel' | 'bateria' | 'danos' | 'pertences'>;
  prazoEntrega: string;
  urgente: boolean;
  /** Marcação que deu origem a esta receção (passa a "chegou"). */
  marcacaoId?: string;
}

export interface DadosMarcacao {
  data: string;
  tipo: TipoMarcacao;
  viaturaId?: string;
  nome?: string;
  telefone?: string;
  matricula?: string;
  notas?: string;
  /** Marcar mesmo acima da capacidade do dia (o servidor responde 409 sem isto). */
  forcar?: boolean;
}

export interface DadosDiagnostico extends Pick<Diagnostico, 'parecerGeral' | 'recomendacao' | 'urgencia'> {
  itens: ItemDiagnostico[];
  concluir: boolean;
}

export interface DadosOrcamento {
  pecas: ItemOrcamentoPeca[];
  maoObra: ItemOrcamentoMaoObra[];
  validadeDias: number;
  condicoesPagamento: string;
  /** Sem desconto: omitir ou percentagem 0. */
  desconto?: { percentagem: number; motivo: string };
}

export interface PagamentoCaixa extends Pagamento {
  processoId: string;
  processoNumero: string;
  processoEstado: string;
  cliente: string;
  clienteNif?: string;
  matricula?: string;
  faturaNumero?: string;
}
export interface Caixa {
  dia: string;
  totais: Record<FormaPagamento, number>;
  fecho: FechoCaixa | null;
  pagamentos: PagamentoCaixa[];
}

export interface DadosPagamento {
  valor: number;
  forma: FormaPagamento;
  referencia?: string;
}

export type DadosAprovacao =
  | { decisao: 'recusado'; motivoRecusa: string }
  | {
      decisao: 'aprovado';
      metodo: MetodoAprovacao;
      autorizadoPor: string;
      assinaturaAnexoId?: string;
      comprovativoAnexoId?: string;
      adiantamento?: DadosPagamento;
    };

export interface DadosEntrega {
  km: number;
  combustivel: number;
  observacoes?: string;
  assinaturaAnexoId: string;
}

export const api = {
  auth: {
    login: (email: string, senha: string) => request<Utilizador>('POST', '/auth/login', { email, senha }),
    logout: () => request<void>('POST', '/auth/logout'),
    me: () => request<Utilizador>('GET', '/auth/me'),
    mudarSenha: (atual: string, nova: string) => request<Utilizador>('POST', '/auth/senha', { atual, nova }),
  },
  utilizadores: {
    listar: () => request<Utilizador[]>('GET', '/utilizadores'),
    criar: (dados: DadosUtilizador) => request<{ utilizador: Utilizador; senhaTemporaria: string }>('POST', '/utilizadores', dados),
    editar: (id: string, dados: DadosUtilizador) => request<Utilizador>('PUT', `/utilizadores/${id}`, dados),
    definirAtivo: (id: string, ativo: boolean) => request<Utilizador>('PATCH', `/utilizadores/${id}/estado`, { ativo }),
    reporSenha: (id: string) => request<{ senhaTemporaria: string }>('POST', `/utilizadores/${id}/senha`),
  },
  clientes: {
    listar: () => request<ClienteResumo[]>('GET', '/clientes'),
    obter: (id: string) => request<Cliente>('GET', `/clientes/${id}`),
    criar: (dados: DadosCliente) => request<Cliente>('POST', '/clientes', dados),
    editar: (id: string, dados: DadosCliente) => request<Cliente>('PUT', `/clientes/${id}`, dados),
    duplicados: () => request<ParDuplicado[]>('GET', '/clientes/duplicados'),
    /** Junta `origemId` em `destinoId` (irreversível). */
    fundir: (destinoId: string, origemId: string) => request<Cliente>('POST', `/clientes/${destinoId}/fundir`, { origemId }),
  },
  viaturas: {
    listar: (filtros: { clienteId?: string } = {}) => request<ViaturaResumo[]>('GET', `/viaturas${qs(filtros)}`),
    obter: (id: string) => request<ViaturaResumo>('GET', `/viaturas/${id}`),
    criar: (dados: DadosViatura & { clienteId: string; km: number }) => request<ViaturaResumo>('POST', '/viaturas', dados),
    editar: (id: string, dados: DadosViatura) => request<ViaturaResumo>('PUT', `/viaturas/${id}`, dados),
    transferir: (id: string, clienteId: string) => request<ViaturaResumo>('PATCH', `/viaturas/${id}/proprietario`, { clienteId }),
  },
  processos: {
    listar: (filtros: { clienteId?: string; viaturaId?: string } = {}) =>
      request<ProcessoDetalhado[]>('GET', `/processos${qs(filtros)}`),
    obter: (id: string) => request<ProcessoDetalhado>('GET', `/processos/${id}`),
    criar: (dados: NovoProcesso) => request<ProcessoDetalhado>('POST', '/processos', dados),
    avancar: (id: string) => request<ProcessoDetalhado>('POST', `/processos/${id}/avancar`),
    cancelar: (id: string, motivo: string) => request<ProcessoDetalhado>('POST', `/processos/${id}/cancelar`, { motivo }),
    atribuirMecanico: (id: string, mecanicoId: string) => request<ProcessoDetalhado>('PATCH', `/processos/${id}/mecanico`, { mecanicoId }),
    guardarDiagnostico: (id: string, dados: DadosDiagnostico) => request<ProcessoDetalhado>('PUT', `/processos/${id}/diagnostico`, dados),
    guardarOrcamento: (id: string, dados: DadosOrcamento) => request<ProcessoDetalhado>('PUT', `/processos/${id}/orcamento`, dados),
    registarAprovacao: (id: string, dados: DadosAprovacao) => request<ProcessoDetalhado>('POST', `/processos/${id}/aprovacao`, dados),
    marcarTarefa: (id: string, tarefaId: string, feita: boolean) => request<ProcessoDetalhado>('PATCH', `/processos/${id}/tarefas/${tarefaId}`, { feita }),
    definirPecasEmFalta: (id: string, aguardaPecas: boolean, nota?: string) => request<ProcessoDetalhado>('PATCH', `/processos/${id}/pecas`, { aguardaPecas, nota }),
    cronometro: (id: string, acao: 'iniciar' | 'parar') => request<ProcessoDetalhado>('POST', `/processos/${id}/tempo`, { acao }),
    proporAdicional: (id: string, dados: { justificacao: string; pecas: ItemOrcamentoPeca[]; maoObra: ItemOrcamentoMaoObra[] }) =>
      request<ProcessoDetalhado>('POST', `/processos/${id}/adicionais`, dados),
    decidirAdicional: (id: string, adicionalId: string, dados: { decisao: 'aprovado' | 'recusado'; metodo: MetodoAprovacao; autorizadoPor: string }) =>
      request<ProcessoDetalhado>('POST', `/processos/${id}/adicionais/${adicionalId}/decisao`, dados),
    registarQualidade: (id: string, dados: { itens: ItemChecklistQualidade[]; observacoes?: string }) =>
      request<ProcessoDetalhado>('PUT', `/processos/${id}/qualidade`, dados),
    registarPagamento: (id: string, dados: DadosPagamento) => request<ProcessoDetalhado>('POST', `/processos/${id}/pagamentos`, dados),
    registarEntrega: (id: string, dados: DadosEntrega) => request<ProcessoDetalhado>('POST', `/processos/${id}/entrega`, dados),
  },
  financeiro: {
    decidirDesconto: (processoId: string, decisao: 'aprovado' | 'recusado', motivo?: string) =>
      request<{ id: string }>('POST', `/processos/${processoId}/desconto`, { decisao, motivo }),
    anularPagamento: (processoId: string, pagamentoId: string, motivo: string) =>
      request<{ id: string }>('POST', `/processos/${processoId}/pagamentos/${pagamentoId}/anular`, { motivo }),
    caixa: (dia: string) => request<Caixa>('GET', `/caixa${qs({ dia })}`),
    fechos: () => request<FechoCaixa[]>('GET', '/caixa/fechos'),
    fecharCaixa: (dia: string, numerarioContado: number, notas?: string) => request<FechoCaixa>('POST', '/caixa/fechar', { dia, numerarioContado, notas }),
    reabrirCaixa: (dia: string, motivo: string) => request<{ dia: string }>('POST', '/caixa/reabrir', { dia, motivo }),
    dividas: () => request<DividaCliente[]>('GET', '/financeiro/dividas'),
    contaCorrente: (clienteId: string) => request<MovimentoContaCorrente[]>('GET', `/clientes/${clienteId}/conta-corrente`),
  },
  anexos: {
    listar: (processoId: string) => request<Anexo[]>('GET', `/processos/${processoId}/anexos`),
    enviar: (processoId: string, ficheiro: Blob, dados: { tipo: Anexo['tipo']; finalidade?: FinalidadeAnexo; legenda?: string; nome?: string }) => {
      const form = new FormData();
      form.append('ficheiro', ficheiro, dados.nome ?? (ficheiro instanceof File ? ficheiro.name : `${dados.tipo}.${ficheiro.type.split('/')[1] ?? 'bin'}`));
      form.append('tipo', dados.tipo);
      if (dados.finalidade) form.append('finalidade', dados.finalidade);
      if (dados.legenda) form.append('legenda', dados.legenda);
      return enviarFicheiro<Anexo>(`/processos/${processoId}/anexos`, form);
    },
  },
  marcacoes: {
    listar: (filtros: { de?: string; ate?: string }) => request<Marcacao[]>('GET', `/marcacoes${qs(filtros)}`),
    obter: (id: string) => request<Marcacao>('GET', `/marcacoes/${id}`),
    criar: (dados: DadosMarcacao) => request<Marcacao>('POST', '/marcacoes', dados),
    editar: (id: string, dados: DadosMarcacao) => request<Marcacao>('PUT', `/marcacoes/${id}`, dados),
    mudarEstado: (id: string, estado: 'agendada' | 'confirmada' | 'faltou' | 'cancelada') =>
      request<Marcacao>('PATCH', `/marcacoes/${id}/estado`, { estado }),
  },
  pecas: {
    listar: () => request<PecaResumo[]>('GET', '/pecas'),
    criar: (dados: DadosPeca) => request<PecaResumo>('POST', '/pecas', dados),
    editar: (id: string, dados: DadosPeca) => request<PecaResumo>('PUT', `/pecas/${id}`, dados),
    /** Contagem física: o stock passa a ser `stockContado`; a diferença fica registada com o motivo. */
    acerto: (id: string, stockContado: number, motivo: string) => request<PecaResumo>('POST', `/pecas/${id}/acerto`, { stockContado, motivo }),
    movimentos: (pecaId?: string) => request<MovimentoStock[]>('GET', `/movimentos${qs({ pecaId })}`),
  },
  fornecedores: {
    listar: () => request<Fornecedor[]>('GET', '/fornecedores'),
    criar: (dados: DadosFornecedor) => request<Fornecedor>('POST', '/fornecedores', dados),
    editar: (id: string, dados: DadosFornecedor) => request<Fornecedor>('PUT', `/fornecedores/${id}`, dados),
  },
  encomendas: {
    listar: () => request<Encomenda[]>('GET', '/encomendas'),
    sugestao: () => request<SugestaoEncomenda[]>('GET', '/encomendas/sugestao'),
    criar: (dados: { fornecedorId: string; linhas: LinhaEncomenda[]; processosIds?: string[]; notas?: string }) => request<Encomenda>('POST', '/encomendas', dados),
    editar: (id: string, dados: { linhas: LinhaEncomenda[]; notas?: string }) => request<Encomenda>('PUT', `/encomendas/${id}`, dados),
    enviar: (id: string) => request<Encomenda>('POST', `/encomendas/${id}/enviar`),
    cancelar: (id: string) => request<Encomenda>('POST', `/encomendas/${id}/cancelar`),
    receber: (id: string, linhas: { pecaId: string; quantidadeRecebida: number }[]) =>
      request<{ encomenda: Encomenda; desbloqueados: string[] }>('POST', `/encomendas/${id}/receber`, { linhas }),
  },
  modelos: {
    listar: () => request<ModeloMensagem[]>('GET', '/modelos'),
    guardar: (chave: ChaveModelo, dados: Pick<ModeloMensagem, 'nome' | 'assunto' | 'texto'>) => request<ModeloMensagem>('PUT', `/modelos/${chave}`, dados),
    repor: (chave: ChaveModelo) => request<ModeloMensagem>('POST', `/modelos/${chave}/repor`),
  },
  mensagens: {
    listar: (filtros: { clienteId?: string; processoId?: string; marcacaoId?: string; canal?: CanalMensagem } = {}) =>
      request<Mensagem[]>('GET', `/mensagens${qs(filtros)}`),
    /** Saída: o servidor envia (email) ou regista (WhatsApp, fase A). Entrada: resposta do cliente registada à mão. */
    criar: (dados: NovaMensagem) => request<Mensagem>('POST', '/mensagens', dados),
    pendentes: () => request<ComunicacaoPendente[]>('GET', '/comunicacoes/pendentes'),
  },
  /** Rotas públicas do portal do cliente: o token do link é a credencial. */
  portal: {
    obter: (token: string) => request<PortalProcesso>('GET', `/portal/${encodeURIComponent(token)}`),
    decidirOrcamento: (token: string, dados: DecisaoPortal) =>
      request<PortalProcesso>('POST', `/portal/${encodeURIComponent(token)}/aprovacao`, dados),
    decidirAdicional: (token: string, adicionalId: string, dados: DecisaoPortal) =>
      request<PortalProcesso>('POST', `/portal/${encodeURIComponent(token)}/adicionais/${adicionalId}`, dados),
    /** Equipa: gera um link novo; o anterior deixa de funcionar. */
    renovar: (processoId: string) => request<AcessoPortal>('POST', `/processos/${processoId}/portal/renovar`),
  },
  relatorios: {
    /** `de` e `ate` em "AAAA-MM-DD" (dias locais, inclusive). */
    obter: (de: string, ate: string) => request<Relatorio>('GET', `/relatorios${qs({ de, ate })}`),
    alertas: () => request<AlertaPainel[]>('GET', '/painel/alertas'),
  },
  notificacoes: {
    listar: () => request<Notificacao[]>('GET', '/notificacoes'),
    marcarLidas: (ids?: string[]) => request<void>('POST', '/notificacoes/lidas', { ids }),
  },
  configuracao: {
    obter: () => request<Configuracao>('GET', '/configuracao'),
    guardar: (dados: Configuracao) => request<Configuracao>('PUT', '/configuracao', dados),
  },
  auditoria: {
    listar: (f: FiltrosAuditoria = {}) =>
      request<PaginaAuditoria>('GET', `/auditoria${qs({ ...f, pagina: f.pagina ? String(f.pagina) : undefined, tamanho: f.tamanho ? String(f.tamanho) : undefined })}`),
  },
  sistema: {
    estado: () => request<EstadoSistema>('GET', '/sistema/estado'),
    copias: () => request<CopiaSeguranca[]>('GET', '/sistema/copias'),
    criarCopia: () => request<CopiaSeguranca>('POST', '/sistema/copias'),
    /** No PHP: descarrega o .sql.gz. Na demonstração: os dados em JSON. */
    dadosCopia: (id: string) => request<unknown>('GET', `/sistema/copias/${id}/dados`),
  },

  demo: {
    repor: () => request<void>('POST', '/demo/repor'),
  },
};
