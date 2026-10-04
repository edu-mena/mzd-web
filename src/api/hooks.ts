import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import type { DecisaoPortal, NovaMensagem, NovoProcesso } from './endpoints';
import type { Configuracao, ModeloMensagem, Notificacao, ProcessoDetalhado } from '../types';

// Chaves de cache centralizadas, para invalidar de forma consistente após alterações.
export const chaves = {
  me: ['auth', 'me'] as const,
  utilizadores: ['utilizadores'] as const,
  clientes: ['clientes'] as const,
  cliente: (id: string) => ['clientes', id] as const,
  viaturas: (filtros: { clienteId?: string } = {}) => ['viaturas', filtros] as const,
  viatura: (id: string) => ['viaturas', 'id', id] as const,
  processos: (filtros: { clienteId?: string; viaturaId?: string } = {}) => ['processos', filtros] as const,
  processo: (id: string) => ['processos', 'id', id] as const,
  anexos: (processoId: string) => ['anexos', processoId] as const,
  marcacoes: (de?: string, ate?: string) => ['marcacoes', de, ate] as const,
  pecas: ['pecas'] as const,
  configuracao: ['configuracao'] as const,
  auditoria: ['auditoria'] as const,
};

/**
 * Muda o utilizador da sessão e descarta os dados em cache da sessão anterior.
 * Não usar qc.clear(): apagaria também a consulta da sessão que o AuthProvider está a observar,
 * e o novo utilizador ficaria numa consulta que ninguém observa.
 */
export function trocarSessao<T>(qc: QueryClient, utilizador: T | null) {
  qc.setQueryData(chaves.me, utilizador);
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== chaves.me[0] });
}

interface Opcoes { enabled?: boolean }

export const useClientes = (opcoes: Opcoes = {}) => useQuery({ queryKey: chaves.clientes, queryFn: api.clientes.listar, ...opcoes });
export const useCliente = (id: string) => useQuery({ queryKey: chaves.cliente(id), queryFn: () => api.clientes.obter(id), enabled: !!id });
export const useDuplicados = (opcoes: Opcoes = {}) => useQuery({ queryKey: ['clientes', 'duplicados'], queryFn: api.clientes.duplicados, ...opcoes });

/**
 * Alteração a clientes/viaturas (criar, editar, transferir, juntar). Afeta listas de clientes,
 * viaturas e processos (que mostram nome do cliente), por isso refresca as três.
 */
export function useAlterarCadastro<T>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<T>) => executar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['viaturas'] });
      qc.invalidateQueries({ queryKey: ['processos'] });
    },
  });
}

export const useViaturas = (filtros: { clienteId?: string } = {}, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: chaves.viaturas(filtros), queryFn: () => api.viaturas.listar(filtros), ...opcoes });
export const useViatura = (id: string) => useQuery({ queryKey: chaves.viatura(id), queryFn: () => api.viaturas.obter(id), enabled: !!id });

export const useProcessos = (filtros: { clienteId?: string; viaturaId?: string } = {}, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: chaves.processos(filtros), queryFn: () => api.processos.listar(filtros), ...opcoes });
export const useProcesso = (id: string) => useQuery({ queryKey: chaves.processo(id), queryFn: () => api.processos.obter(id), enabled: !!id });

export const useMarcacao = (id: string) => useQuery({ queryKey: ['marcacoes', 'id', id], queryFn: () => api.marcacoes.obter(id), enabled: !!id });
export const useMarcacoes = (de?: string, ate?: string, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: chaves.marcacoes(de, ate), queryFn: () => api.marcacoes.listar({ de, ate }), ...opcoes });

/** Criar/editar/mudar estado de marcações. */
export function useAlterarMarcacao<T>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<T>) => executar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marcacoes'] });
      refrescarComunicacoes(qc);
    },
  });
}

