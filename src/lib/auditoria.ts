// Nomes legíveis para o registo de auditoria (o servidor guarda códigos curtos).

const ACAO: Record<string, string> = {
  login: 'Entrou', logout: 'Saiu', login_falhado: 'Tentativa de entrada falhada', mudar_senha: 'Mudou a palavra-passe',
  criar: 'Criou', editar: 'Editou', atualizar: 'Atualizou', cancelar: 'Cancelou', anexar: 'Juntou ficheiro',
  desativar: 'Desativou', reativar: 'Reativou', repor_senha: 'Repôs a palavra-passe de', repor: 'Repôs',
  mudar_estado: 'Mudou de etapa', atribuir_mecanico: 'Atribuiu mecânico', guardar_orcamento: 'Guardou orçamento',
  criar_adicional: 'Propôs trabalho adicional', recusa_cliente: 'Registou recusa do cliente', reprovar_qualidade: 'Reprovou no controlo de qualidade',
  pagamento: 'Registou pagamento', anular_pagamento: 'Anulou pagamento', desconto_aprovado: 'Aprovou desconto', desconto_recusado: 'Recusou desconto',
  adicional_aprovado: 'Trabalho adicional aprovado', adicional_recusado: 'Trabalho adicional recusado',
  portal_aprovado: 'Cliente aprovou no portal', portal_recusado: 'Cliente recusou no portal', renovar_link_portal: 'Gerou novo link do portal',
  fechar_caixa: 'Fechou a caixa', reabrir_caixa: 'Reabriu a caixa', fundir: 'Juntou clientes', transferir: 'Transferiu viatura',
  acerto_stock: 'Acertou stock', enviar: 'Enviou', receber: 'Recebeu', estado_marcacao: 'Mudou estado da marcação',
  enviar_mensagem: 'Enviou mensagem', registar_resposta: 'Registou resposta do cliente', descarregar: 'Descarregou',
};

export const ENTIDADE_LABEL: Record<string, string> = {
  sessao: 'Sessão', processo: 'Processo', cliente: 'Cliente', viatura: 'Viatura', utilizador: 'Utilizador',
  configuracao: 'Definições', peca: 'Peça', fornecedor: 'Fornecedor', encomenda: 'Encomenda', marcacao: 'Marcação',
  caixa: 'Caixa', mensagem: 'Mensagem', modelo_mensagem: 'Modelo de mensagem', copia_seguranca: 'Cópia de segurança',
};

export const acaoLegivel = (acao: string) => ACAO[acao] ?? acao.replace(/_/g, ' ');
export const entidadeLegivel = (e: string) => ENTIDADE_LABEL[e] ?? e.replace(/_/g, ' ');

/** Ações que merecem destaque (segurança e dinheiro). */
export const ACOES_SENSIVEIS = new Set(['login_falhado', 'anular_pagamento', 'reabrir_caixa', 'desativar', 'repor_senha', 'fundir', 'descarregar', 'acerto_stock']);
