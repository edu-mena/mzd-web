import type { EstadoProcesso, Perfil, Utilizador } from '../types';

// Matriz de permissões. No frontend serve apenas para mostrar/esconder;
// o backend tem de aplicar exatamente a mesma matriz em cada pedido.

export type Permissao =
  | 'painel.ver'
  | 'processos.ver'
  | 'processos.criar'
  | 'processos.cancelar'
  /** Atribuir mecânico e iniciar o diagnóstico. */
  | 'processos.atribuir'
  | 'diagnostico.editar'
  | 'orcamento.editar'
  | 'aprovacao.registar'
  | 'reparacao.executar'
  | 'qualidade.validar'
  | 'pagamentos.registar'
  /** Aprovar descontos acima do limite e reabrir caixas fechadas. */
  | 'financeiro.supervisionar'
  | 'entrega.registar'
  | 'clientes.ver'
  | 'clientes.editar'
  /** Juntar clientes duplicados (irreversível). */
  | 'clientes.fundir'
  | 'viaturas.ver'
  /** Enviar mensagens (WhatsApp/email) a clientes e ver o registo de comunicações. */
  | 'mensagens.enviar'
  | 'agenda.ver'
  /** Criar e gerir marcações. */
  | 'agenda.gerir'
  | 'pecas.ver'
  | 'pecas.editar'
  /** Ver preços, totais e valores financeiros. */
  | 'valores.ver'
  | 'faturacao.ver'
  | 'relatorios.ver'
  | 'equipa.ver'
  | 'definicoes.gerir'
  | 'sistema.admin';

export const PERMISSAO_LABEL: Record<Permissao, string> = {
  'painel.ver': 'Ver painel',
  'processos.ver': 'Ver processos',
  'processos.criar': 'Abrir processos (receção)',
  'processos.cancelar': 'Cancelar processos',
  'processos.atribuir': 'Atribuir mecânico',
  'diagnostico.editar': 'Fazer diagnósticos',
  'orcamento.editar': 'Fazer orçamentos',
  'aprovacao.registar': 'Registar aprovação do cliente',
  'reparacao.executar': 'Executar reparações',
  'qualidade.validar': 'Validar controlo de qualidade',
  'pagamentos.registar': 'Registar pagamentos e fechar caixa',
  'financeiro.supervisionar': 'Aprovar descontos e reabrir caixa',
  'entrega.registar': 'Entregar viaturas',
  'clientes.ver': 'Ver clientes',
  'clientes.editar': 'Criar e editar clientes e viaturas',
  'clientes.fundir': 'Juntar clientes duplicados',
  'viaturas.ver': 'Ver viaturas',
  'mensagens.enviar': 'Enviar mensagens a clientes',
  'agenda.ver': 'Ver agenda',
  'agenda.gerir': 'Gerir marcações',
  'pecas.ver': 'Ver peças',
  'pecas.editar': 'Gerir peças',
  'valores.ver': 'Ver preços e valores',
  'faturacao.ver': 'Ver faturação',
  'relatorios.ver': 'Ver relatórios',
  'equipa.ver': 'Ver equipa',
  'definicoes.gerir': 'Gerir definições',
  'sistema.admin': 'Administrar o sistema',
};

const TODAS = Object.keys(PERMISSAO_LABEL) as Permissao[];

export const PERMISSOES_POR_PERFIL: Record<Perfil, Permissao[]> = {
  admin: TODAS,
  direcao: TODAS.filter((p) => p !== 'sistema.admin'),
  chefe_oficina: [
    'painel.ver', 'processos.ver', 'processos.criar', 'processos.cancelar', 'processos.atribuir',
    'diagnostico.editar', 'orcamento.editar', 'aprovacao.registar', 'reparacao.executar', 'qualidade.validar', 'entrega.registar',
    'clientes.ver', 'clientes.editar', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'pecas.editar',
    'valores.ver', 'relatorios.ver', 'equipa.ver',
  ],
  administrativa: [
    'painel.ver', 'processos.ver', 'processos.criar',
    'orcamento.editar', 'aprovacao.registar', 'pagamentos.registar', 'entrega.registar',
    'clientes.ver', 'clientes.editar', 'clientes.fundir', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'pecas.editar',
    'valores.ver', 'faturacao.ver',
  ],
  rececionista: [
    'painel.ver', 'processos.ver', 'processos.criar', 'processos.atribuir',
    'orcamento.editar', 'aprovacao.registar', 'entrega.registar',
    'clientes.ver', 'clientes.editar', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'valores.ver',
  ],
  mecanico: ['painel.ver', 'processos.ver', 'diagnostico.editar', 'reparacao.executar', 'viaturas.ver', 'agenda.ver', 'pecas.ver'],
};

export function can(user: Pick<Utilizador, 'perfil'> | null | undefined, permissao: Permissao): boolean {
  if (!user) return false;
  return PERMISSOES_POR_PERFIL[user.perfil].includes(permissao);
}

/** Permissão necessária para concluir cada etapa (e passar à seguinte). */
export const PERMISSAO_ETAPA: Partial<Record<EstadoProcesso, Permissao>> = {
  recepcao: 'processos.atribuir',
  diagnostico: 'diagnostico.editar',
  orcamentacao: 'orcamento.editar',
  aguarda_aprovacao: 'aprovacao.registar',
  em_reparacao: 'reparacao.executar',
  controlo_qualidade: 'qualidade.validar',
  pronta_entrega: 'entrega.registar',
};