export const useUtilizadores = () => useQuery({ queryKey: chaves.utilizadores, queryFn: api.utilizadores.listar });
export const usePecas = () => useQuery({ queryKey: chaves.pecas, queryFn: api.pecas.listar });
export const useConfiguracao = () => useQuery({ queryKey: chaves.configuracao, queryFn: api.configuracao.obter, staleTime: 5 * 60_000 });

/** Alterações que geram notificações internas ou mudam a lista de clientes por avisar. */
function refrescarComunicacoes(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['notificacoes'] });
  qc.invalidateQueries({ queryKey: ['comunicacoes'] });
}

/** Depois de qualquer alteração a um processo: atualiza-o em cache e refresca as listas dependentes. */
function aposAlterarProcesso(qc: QueryClient, p: ProcessoDetalhado) {
  refrescarComunicacoes(qc);
  // Pagamentos e faturas alimentam a caixa, as dívidas e a conta corrente.
  qc.invalidateQueries({ queryKey: ['financeiro'] });
  // Tarefas de montagem e aprovações mexem no stock (baixas e reservas).
  qc.invalidateQueries({ queryKey: chaves.pecas });
  qc.invalidateQueries({ queryKey: ['movimentos'] });
  qc.setQueryData(chaves.processo(p.id), p);
  qc.invalidateQueries({ queryKey: ['processos'], predicate: (q) => q.queryKey[1] !== 'id' || q.queryKey[2] !== p.id });
  qc.invalidateQueries({ queryKey: ['clientes'] });
  qc.invalidateQueries({ queryKey: ['viaturas'] });
}

/**
 * Executa uma ação sobre um processo (avançar, guardar diagnóstico, registar pagamento, ...).
 * Uso: const acao = useAcaoProcesso(); acao.mutate(() => api.processos.avancar(id), { onSuccess })
 */
export function useAcaoProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<ProcessoDetalhado>) => executar(),
    onSuccess: (p) => aposAlterarProcesso(qc, p),
  });
}

export function useCriarProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: NovoProcesso) => api.processos.criar(dados),
    onSuccess: (p) => {
      aposAlterarProcesso(qc, p);
      qc.invalidateQueries({ queryKey: ['marcacoes'] });
    },
  });
}

export const useAnexos = (processoId: string, enabled = true) =>
  useQuery({ queryKey: chaves.anexos(processoId), queryFn: () => api.anexos.listar(processoId), enabled: enabled && !!processoId });

export function useEnviarAnexo(processoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ficheiro, ...dados }: { ficheiro: Blob } & Parameters<typeof api.anexos.enviar>[2]) =>
      api.anexos.enviar(processoId, ficheiro, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.anexos(processoId) });
      qc.invalidateQueries({ queryKey: chaves.processo(processoId) });
    },
  });
}

export const useCaixa = (dia: string, opcoes: Opcoes = {}) => useQuery({ queryKey: ['financeiro', 'caixa', dia], queryFn: () => api.financeiro.caixa(dia), ...opcoes });
export const useFechos = () => useQuery({ queryKey: ['financeiro', 'fechos'], queryFn: api.financeiro.fechos });
export const useDividas = () => useQuery({ queryKey: ['financeiro', 'dividas'], queryFn: api.financeiro.dividas });
export const useContaCorrente = (clienteId: string, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: ['financeiro', 'conta', clienteId], queryFn: () => api.financeiro.contaCorrente(clienteId), ...opcoes });

/** Operações financeiras (descontos, anulações, caixa): refresca o financeiro e os processos. */
export function useAlterarFinanceiro<T>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<T>) => executar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      qc.invalidateQueries({ queryKey: ['processos'] });
      refrescarComunicacoes(qc);
    },
  });
}

export const useFornecedores = () => useQuery({ queryKey: ['fornecedores'], queryFn: api.fornecedores.listar });
export const useEncomendas = (opcoes: Opcoes = {}) => useQuery({ queryKey: ['encomendas'], queryFn: api.encomendas.listar, ...opcoes });
export const useSugestaoEncomendas = (opcoes: Opcoes = {}) => useQuery({ queryKey: ['encomendas', 'sugestao'], queryFn: api.encomendas.sugestao, ...opcoes });
export const useMovimentos = (pecaId?: string, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: ['movimentos', pecaId], queryFn: () => api.pecas.movimentos(pecaId), ...opcoes });

/**
 * Alterações de stock (peças, acertos, fornecedores, encomendas). Uma receção de encomenda pode
 * desbloquear processos, por isso também se refrescam os processos.
 */
export function useAlterarStock<T>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<T>) => executar(),
    onSuccess: () => {
      ['pecas', 'fornecedores', 'encomendas', 'movimentos', 'processos'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      refrescarComunicacoes(qc);
    },
  });
}

export function useGuardarConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: Configuracao) => api.configuracao.guardar(dados),
    onSuccess: (c) => qc.setQueryData(chaves.configuracao, c),
  });
}

export const useModelos = (opcoes: Opcoes = {}) => useQuery({ queryKey: ['modelos'], queryFn: api.modelos.listar, staleTime: 5 * 60_000, ...opcoes });

export function useAlterarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executar: () => Promise<ModeloMensagem>) => executar(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelos'] }),
  });
}

export const useMensagens = (filtros: Parameters<typeof api.mensagens.listar>[0] = {}, opcoes: Opcoes = {}) =>
  useQuery({ queryKey: ['comunicacoes', 'mensagens', filtros], queryFn: () => api.mensagens.listar(filtros), ...opcoes });
export const usePendentesComunicacao = (opcoes: Opcoes = {}) =>
  useQuery({ queryKey: ['comunicacoes', 'pendentes'], queryFn: api.mensagens.pendentes, refetchInterval: 2 * 60_000, ...opcoes });

/** Envia (ou regista) uma mensagem; o histórico do processo também muda. */
export function useEnviarMensagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: NovaMensagem) => api.mensagens.criar(dados),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['comunicacoes'] });
      if (m.processoId) qc.invalidateQueries({ queryKey: chaves.processo(m.processoId) });
    },
  });
}

/** Centro de notificações: consulta periódica (o alojamento partilhado não tem ligações em tempo real). */
export const useNotificacoes = () =>
  useQuery({ queryKey: ['notificacoes'], queryFn: api.notificacoes.listar, refetchInterval: 60_000, refetchIntervalInBackground: false });

export function useMarcarNotificacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.notificacoes.marcarLidas(ids),
    // Fica lida logo no clique; o servidor confirma a seguir.
    onMutate: (ids) => qc.setQueryData<Notificacao[]>(['notificacoes'], (l) => l?.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida: true } : n))),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });
}

// ---------- Portal do cliente ----------

export const usePortal = (token: string) =>
  useQuery({ queryKey: ['portal', token], queryFn: () => api.portal.obter(token), refetchOnWindowFocus: true });

/** Decisão do cliente (orçamento ou trabalho adicional); a resposta é o portal atualizado. */
export function useDecisaoPortal(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ adicionalId, ...dados }: DecisaoPortal & { adicionalId?: string }) =>
      adicionalId ? api.portal.decidirAdicional(token, adicionalId, dados) : api.portal.decidirOrcamento(token, dados),
    onSuccess: (p) => qc.setQueryData(['portal', token], p),
  });
}

export function useRenovarPortal(processoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.portal.renovar(processoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.processo(processoId) }),
  });
}

// ---------- Relatórios e painel ----------

export const useRelatorio = (de: string, ate: string) =>
  useQuery({ queryKey: ['relatorios', de, ate], queryFn: () => api.relatorios.obter(de, ate), placeholderData: (anterior) => anterior });

/** Alertas do painel; refrescam com qualquer alteração (ver refrescarComunicacoes) e a cada 2 minutos. */
export const useAlertas = () => useQuery({ queryKey: ['comunicacoes', 'alertas'], queryFn: api.relatorios.alertas, refetchInterval: 2 * 60_000 });
